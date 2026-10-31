// コンテンツ検証（§12.1）。npm run validate、ビルド、テストで共有する。
import { contentSchema, CHARACTER_IDS } from './schema';
import type { Closeness, Content, GameEvent, Scene } from './schema';
import { ATTRACTIONS, BODIES, GENDERS, PROFILE_KEYS, type Profile } from './profile';
import type { RunState } from './types';
import { collectComparisons, collectRefs, FlagExprError, parseFlagExpr } from './flags';
import { countChars, TEXT_LIMITS } from './limits';
import {
  advanceChance,
  advanceReview,
  advanceScene,
  beginChapter,
  choose,
  createRun,
  currentEvent,
  currentScene,
  visibleLines,
  visibleChoices,
  type ChanceOverride,
} from './progression';

export interface ValidateOptions {
  /** 本番ビルド。verified: false の統計を確率ノード・統計カードで参照すると失敗する */
  production: boolean;
  /** ALLOW_UNVERIFIED=1（プレビュー用） */
  allowUnverified: boolean;
  /** 16歳から35歳までの全章がそろっていることを求める（付録A-6。フェーズ2から true） */
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
  const upKeys = new Set<string>(PROFILE_KEYS);

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

  // ── 統計カードの文（§11-7、付録A-10） ──
  for (const st of content.stats) {
    const w = `統計 ${st.id}.cardText`;
    // 日本のデータは「日本では、」、海外のデータは国名から始める（例：「米国では、」「英国では、」）
    if (st.jpData ? !st.cardText.startsWith('日本では、') : !/^(?!日本)[^、]{1,6}では、/.test(st.cardText))
      errors.push(`${w}：${st.jpData ? '「日本では、」' : '国名（例：「米国では、」）'}で始めてください`);
    rubyCheck(w, st.cardText, errors);
    const allowed = new Set(numbersIn(`${st.value} ${st.definition} ${st.label}`));
    for (const n of numbersIn(st.cardText))
      if (!allowed.has(n)) errors.push(`${w}：数字 ${n} が value・definition・label にありません（§10.5 の表にない数値は書かない）`);
  }

  // ── 既知のフラグ ──
  const knownFlags = new Set<string>(['pregnancyPossible']);
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

  // ── 登場人物（付録B-1・B-5） ──
  dupCheck(content.cast.map((c) => c.id), '登場人物ID', errors);
  // self は「いま遊んでいる主人公」（全員が出るイベントで使う）
  const castIds = new Set([...content.cast.map((c) => c.id), 'self', 'partner']);
  for (const id of CHARACTER_IDS) if (!castIds.has(id)) errors.push(`cast.yaml に主人公 ${id} の見た目がありません`);
  // 人との距離（付録B-9）：主人公ごとの近しい人
  const bondsOf = new Map(content.characters.map((c) => [c.id as string, new Set(c.bonds.map((b) => b.id))]));
  for (const c of content.characters)
    for (const b of c.bonds) {
      if (!castIds.has(b.id)) errors.push(`人物 ${c.id}.bonds：${b.id} が cast.yaml にありません`);
      expr(`人物 ${c.id}.bonds.${b.id}.when`, b.when);
    }

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
      for (const rid of ev.support ?? []) if (!content.resources.some((r) => r.id === rid)) errors.push(`${ew}.support：存在しない相談先 ${rid}`);
      for (const tag of ev.resources ?? [])
        if (!(tag in content.config.resourceTags)) errors.push(`${ew}：相談窓口のタグ ${tag} が config.resourceTags にありません`);
      for (const c of ev.characters)
        if (!ch.intro[c]) errors.push(`${where}：${c} が出るイベントがあるのに intro.${c} がありません`);
      checkEvent(ev, { errors, warnings, expr, statRef, textCheck, castIds, bondsOf });
    }
  }

  // ── 生まれてから15歳まで（付録B-45） ──
  for (const page of content.prologue.pages) {
    const w = `prologue/${page.id}`;
    for (const c of page.stage.cast) {
      if (!castIds.has(c.id)) errors.push(`${w}.stage：登場人物 ${c.id} が cast.yaml にありません`);
      expr(`${w}.stage.cast.when`, c.when);
    }
    page.lines.forEach((l, i) => {
      expr(`${w}.lines[${i}].when`, l.when);
      textCheck(`${w}.lines[${i}]`, l.text);
      const n = countChars(l.text.replace('%name%', 'ヒカル'));
      if (n > TEXT_LIMITS.line) warnings.push(`${w}.lines[${i}]：吹き出しが ${n}字です（上限 ${TEXT_LIMITS.line}字）`);
    });
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
  /** 会話の行・舞台に出せる人物のID（cast.yaml）。narration は地の文 */
  castIds: Set<string>;
  /** 主人公ごとの近しい人（付録B-9） */
  bondsOf: Map<string, Set<string>>;
}

