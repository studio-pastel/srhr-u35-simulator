// 章・イベント・シーンの進行（§6.2、§6.7）。UI に依存しない純粋なロジック。
// 各操作は RunState を複製して新しい状態を返す。
import type { Chapter, CharacterId, Choice, Closeness, Content, GameEvent, Scene } from './schema';
import { CHARACTER_IDS } from './constants';
import type { RunState } from './types';
import { initialOf, pregnancyPossible, upOf, type Profile } from './profile';
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
    // pregnancyPossible は属性とパートナーから決まる（付録B-43）
    flags: { ...state.flags, pregnancyPossible: pregnancyPossible(state.profile, state.flags.partnerId) },
    cond: state.conditions,
    up: upOf(state.profile),
    char: state.protagonist,
  };
}

export function defaultConditions(content: Content): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of content.conditions) if (c.defaultOption !== null) out[c.id] = c.defaultOption;
  return out;
}

export interface NewRunOptions {
  profile: Profile;
  seed?: string;
  conditions?: Record<string, string>;
  replayOf?: RunState['replayOf'];
  runId?: string;
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  const ch = getCharacter(content, 'me');
  const first = sortedChapters(content)[0];
  if (!first) throw new ProgressionError('章がひとつもありません');
  const conditions = { ...defaultConditions(content), ...opts.conditions };
  // 社会条件が決めるフラグは、最初から反映する（学校で学んだかどうかなど）
  const flags: Record<string, unknown> = {};
  for (const c of content.conditions) Object.assign(flags, c.options.find((o) => o.id === conditions[c.id])?.setFlags);
  const initial = initialOf(ch.initial, opts.profile);
  const state: RunState = {
    version: 6,
    runId: opts.runId ?? newSeed().slice(0, 12),
    seed: opts.seed ?? newSeed(),
    protagonist: 'me',
    profile: opts.profile,
    initial,
    conditions,
    flags,
    params: { ...initial },
    ledger: [],
    chanceLog: [],
    position: { age: first.age, eventId: '', sceneId: '', step: 'chapterTop', eventIndex: 0 },
    completedEvents: [],
    choices: {},
    skippedChapters: [],
    skippedEvents: [],
    bonds: Object.fromEntries(ch.bonds.map((b) => [b.id, { level: b.initial }])),
    bondLog: [],
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

/** 属性や状況に合う吹き出しだけを返す（付録B-43） */
export function visibleLines(content: Content, state: RunState, scene: Scene) {
  const ctx = contextOf(content, state);
  return (scene.lines ?? []).filter((l) => check(l.when, ctx));
}

export const choiceKey = (eventId: string, sceneId: string) => `${eventId}/${sceneId}`;

/** 標準ルートの選択：表示される canonical の最初の1つ。なければ表示される最初の1つ */
export function canonicalChoice(content: Content, state: RunState, scene: Scene): Choice {
  const vis = visibleChoices(content, state, scene);
  const c = vis.find((x) => x.canonical) || vis[0];
  if (!c) throw new ProgressionError(`表示できる選択肢がありません：${state.position.eventId}/${scene.id}`);
  return c;
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
  s.position = { ...s.position, eventId: '', sceneId: '', step: 'review', eventIndex: ch.events.length };
  delete s.position.pendingNext;
}

function startEvent(content: Content, s: RunState, ev: GameEvent, index: number): void {
  const pos = s.position;
  pos.eventId = ev.id;
  pos.eventIndex = index;
  pos.step = 'scene';
  delete pos.pendingNext;
  pos.sceneId = ev.scenes[0]!.id;
  applySceneEntry(content, s, ev);
}

/**
 * シーンに入ったときの効果（付録A-15）。選択と関係なく起きる変化（他者の行為など）に使う。
 */
function applySceneEntry(content: Content, s: RunState, ev: GameEvent): void {
  const scene = ev.scenes.find((x) => x.id === s.position.sceneId);
  if (!scene) return;
  if (scene.effects?.length) applyEffects(s, scene.effects, content.config, contextOf(content, s), origin(s));
  if (scene.closeness?.length) applyCloseness(content, s, scene.closeness);
}

/**
 * 人との距離を変える（付録B-9）。主人公の近しい人（characters.yaml の bonds）だけが対象。
 * 近さは 0〜3 に収める。関係が終わった人（end）は、それ以上変えない。
 */
export function applyCloseness(content: Content, s: RunState, list: Closeness[]): void {
  const ctx = contextOf(content, s);
  for (const c of list) {
    if (!check(c.when, ctx)) continue;
    const b = s.bonds[c.who];
    if (!b || b.ended) continue;
    const from = b.level;
    const to = Math.max(0, Math.min(3, from + (c.delta ?? 0)));
    if (to === from && !c.end) continue;
    b.level = to;
    if (c.end) b.ended = true;
    s.bondLog.push({
      age: s.position.age,
      eventId: s.position.eventId,
      who: c.who,
      from,
      to,
      note: c.note,
      ...(c.end ? { ended: true } : {}),
      ...(s.position.skipping ? { skipped: true } : {}),
    });
  }
}

function endEvent(content: Content, s: RunState, ev: GameEvent): void {
  s.completedEvents.push(ev.id);
  // 相談先は、画面の下の「私も相談したいことがある」からだけ案内する（付録B-39）。統計は章のふりかえりで出す（付録B-4）
  // とばしたのはこのイベントだけなので、次のイベントの効果には「とばした」を付けない
  if (s.position.skippingEvent) {
    delete s.position.skipping;
    delete s.position.skippingEvent;
  }
  enterNextEvent(content, s, s.position.eventIndex + 1);
}

function nextOf(content: Content, s: RunState, scene: Scene): string {
  const ctx = contextOf(content, s);
  for (const b of scene.branches ?? []) if (check(b.when, ctx)) return b.next;
  if (!scene.next) throw new ProgressionError(`${s.position.eventId}/${scene.id}：次のシーンがありません`);
  return scene.next;
}

function moveTo(content: Content, s: RunState, next: string): void {
  const ev = currentEvent(content, s)!;
  if (next !== 'END') {
    s.position.sceneId = next;
    applySceneEntry(content, s, ev);
    return;
  }
  endEvent(content, s, ev);
}

/** 確率ノードを解決し、chanceLog に記録して、結果の next を返す */
function doChance(content: Content, s: RunState, scene: Scene, override?: ChanceOverride): string {
  const node = scene.chance!;
  const ctx = contextOf(content, s);
  const r = resolveChance(node, ctx, s.seed);
  const forced = override?.(node.id);
  if (forced !== undefined) r.happened = forced;
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
  });
  const outcome = r.happened ? node.outcomes.happens : node.outcomes.notHappens;
  applyEffects(s, outcome.effects, content.config, ctx, origin(s), 'chance');
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
    } else moveTo(content, s, nextOf(content, s, scene));
  } else if (pos.step === 'chance') {
    finishChanceStep(content, s, override);
  } else {
    throw new ProgressionError(`自動進行できない段階です：${pos.step}`);
  }
}

