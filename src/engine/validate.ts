// コンテンツ検証（§12.1）。npm run validate、ビルド、テストで共有する。
import { contentSchema, CHARACTER_IDS } from './schema';
import type { CharacterId, Content, GameEvent, Scene } from './schema';
import type { RunState } from './types';
import { collectComparisons, collectRefs, FlagExprError, parseFlagExpr } from './flags';
import { countChars, TEXT_LIMITS } from './limits';
import {
  advanceChance,
  advanceReview,
  advanceScene,
  advanceStatCards,
  beginChapter,
  choose,
  createRun,
  currentEvent,
  currentScene,
  switchViewpoint,
  visibleChoices,
  type ChanceOverride,
} from './progression';

export interface ValidateOptions {
  /** 本番ビルド。verified: false の統計を確率ノード・統計カードで参照すると失敗する */
  production: boolean;
  /** ALLOW_UNVERIFIED=1（プレビュー用） */
  allowUnverified: boolean;
  /** 16歳から35歳までの全章がそろっていることを求める（フェーズ2で true にする。付録A-6） */
  requireAllChapters?: boolean;
}

export interface ValidateResult {
  errors: string[];
  warnings: string[];
  drafts: { id: string; age: number; title: string }[];
  /** verified: false の統計を参照している箇所 */
  unverifiedUses: { where: string; statId: string }[];
  content?: Content;
}

/** P7：これらのフラグは、ハルトの視点のシーンからだけ書き換えられる（§6.7） */
export const HARUTO_ONLY_FLAGS = ['harutoRoute', 'harutoControl17'] as const;

const ALL_AGES = [16, 17, 19, 21, 24, 27, 30, 35];