function checkEvent(ev: GameEvent, k: Checkers): void {
  const { errors, warnings } = k;
  const sceneIds = new Set(ev.scenes.map((s) => s.id));
  dupCheck(ev.scenes.map((s) => s.id), `${ev.id} のシーンID`, errors);
  for (const c of ev.stage?.cast ?? []) {
    if (!k.castIds.has(c.id)) errors.push(`${ev.id}.stage：登場人物 ${c.id} が cast.yaml にありません`);
    k.expr(`${ev.id}.stage.cast.when`, c.when);
  }
  if (ev.summary && countChars(ev.summary) > TEXT_LIMITS.summary)
    warnings.push(`${ev.id}.summary：${countChars(ev.summary)}字です（上限 ${TEXT_LIMITS.summary}字）`);
  if (sceneIds.has('END')) errors.push(`${ev.id}：シーンIDに END は使えません`);
  const sceneById = new Map(ev.scenes.map((s) => [s.id, s]));

  const nextRef = (where: string, from: Scene, next: string) => {
    if (next === 'END') return;
    if (!sceneById.get(next)) {
      errors.push(`${where}：存在しないシーン ${next} に進みます`);
      return;
    }
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

  // 人との距離（付録B-9）。相手は、その場面の主人公の近しい人であること。
  // 暴力の場面では、イベントに出る主人公どうしの近さを変えない（束縛を「近い」と描かないため）。関係の終わり（end）だけは書ける
  const closenessCheck = (where: string, sc: Scene, list: Closeness[] | undefined) => {
    (list ?? []).forEach((c, i) => {
      const cw = `${where}.closeness[${i}]`;
      const owners = ev.characters;
      if (!owners.some((o) => k.bondsOf.get(o)?.has(c.who))) errors.push(`${cw}：${c.who} は ${owners.join('・')} の近しい人（characters.yaml の bonds）にいません`);
      if (c.delta === undefined && !c.end) errors.push(`${cw}：delta か end のどちらかが必要です`);
      const n = countChars(c.note);
      if (n > TEXT_LIMITS.effectNote) errors.push(`${cw}：note「${c.note}」が ${n}字です（上限 ${TEXT_LIMITS.effectNote}字）`);
      k.expr(`${cw}.when`, c.when);
      if ((ev.resources ?? []).includes('violence') && c.who === 'partner' && !c.end)
        errors.push(`${cw}：暴力の場面では、${c.who} との近さを変えられません（関係の終わり end だけ書けます。付録B-9）`);
    });
  };

  for (const sc of ev.scenes) {
    const w = `${ev.id}/${sc.id}`;
    if (!sc.text && !sc.lines?.length) errors.push(`${w}：text か lines のどちらかが必要です`);
    if (sc.text) k.textCheck(w, sc.text);
    sc.lines?.forEach((l, i) => {
      const lw = `${w}.lines[${i}]`;
      if (l.who !== 'narration' && !k.castIds.has(l.who)) errors.push(`${lw}：登場人物 ${l.who} が cast.yaml にありません`);
      k.expr(`${lw}.when`, l.when);
      if (l.kind === 'fade' && l.who !== 'narration') errors.push(`${lw}：暗転（kind: fade）は who: narration で書きます`);
      const n = countChars(l.text);
      if (n > TEXT_LIMITS.line) warnings.push(`${lw}：吹き出しが ${n}字です（上限 ${TEXT_LIMITS.line}字）`);
      rubyCheck(lw, l.text, errors);
    });
    for (const c of sc.stage?.cast ?? []) {
      if (!k.castIds.has(c.id)) errors.push(`${w}.stage：登場人物 ${c.id} が cast.yaml にありません`);
      k.expr(`${w}.stage.cast.when`, c.when);
    }
    closenessCheck(w, sc, sc.closeness);
    for (const c of sc.choices ?? []) closenessCheck(`${w}#${c.id}`, sc, c.closeness);
    if (sc.effects) {
      effectCheck(w, sc.effects);
      sc.effects.forEach((e, i) => {
        if (e.source === 'choice') errors.push(`${w}.effects[${i}]：シーンに入ったときの効果に choice は使えません（選択と関係なく起きる変化のため。付録A-15）`);
      });
    }
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
        nextRef(ow, sc, o.next);
      }
    }
  }
}

