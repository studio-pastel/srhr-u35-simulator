// 章・イベント・シーンの進行（§6.2、§6.7）。UI に依存しない純粋なロジック。
// 各操作は RunState を複製して新しい状態を返す。
import type { Chapter, CharacterId, Choice, Content, GameEvent, Scene } from './schema';
import { CHARACTER_IDS } from './constants';
import type { RunState } from './types';
import { check, type EvalContext } from './flags';
import { applyEffects } from './effects';
import { resolveChance } from './chance';
import { newSeed } from './rng';

export class ProgressionError extends Error {}

/** 検証・テスト用：確率ノードの結果を外から決める（通常のプレイでは使わない） */
export type ChanceOverride = (nodeId: string) => boolean | undefined;

export function sortedChapters(content: Content): Chapter[] {
  return [...content.chapters].sort((a, b) => a.age - b.age);
}

export function getChapter(content: Content, age: number): Chapter {
  const ch = content.chapters.find((c) => c.age === age);
  if (!ch) throw new ProgressionError(`章がありません：${age}`);
  return ch;
}

export function getCharacter(content: Content, id: CharacterId) {
  const c = content.characters.find((x) => x.id === id);
  if (!c) throw new ProgressionError(`人物がいません：${id}`);
  return c;
}

export function contextOf(content: Content, state: RunState): EvalContext {
  return {
    flags: state.flags,
    cond: state.conditions,
    up: getCharacter(content, state.protagonist).upbringing,
    char: state.protagonist,
  };
}

export function defaultConditions(content: Content): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of content.conditions) if (c.defaultOption !== null) out[c.id] = c.defaultOption;
  return out;
}

export interface NewRunOptions {
  protagonist: CharacterId;
  seed?: string;
  conditions?: Record<string, string>;
  avatarSalts?: Partial<Record<CharacterId, number>>;
  replayOf?: RunState['replayOf'];
  runId?: string;
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  const ch = getCharacter(content, opts.protagonist);
  const first = sortedChapters(content)[0];
  if (!first) throw new ProgressionError('章がひとつもありません');
  const salts = Object.fromEntries(CHARACTER_IDS.map((id) => [id, opts.avatarSalts?.[id] ?? 0])) as Record<CharacterId, number>;
  const state: RunState = {
    version: 2,
    runId: opts.runId ?? newSeed().slice(0, 12),
    seed: opts.seed ?? newSeed(),
    protagonist: opts.protagonist,
    conditions: { ...defaultConditions(content), ...opts.conditions },
    flags: {},
    params: { ...ch.initial },
    ledger: [],
    chanceLog: [],
    position: { age: first.age, eventId: '', sceneId: '', viewpoint: opts.protagonist, step: 'chapterTop', eventIndex: 0 },
    completedEvents: [],
    skippedChapters: [],
    avatarSalts: salts,
  };
  if (opts.replayOf) state.replayOf = opts.replayOf;
  return state;
}

const clone = (s: RunState): RunState => structuredClone(s);

export function eventApplies(content: Content, state: RunState, ev: GameEvent): boolean {
  return ev.characters.includes(state.protagonist) && check(ev.requires, contextOf(content, state));
}

/** 章の中で、いまの状態で発生するイベント（章トップの注意判定に使う） */
export function applicableEvents(content: Content, state: RunState, age: number): GameEvent[] {
  return getChapter(content, age).events.filter((e) => eventApplies(content, state, e));
}

export function chapterWarnings(content: Content, state: RunState, age: number): string[] {
  return applicableEvents(content, state, age)
    .map((e) => e.triggerWarning)
    .filter((w): w is string => Boolean(w));
}

/** その章で終えたイベントに付いている相談窓口のタグ（重複なし） */
export function chapterResourceTags(content: Content, state: RunState, age: number): string[] {
  const tags = getChapter(content, age)
    .events.filter((e) => state.completedEvents.includes(e.id))
    .flatMap((e) => e.resources ?? []);
  return [...new Set(tags)];
}

export function currentEvent(content: Content, state: RunState): GameEvent | undefined {
  if (!state.position.eventId) return undefined;
  return getChapter(content, state.position.age).events.find((e) => e.id === state.position.eventId);
}

export function currentScene(content: Content, state: RunState): Scene | undefined {
  const ev = currentEvent(content, state);
  return ev?.scenes.find((s) => s.id === state.position.sceneId);
}