export function validateContent(raw: unknown, opts: ValidateOptions): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const drafts: ValidateResult['drafts'] = [];
  const unverifiedUses: ValidateResult['unverifiedUses'] = [];

  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`スキーマ違反：${formatPath(issue.path)}：${issue.message}`);
    return { errors, warnings, drafts, unverifiedUses };
  }
  const content = parsed.data;
  const stats = new Map(content.stats.map((s) => [s.id, s]));
  const conds = new Map(content.conditions.map((c) => [c.id, c]));
  const upKeys = new Set(content.characters.flatMap((c) => Object.keys(c.upbringing)));

  // ── 一意性 ──
  dupCheck(content.characters.map((c) => c.id), '人物ID', errors);
  dupCheck(content.conditions.map((c) => c.id), '社会条件ID', errors);
  dupCheck(content.stats.map((s) => s.id), '統計ID', errors);
  dupCheck(content.resources.map((r) => r.id), '相談窓口ID', errors);
  dupCheck(content.chapters.map((c) => String(c.age)), '章の年齢', errors);
  const allEvents = content.chapters.flatMap((c) => c.events);
  dupCheck(allEvents.map((e) => e.id), 'イベントID', errors);
  dupCheck(
    allEvents.flatMap((e) => e.scenes.flatMap((s) => (s.chance ? [s.chance.id] : []))),
    '確率ノードID',
    errors,
  );
  for (const id of CHARACTER_IDS) {
    if (!content.characters.some((c) => c.id === id)) errors.push(`人物がいません：${id}`);
  }
  for (const c of content.conditions) {
    if (c.defaultOption !== null && !c.options.some((o) => o.id === c.defaultOption))
      errors.push(`社会条件 ${c.id}：既定値 ${c.defaultOption} が選択肢にありません`);
    if (c.defaultOption === null) warnings.push(`社会条件 ${c.id}：既定値がTBDです（未設定として扱います）`);
    dupCheck(c.options.map((o) => o.id), `社会条件 ${c.id} の選択肢ID`, errors);
  }

  // ── 統計の参照 ──
  const statRef = (where: string, id: string | undefined, usage: 'probability' | 'card' | 'other') => {
    if (id === undefined) return;
    const st = stats.get(id);
    if (!st) {
      errors.push(`${where}：存在しない統計 ${id} を参照しています`);
      return;
    }
    if (!st.verified && usage !== 'other') {
      unverifiedUses.push({ where, statId: id });
      if (opts.production && !opts.allowUnverified)
        errors.push(`${where}：本番ビルドで verified: false の統計 ${id} を参照しています（プレビューは ALLOW_UNVERIFIED=1）`);
    }
  };
  content.characters.forEach((c) => c.statRefs.forEach((s) => statRef(`人物 ${c.id}`, s, 'other')));
  content.conditions.forEach((c) => c.options.forEach((o) => o.statRefs.forEach((s) => statRef(`社会条件 ${c.id}.${o.id}`, s, 'other'))));

  // ── 既知のフラグ ──
  const knownFlags = new Set<string>();
  for (const c of content.conditions) for (const o of c.options) Object.keys(o.setFlags ?? {}).forEach((k) => knownFlags.add(k));
  for (const ev of allEvents)
    for (const sc of ev.scenes) {
      for (const ch of sc.choices ?? []) Object.keys(ch.setFlags ?? {}).forEach((k) => knownFlags.add(k));
      if (sc.chance)
        for (const o of [sc.chance.outcomes.happens, sc.chance.outcomes.notHappens])
          Object.keys(o.setFlags ?? {}).forEach((k) => knownFlags.add(k));
    }

  const expr = (where: string, src: string | undefined) => {
    if (src === undefined) return;
    try {
      const e = parseFlagExpr(src);
      for (const r of collectRefs(e)) {
        if (r.ns === 'flags' && !knownFlags.has(r.name)) errors.push(`${where}：どこでも設定されないフラグ flags.${r.name} を参照しています`);
        if (r.ns === 'cond' && !conds.has(r.name)) errors.push(`${where}：存在しない社会条件 cond.${r.name} を参照しています`);
        if (r.ns === 'up' && !upKeys.has(r.name)) errors.push(`${where}：存在しない生育条件 up.${r.name} を参照しています`);
      }
      for (const { ref, lit } of collectComparisons(e)) {
        if (ref.ns === 'cond') {
          const c = conds.get(ref.name);
          if (c && !c.options.some((o) => o.id === lit)) errors.push(`${where}：cond.${ref.name} に選択肢 ${String(lit)} はありません`);
        }
        if (ref.ns === 'char' && !(CHARACTER_IDS as readonly unknown[]).includes(lit))
          errors.push(`${where}：char と比べている ${String(lit)} は人物IDではありません`);
      }
    } catch (err) {
      if (err instanceof FlagExprError) errors.push(`${where}：条件式の構文エラー「${src}」：${err.message}`);
      else throw err;
    }
  };

  const textCheck = (where: string, text: string) => {
    const n = countChars(text);
    if (n > TEXT_LIMITS.sceneText) warnings.push(`${where}：シーン本文が ${n}字です（上限 ${TEXT_LIMITS.sceneText}字）`);
    rubyCheck(where, text, errors);
  };

  // ── 章とイベント ──
  for (const ch of content.chapters) {
    const where = `${ch.age}歳の章`;
    if (!(ALL_AGES as number[]).includes(ch.age)) errors.push(`${where}：年齢が §10.3 の章にありません`);
    if (ch.status === 'draft') drafts.push({ id: `${ch.age}歳の章（章トップ）`, age: ch.age, title: ch.title });
    for (const ev of ch.events) {
      const ew = `${ev.id}`;
      if (ev.age !== ch.age) errors.push(`${ew}：age ${ev.age} が章の年齢 ${ch.age} と違います`);
      if (ev.status === 'draft') drafts.push({ id: ev.id, age: ev.age, title: ev.domains.join('・') });
      expr(`${ew}.requires`, ev.requires);
      ev.statCard?.forEach((s) => statRef(`${ew}.statCard`, s, 'card'));
      for (const tag of ev.resources ?? [])
        if (!(tag in content.config.resourceTags)) errors.push(`${ew}：相談窓口のタグ ${tag} が config.resourceTags にありません`);
      for (const cid of ev.applyConditionFlags ?? []) if (!conds.has(cid)) errors.push(`${ew}：存在しない社会条件 ${cid}`);
      for (const c of ev.characters)
        if (!ch.intro[c]) errors.push(`${where}：${c} が出るイベントがあるのに intro.${c} がありません`);
      checkEvent(ev, { errors, warnings, expr, statRef, textCheck });
    }
  }

  if (opts.requireAllChapters) {
    for (const a of ALL_AGES) if (!content.chapters.some((c) => c.age === a)) errors.push(`${a}歳の章がありません`);
  }

  // ── 到達性（スキーマと参照が正しいときだけ） ──
  if (errors.length === 0) reachability(content, errors);

  if (drafts.length) warnings.push(`status: draft のイベント・章が ${drafts.length}件あります`);
  return { errors, warnings, drafts, unverifiedUses, content };
}