/** 文中の数字（7,480 や 22.7 のような区切りも1つとして扱う）。ルビの読みは除く */
export function numbersIn(text: string): string[] {
  const plain = text.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
  return plain.match(/\d+(?:[.,]\d+)*/g) ?? [];
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
      if (visibleLines(content, s, scene).length === 0) throw new Error(`${pos.eventId}/${scene.id}：表示できる吹き出しがありません`);
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

/**
 * 進行を左右するフラグ：イベントの発生条件・選択肢の表示条件・分岐の条件で読まれるもの。
 * 効果の when や確率の補正で読まれるフラグは、進む先を変えない（確率の結果は両方試す）。
 */
function flowFlags(content: Content): Set<string> {
  const out = new Set<string>();
  const add = (src?: string) => {
    if (!src) return;
    for (const r of collectRefs(parseFlagExpr(src))) if (r.ns === 'flags') out.add(r.name);
  };
  for (const ch of content.chapters)
    for (const ev of ch.events) {
      add(ev.requires);
      for (const sc of ev.scenes) {
        sc.branches?.forEach((b) => add(b.when));
        sc.choices?.forEach((c) => add(c.requires));
      }
    }
  return out;
}

/** 進行に関係する部分だけで状態を同一視する（パラメーターや、進行に影響しないフラグは除く） */
function flowKey(s: RunState, relevant: Set<string>): string {
  const f: Record<string, unknown> = {};
  for (const k of Object.keys(s.flags).sort()) if (relevant.has(k)) f[k] = s.flags[k];
  return JSON.stringify([s.position, f]);
}

/** 属性の全組み合わせ（家庭の条件は「すべてなし」と「すべてあり」の2通りで代表させる） */
export function sampleProfiles(content: Content): Profile[] {
  const look = content.cast.find((c) => c.id === 'me')?.look;
  if (!look) return [];
  const out: Profile[] = [];
  for (const gender of GENDERS)
    for (const body of BODIES)
      for (const attractedTo of ATTRACTIONS)
        for (const heavy of [false, true])
          out.push({
            name: 'テスト',
            gender,
            body,
            attractedTo,
            economy: heavy ? 'hardship' : 'middle',
            singleParent: heavy,
            familyCare: heavy,
            witnessedDV: heavy,
            talkAboutSex: !heavy,
            look,
          });
  return out;
}

/**
 * 各属性 × 社会条件の全組み合わせ × 全選択 × 確率の両方の結果で、
 * 最初の章から最後の章のふりかえりまで到達できることを確かめる。
 */
export function reachability(content: Content, errors: string[], limit = 500_000): void {
  const relevant = flowFlags(content);
  for (const profile of sampleProfiles(content)) {
    for (const conditions of conditionCombinations(content)) {
      const start = createRun(content, { profile, seed: '0'.repeat(32), conditions: conditions as Record<string, string> });
      const label = `到達性：${profile.gender}/${profile.body}/${profile.attractedTo}/${profile.economy}（${JSON.stringify(conditions)}）`;
      const visited = new Set<string>();
      const stack: { s: RunState; path: string[] }[] = [{ s: start, path: [] }];
      let finished = false;
      while (stack.length) {
        const { s, path } = stack.pop()!;
        const key = flowKey(s, relevant);
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
          for (const a of acts)
            for (const next of runAllOutcomes(a, s)) {
              // 進行に関係しない記録は捨てて、次の複製を軽くする
              next.ledger = [];
              next.chanceLog = [];
              next.choices = {};
              stack.push({ s: next, path: [...path, a.label] });
            }
        } catch (err) {
          errors.push(`${label}：${(err as Error).message}／経路：${path.slice(-4).join(' > ')}`);
          return;
        }
      }
      if (!finished) errors.push(`${label}：最後の章まで到達できません`);
    }
  }
}