export function visibleChoices(content: Content, state: RunState, scene: Scene): Choice[] {
  const ctx = contextOf(content, state);
  return (scene.choices ?? []).filter((c) => check(c.requires, ctx));
}

/** 標準ルートの選択：表示される canonical の最初の1つ。なければ表示される最初の1つ */
export function canonicalChoice(content: Content, state: RunState, scene: Scene): Choice {
  const vis = visibleChoices(content, state, scene);
  const c = vis.find((x) => x.canonical) ?? vis[0];
  if (!c) throw new ProgressionError(`表示できる選択肢がありません：${state.position.eventId}/${scene.id}`);
  return c;
}

/** いま読んでいる視点が主人公のものか（主人公以外の視点ではパラメーターを動かさない。§6.7） */
export function onProtagonistTrack(content: Content, state: RunState): boolean {
  const ev = currentEvent(content, state);
  return !ev?.viewpointSwitch || state.position.viewpoint === state.protagonist;
}

function origin(state: RunState) {
  const p = state.position;
  return { age: p.age, eventId: p.eventId, sceneId: p.sceneId, skipped: p.skipping };
}

function enterNextEvent(content: Content, s: RunState, fromIndex: number): void {
  const ch = getChapter(content, s.position.age);
  for (let i = fromIndex; i < ch.events.length; i++) {
    const ev = ch.events[i]!;
    if (eventApplies(content, s, ev)) {
      startEvent(content, s, ev, i);
      return;
    }
  }
  s.position = { ...s.position, eventId: '', sceneId: '', step: 'review', eventIndex: ch.events.length, viewpoint: s.protagonist };
  delete s.position.tracks;
  delete s.position.tracksDone;
  delete s.position.pendingNext;
}

function startEvent(content: Content, s: RunState, ev: GameEvent, index: number): void {
  for (const condId of ev.applyConditionFlags ?? []) {
    const cond = content.conditions.find((c) => c.id === condId);
    const opt = cond?.options.find((o) => o.id === s.conditions[condId]);
    if (opt?.setFlags) Object.assign(s.flags, opt.setFlags);
  }
  const pos = s.position;
  pos.eventId = ev.id;
  pos.eventIndex = index;
  pos.step = 'scene';
  pos.viewpoint = s.protagonist;
  delete pos.pendingNext;
  if (ev.viewpointSwitch) {
    pos.tracks = { ...ev.viewpointSwitch.entry };
    pos.tracksDone = {};
    const entry = ev.viewpointSwitch.entry[s.protagonist];
    if (!entry) throw new ProgressionError(`${ev.id}：主人公の視点の入口がありません`);
    pos.sceneId = entry;
  } else {
    delete pos.tracks;
    delete pos.tracksDone;
    pos.sceneId = ev.scenes[0]!.id;
  }
  applySceneEntry(content, s, ev);
}

/**
 * シーンに入ったときの効果（付録A-15）。選択と関係なく起きる変化（他者の行為など）に使う。
 * 主人公の視点のシーンだけに適用する。視点を切り替えて戻ったときには再び適用しない
 * （呼ぶのは、イベントの開始と next による移動のときだけ）。
 */
function applySceneEntry(content: Content, s: RunState, ev: GameEvent): void {
  const scene = ev.scenes.find((x) => x.id === s.position.sceneId);
  if (!scene?.effects?.length || !onProtagonistTrack(content, s)) return;
  applyEffects(s, scene.effects, content.config, contextOf(content, s), origin(s));
}

function endEvent(content: Content, s: RunState, ev: GameEvent): void {
  s.completedEvents.push(ev.id);
  delete s.position.tracks;
  delete s.position.tracksDone;
  s.position.viewpoint = s.protagonist;
  if (!s.position.skipping && ((ev.statCard?.length ?? 0) > 0 || (ev.resources?.length ?? 0) > 0)) {
    s.position.step = 'statCards';
    return;
  }
  enterNextEvent(content, s, s.position.eventIndex + 1);
}