function applyChoice(content: Content, s: RunState, choice: Choice, override?: ChanceOverride): void {
  const ctx = contextOf(content, s);
  applyEffects(s, choice.effects, content.config, ctx, origin(s));
  if (choice.closeness?.length) applyCloseness(content, s, choice.closeness);
  s.choices[choiceKey(s.position.eventId, s.position.sceneId)] = choice.id;
  if (choice.setFlags) Object.assign(s.flags, choice.setFlags);
  moveTo(content, s, choice.next);
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
    moveTo(content, s, nextOf(content, s, scene));
  }
  return s;
}

function finishChanceStep(content: Content, s: RunState, override?: ChanceOverride): void {
  const next = s.position.pendingNext;
  if (!next) throw new ProgressionError('確率カードの次がありません');
  delete s.position.pendingNext;
  s.position.step = 'scene';
  moveTo(content, s, next);
}

export function advanceChance(content: Content, state: RunState, override?: ChanceOverride): RunState {
  if (state.position.step !== 'chance') throw new ProgressionError('確率カードではありません');
  const s = clone(state);
  finishChanceStep(content, s, override);
  return s;
}

/** 章のふりかえりから次の章へ。次の章がなければ finished */
export function advanceReview(content: Content, state: RunState): RunState {
  if (state.position.step !== 'review') throw new ProgressionError('ふりかえりではありません');
  const s = clone(state);
  const next = sortedChapters(content).find((c) => c.age > s.position.age);
  if (next) {
    s.position = { age: next.age, eventId: '', sceneId: '', step: 'chapterTop', eventIndex: 0 };
  } else {
    s.position = { ...s.position, step: 'finished' };
  }
  return s;
}

/**
 * 「この場面をとばす」（付録B-17）。いまのイベントの残りを canonical の選択で進める。
 * 効果は本来の要因のまま skipped 付きで記録し、とばしたイベントを skippedEvents に残す。
 */
export function skipEvent(content: Content, state: RunState): RunState {
  const pos = state.position;
  if (pos.step !== 'scene' && pos.step !== 'chance') throw new ProgressionError('場面の途中ではありません');
  const s = clone(state);
  const evId = s.position.eventId;
  if (!s.skippedEvents.includes(evId)) s.skippedEvents.push(evId);
  s.position.skipping = true;
  s.position.skippingEvent = true;
  let guard = 0;
  while (s.position.eventId === evId && (s.position.step === 'scene' || s.position.step === 'chance')) {
    if (++guard > 2000) throw new ProgressionError('とばす処理が終わりません');
    autoStep(content, s);
  }
  delete s.position.skipping;
  delete s.position.skippingEvent;
  return s;
}