interface Checkers {
  errors: string[];
  warnings: string[];
  expr: (where: string, src: string | undefined) => void;
  statRef: (where: string, id: string | undefined, usage: 'probability' | 'card' | 'other') => void;
  textCheck: (where: string, text: string) => void;
}

function checkEvent(ev: GameEvent, k: Checkers): void {
  const { errors, warnings } = k;
  const sceneIds = new Set(ev.scenes.map((s) => s.id));
  dupCheck(ev.scenes.map((s) => s.id), `${ev.id} のシーンID`, errors);
  if (sceneIds.has('END')) errors.push(`${ev.id}：シーンIDに END は使えません`);
  const sceneById = new Map(ev.scenes.map((s) => [s.id, s]));

  const vs = ev.viewpointSwitch;
  if (vs) {
    for (const c of [vs.from, vs.to]) {
      if (!ev.characters.includes(c)) errors.push(`${ev.id}：視点 ${c} が characters にありません`);
      const entry = vs.entry[c];
      if (!entry) errors.push(`${ev.id}：viewpointSwitch.entry.${c} がありません`);
      else if (sceneById.get(entry)?.viewpoint !== c) errors.push(`${ev.id}：入口 ${entry} は ${c} の視点のシーンではありません`);
    }
  }

  const nextRef = (where: string, from: Scene, next: string) => {
    if (next === 'END') return;
    const to = sceneById.get(next);
    if (!to) {
      errors.push(`${where}：存在しないシーン ${next} に進みます`);
      return;
    }
    if (vs && to.viewpoint !== from.viewpoint) errors.push(`${where}：視点の違うシーン ${next} に進みます（視点ごとのシーン列は分ける）`);
  };

  const effectCheck = (where: string, effects: { note: string; when?: string; statRef?: string; sign: number; source?: string }[]) => {
    effects.forEach((e, i) => {
      const w = `${where}.effects[${i}]`;
      const n = countChars(e.note);
      if (n > TEXT_LIMITS.effectNote) errors.push(`${w}：note「${e.note}」が ${n}字です（上限 ${TEXT_LIMITS.effectNote}字）`);
      k.expr(`${w}.when`, e.when);
      k.statRef(`${w}.statRef`, e.statRef, 'other');
    });
  };

  const protectedFlags = (where: string, scene: Scene, flags: Record<string, unknown> | undefined) => {
    for (const f of HARUTO_ONLY_FLAGS)
      if (flags && f in flags && scene.viewpoint !== 'haruto')
        errors.push(`${where}：${f} はハルトの視点のシーンからだけ書き換えられます（P7、§6.7）`);
  };

  for (const sc of ev.scenes) {
    const w = `${ev.id}/${sc.id}`;
    if (vs && !sc.viewpoint) errors.push(`${w}：視点切替イベントのシーンには viewpoint が必要です`);
    k.textCheck(w, sc.text);
    if (sc.speaker) rubyCheck(`${w}.speaker`, sc.speaker, errors);
    const hasChoices = (sc.choices?.length ?? 0) > 0;
    if (hasChoices && sc.chance) errors.push(`${w}：choices と chance を同じシーンに書けません`);
    if ((hasChoices || sc.chance) && (sc.next || sc.branches)) errors.push(`${w}：choices・chance のあるシーンに next・branches は書けません`);
    if (!hasChoices && !sc.chance && !sc.next) errors.push(`${w}：行き止まりのシーンです（next も選択肢もありません）`);
    if (sc.next) nextRef(w, sc, sc.next);
    sc.branches?.forEach((b, i) => {
      k.expr(`${w}.branches[${i}].when`, b.when);
      nextRef(`${w}.branches[${i}]`, sc, b.next);
    });
    if (hasChoices) {
      const n = sc.choices!.length;
      if (n < 2 || n > 3) warnings.push(`${w}：選択肢が ${n}個です（§7.4 は2〜3個）`);
      if (!sc.choices!.some((c) => c.canonical)) warnings.push(`${w}：canonical の選択肢がありません（最初の選択肢を使います）`);
      dupCheck(sc.choices!.map((c) => c.id), `${w} の選択肢ID`, errors);
    }
    for (const c of sc.choices ?? []) {
      const cw = `${w}#${c.id}`;
      const n = countChars(c.label);
      if (n > TEXT_LIMITS.choiceLabel) warnings.push(`${cw}：選択肢が ${n}字です（上限 ${TEXT_LIMITS.choiceLabel}字）`);
      rubyCheck(cw, c.label, errors);
      k.expr(`${cw}.requires`, c.requires);
      effectCheck(cw, c.effects);
      if (c.neutral && c.effects.some((e) => e.sign < 0)) errors.push(`${cw}：neutral（どちらも正解）の選択肢に負の効果があります（P6）`);
      protectedFlags(cw, sc, c.setFlags);
      nextRef(cw, sc, c.next);
    }
    if (sc.chance) {
      const node = sc.chance;
      const nw = `${w}[${node.id}]`;
      k.statRef(`${nw}.base`, node.base.statRef, 'probability');
      node.modifiers.forEach((m, i) => {
        k.expr(`${nw}.modifiers[${i}].when`, m.when);
        k.statRef(`${nw}.modifiers[${i}]`, m.statRef, 'probability');
        const n = countChars(m.note);
        if (n > TEXT_LIMITS.effectNote) errors.push(`${nw}.modifiers[${i}]：note が ${n}字です（上限 ${TEXT_LIMITS.effectNote}字）`);
      });
      for (const key of ['happens', 'notHappens'] as const) {
        const o = node.outcomes[key];
        const ow = `${nw}.${key}`;
        o.effects.forEach((e, i) => {
          if (e.source !== undefined && e.source !== 'chance')
            errors.push(`${ow}.effects[${i}]：確率ノードの結果効果の要因は chance だけです（${e.source} と書かれています。§6.4-3）`);
        });
        effectCheck(ow, o.effects);
        protectedFlags(ow, sc, o.setFlags);
        nextRef(ow, sc, o.next);
      }
    }
  }
}