/** 主人公以外の視点の残りを、canonical の選択で最後まで進める（効果は付けず、フラグだけ反映） */
function finishOtherTracks(content: Content, s: RunState, ev: GameEvent, override?: ChanceOverride): void {
  const tracks = s.position.tracks ?? {};
  for (const vp of Object.keys(tracks) as CharacterId[]) {
    if (vp === s.protagonist || s.position.tracksDone?.[vp]) continue;
    const saved = { viewpoint: s.position.viewpoint, sceneId: s.position.sceneId };
    s.position.viewpoint = vp;
    s.position.sceneId = tracks[vp]!;
    let guard = 0;
    while (s.position.sceneId !== 'END') {
      if (++guard > 500) throw new ProgressionError(`${ev.id}：${vp} の視点が終わりません`);
      const scene = ev.scenes.find((x) => x.id === s.position.sceneId);
      if (!scene) throw new ProgressionError(`${ev.id}：シーンがありません ${s.position.sceneId}`);
      s.position.sceneId = stepOffTrack(content, s, scene, override);
    }
    s.position.tracksDone = { ...s.position.tracksDone, [vp]: true };
    s.position.viewpoint = saved.viewpoint;
    s.position.sceneId = saved.sceneId;
  }
}

function stepOffTrack(content: Content, s: RunState, scene: Scene, override?: ChanceOverride): string {
  if (scene.choices?.length) {
    const c = canonicalChoice(content, s, scene);
    if (c.setFlags) Object.assign(s.flags, c.setFlags);
    return c.next;
  }
  if (scene.chance) {
    return doChance(content, s, scene, override);
  }
  return nextOf(content, s, scene);
}

function nextOf(content: Content, s: RunState, scene: Scene): string {
  const ctx = contextOf(content, s);
  for (const b of scene.branches ?? []) if (check(b.when, ctx)) return b.next;
  if (!scene.next) throw new ProgressionError(`${s.position.eventId}/${scene.id}：次のシーンがありません`);
  return scene.next;
}

function moveTo(content: Content, s: RunState, next: string, override?: ChanceOverride): void {
  const ev = currentEvent(content, s)!;
  const pos = s.position;
  if (next !== 'END') {
    pos.sceneId = next;
    if (pos.tracks) pos.tracks[pos.viewpoint] = next;
    applySceneEntry(content, s, ev);
    return;
  }
  if (!ev.viewpointSwitch) {
    endEvent(content, s, ev);
    return;
  }
  pos.tracksDone = { ...pos.tracksDone, [pos.viewpoint]: true };
  if (pos.tracks) pos.tracks[pos.viewpoint] = 'END';
  if (pos.viewpoint === s.protagonist) {
    finishOtherTracks(content, s, ev, override);
    endEvent(content, s, ev);
  } else {
    pos.viewpoint = s.protagonist;
    pos.sceneId = pos.tracks?.[s.protagonist] ?? ev.viewpointSwitch.entry[s.protagonist]!;
  }
}

/** 確率ノードを解決し、chanceLog に記録して、結果の next を返す */
function doChance(content: Content, s: RunState, scene: Scene, override?: ChanceOverride): string {
  const node = scene.chance!;
  const ctx = contextOf(content, s);
  const r = resolveChance(node, ctx, s.seed);
  const forced = override?.(node.id);
  if (forced !== undefined) r.happened = forced;
  const onTrack = onProtagonistTrack(content, s);
  s.chanceLog.push({
    nodeId: node.id,
    label: node.label,
    age: s.position.age,
    eventId: s.position.eventId,
    base: r.base,
    baseStatRef: node.base.statRef,
    modifiersApplied: r.modifiersApplied,
    finalP: r.finalP,
    u: r.u,
    happened: r.happened,
    ...(node.actorLabel ? { actorLabel: node.actorLabel } : {}),
    ...(onTrack ? {} : { offTrack: true }),
  });
  const outcome = r.happened ? node.outcomes.happens : node.outcomes.notHappens;
  if (onTrack) applyEffects(s, outcome.effects, content.config, ctx, origin(s), 'chance');
  if (outcome.setFlags) Object.assign(s.flags, outcome.setFlags);
  return outcome.next;
}

// ───────── UI から呼ぶ操作 ─────────

/** 章を始める。skip=true は「この章を読まずに進む」（§6.2-3） */
export function beginChapter(content: Content, state: RunState, skip: boolean, override?: ChanceOverride): RunState {
  if (state.position.step !== 'chapterTop') throw new ProgressionError('章トップではありません');
  const s = clone(state);
  if (skip) {
    if (!s.skippedChapters.includes(s.position.age)) s.skippedChapters.push(s.position.age);
    s.position.skipping = true;
  }
  enterNextEvent(content, s, 0);
  if (skip) {
    let guard = 0;
    while (s.position.step !== 'review') {
      if (++guard > 5000) throw new ProgressionError('自動進行が終わりません');
      autoStep(content, s, override);
    }
    delete s.position.skipping;
  }
  return s;
}