function rubyCheck(where: string, text: string, errors: string[]): void {
  const stripped = text.replace(/\{[^|{}]+\|[^{}]+\}/g, '');
  if (/[{}]/.test(stripped)) errors.push(`${where}：ルビの書き方が正しくありません（{漢字|かんじ} の形で書く）`);
}

function dupCheck(ids: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${label}が重複しています：${id}`);
    seen.add(id);
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('').replace(/^\./, '') || '(全体)';
}

// ───────── 到達性（§12.1） ─────────

/** 社会条件の全組み合わせ。既定値がTBD（null）の条件は、未設定も含める */
export function conditionCombinations(content: Content): Record<string, string>[] {
  let combos: Record<string, string>[] = [{}];
  for (const c of content.conditions) {
    const values: (string | undefined)[] = c.options.map((o) => o.id);
    if (c.defaultOption === null) values.push(undefined);
    combos = combos.flatMap((base) => values.map((v) => (v === undefined ? { ...base } : { ...base, [c.id]: v })));
  }
  return combos;
}

type Action = { label: string; run: (s: RunState, override: ChanceOverride) => RunState };

function actionsFor(content: Content, s: RunState): Action[] {
  const pos = s.position;
  switch (pos.step) {
    case 'chapterTop':
      return [
        { label: `${pos.age}歳を読む`, run: (x, o) => beginChapter(content, x, false, o) },
        { label: `${pos.age}歳を読まずに進む`, run: (x, o) => beginChapter(content, x, true, o) },
      ];
    case 'scene': {
      const scene = currentScene(content, s);
      if (!scene) throw new Error(`シーンがありません：${pos.eventId}/${pos.sceneId}`);
      const out: Action[] = [];
      const ev = currentEvent(content, s);
      if (ev?.viewpointSwitch && pos.tracks)
        for (const vp of Object.keys(pos.tracks) as CharacterId[])
          if (vp !== pos.viewpoint && !pos.tracksDone?.[vp]) out.push({ label: `視点を${vp}に`, run: (x) => switchViewpoint(content, x, vp) });
      if (scene.choices?.length) {
        const vis = visibleChoices(content, s, scene);
        if (vis.length === 0) throw new Error(`${pos.eventId}/${scene.id}：表示できる選択肢がありません`);
        for (const c of vis) out.push({ label: `${pos.eventId}/${scene.id}#${c.id}`, run: (x, o) => choose(content, x, c.id, o) });
      } else {
        out.push({ label: `${pos.eventId}/${scene.id}→`, run: (x, o) => advanceScene(content, x, o) });
      }
      return out;
    }
    case 'chance':
      return [{ label: '確率カード→', run: (x, o) => advanceChance(content, x, o) }];
    case 'statCards':
      return [{ label: '統計カード→', run: (x) => advanceStatCards(content, x) }];
    case 'review':
      return [{ label: `${pos.age}歳のふりかえり→`, run: (x) => advanceReview(content, x) }];
    case 'finished':
      return [];
  }
}

/**
 * 1つの操作を、その中で解決される確率ノードの「起きる／起きない」の全組み合わせで実行する。
 * （読まずに進む章では、1つの操作の中で複数のノードが解決されることがある）
 */
function runAllOutcomes(a: Action, s: RunState): RunState[] {
  const out: RunState[] = [];
  const work: Map<string, boolean>[] = [new Map()];
  while (work.length) {
    const decided = work.pop()!;
    const fresh: string[] = [];
    const r = a.run(s, (id) => {
      const d = decided.get(id);
      if (d !== undefined) return d;
      fresh.push(id);
      return true;
    });
    out.push(r);
    fresh.forEach((id, i) => {
      const branch = new Map(decided);
      fresh.slice(0, i).forEach((x) => branch.set(x, true));
      branch.set(id, false);
      work.push(branch);
    });
  }
  return out;
}

/** 進行に関係する部分だけで状態を同一視する（パラメーターは進行に影響しない） */
function flowKey(s: RunState): string {
  return JSON.stringify([s.position, s.flags]);
}

/**
 * 各主人公 × 社会条件の全組み合わせ × 全選択 × 確率の両方の結果で、
 * 最初の章から最後の章のふりかえりまで到達できることを確かめる。
 */
export function reachability(content: Content, errors: string[], limit = 500_000): void {
  for (const ch of content.characters) {
    for (const conditions of conditionCombinations(content)) {
      const start = createRun(content, { protagonist: ch.id, seed: '0'.repeat(32) });
      start.conditions = conditions;
      const label = `到達性：${ch.id}（${JSON.stringify(conditions)}）`;
      const visited = new Set<string>();
      const stack: { s: RunState; path: string[] }[] = [{ s: start, path: [] }];
      let finished = false;
      while (stack.length) {
        const { s, path } = stack.pop()!;
        const key = flowKey(s);
        if (visited.has(key)) continue;
        visited.add(key);
        if (visited.size > limit) {
          errors.push(`${label}：状態数が上限 ${limit} を超えました`);
          return;
        }
        if (s.position.step === 'finished') {
          finished = true;
          continue;
        }
        try {
          const acts = actionsFor(content, s);
          if (acts.length === 0) throw new Error('進めなくなる状態があります');
          for (const a of acts) for (const next of runAllOutcomes(a, s)) stack.push({ s: next, path: [...path, a.label] });
        } catch (err) {
          errors.push(`${label}：${(err as Error).message}／経路：${path.slice(-4).join(' > ')}`);
          return;
        }
      }
      if (!finished) errors.push(`${label}：最後の章まで到達できません`);
    }
  }
}