/** 1ステップを canonical で自動進行する（読まずに進んだ章、テスト、標準ルートで使う） */
export function autoStep(content: Content, s: RunState, override?: ChanceOverride): void {
  const pos = s.position;
  if (pos.step === 'scene') {
    const scene = currentScene(content, s)!;
    if (scene.choices?.length) applyChoice(content, s, canonicalChoice(content, s, scene), override);
    else if (scene.chance) {
      pos.pendingNext = doChance(content, s, scene, override);
      pos.step = 'chance';
    } else moveTo(content, s, nextOf(content, s, scene), override);
  } else if (pos.step === 'chance') {
    finishChanceStep(content, s, override);
  } else if (pos.step === 'statCards') {
    enterNextEvent(content, s, pos.eventIndex + 1);
  } else {
    throw new ProgressionError(`自動進行できない段階です：${pos.step}`);
  }
}

function applyChoice(content: Content, s: RunState, choice: Choice, override?: ChanceOverride): void {
  const ctx = contextOf(content, s);
  if (onProtagonistTrack(content, s)) applyEffects(s, choice.effects, content.config, ctx, origin(s));
  if (choice.setFlags) Object.assign(s.flags, choice.setFlags);
  moveTo(content, s, choice.next, override);
}

export function choose(content: Content, state: RunState, choiceId: string, override?: ChanceOverride): RunState {
  const scene = currentScene(content, state);
  if (state.position.step !== 'scene' || !scene) throw new ProgressionError('シーンではありません');
  const choice = visibleChoices(content, state, scene).find((c) => c.id === choiceId);
  if (!choice) throw new ProgressionError(`選べない選択肢です：${choiceId}`);
  const s = clone(state);
  applyChoice(content, s, choice, override);
  return s;
}

/** 選択肢のないシーンを進める。確率ノードのあるシーンでは、確率を解決して確率カードに進む */
export function advanceScene(content: Content, state: RunState, override?: ChanceOverride): RunState {
  const scene = currentScene(content, state);
  if (state.position.step !== 'scene' || !scene) throw new ProgressionError('シーンではありません');
  if (scene.choices?.length) throw new ProgressionError('選択肢のあるシーンです');
  const s = clone(state);
  if (scene.chance) {
    s.position.pendingNext = doChance(content, s, scene, override);
    s.position.step = 'chance';
  } else {
    moveTo(content, s, nextOf(content, s, scene), override);
  }
  return s;
}

function finishChanceStep(content: Content, s: RunState, override?: ChanceOverride): void {
  const next = s.position.pendingNext;
  if (!next) throw new ProgressionError('確率カードの次がありません');
  delete s.position.pendingNext;
  s.position.step = 'scene';
  moveTo(content, s, next, override);
}

export function advanceChance(content: Content, state: RunState, override?: ChanceOverride): RunState {
  if (state.position.step !== 'chance') throw new ProgressionError('確率カードではありません');
  const s = clone(state);
  finishChanceStep(content, s, override);
  return s;
}

export function advanceStatCards(content: Content, state: RunState): RunState {
  if (state.position.step !== 'statCards') throw new ProgressionError('統計カードではありません');
  const s = clone(state);
  enterNextEvent(content, s, s.position.eventIndex + 1);
  return s;
}

/** 章のふりかえりから次の章へ。次の章がなければ finished */
export function advanceReview(content: Content, state: RunState): RunState {
  if (state.position.step !== 'review') throw new ProgressionError('ふりかえりではありません');
  const s = clone(state);
  const next = sortedChapters(content).find((c) => c.age > s.position.age);
  if (next) {
    s.position = { age: next.age, eventId: '', sceneId: '', viewpoint: s.protagonist, step: 'chapterTop', eventIndex: 0 };
  } else {
    s.position = { ...s.position, step: 'finished' };
  }
  return s;
}

/** 視点切替（§6.7）。読み終えた視点には切り替えない */
export function switchViewpoint(content: Content, state: RunState, vp: CharacterId): RunState {
  const ev = currentEvent(content, state);
  const pos = state.position;
  if (!ev?.viewpointSwitch || pos.step !== 'scene') throw new ProgressionError('視点を切り替えられません');
  if (!pos.tracks || !(vp in pos.tracks) || pos.tracksDone?.[vp]) throw new ProgressionError(`この視点には切り替えられません：${vp}`);
  const s = clone(state);
  s.position.viewpoint = vp;
  s.position.sceneId = s.position.tracks![vp]!;
  return s;
}
