// 他の主人公の標準ルート（§6.8、付録A-19）と、パラメーターの軌跡。
import { CHARACTER_IDS, HARUTO_ONLY_FLAGS } from './constants';
import type { CharacterId, Content } from './schema';
import type { Params, RunState } from './types';
import { paramsFrom } from './effects';
import { advanceReview, autoStep, beginChapter, createRun, getCharacter, sortedChapters } from './progression';

/** 状態を、canonical の選択で最後まで自動で進める（元の状態は変えない） */
export function autoPlay(content: Content, start: RunState): RunState {
  let s = structuredClone(start);
  for (let guard = 0; s.position.step !== 'finished'; guard++) {
    if (guard > 20_000) throw new Error('自動進行が終わりません');
    if (s.position.step === 'chapterTop') s = beginChapter(content, s, false);
    else if (s.position.step === 'review') s = advanceReview(content, s);
    else autoStep(content, s);
  }
  return s;
}

/** ハルトの行動を表すフラグを、ある周回から取り出す */
function harutoFlags(run: RunState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of HARUTO_ONLY_FLAGS) if (run.flags[f] !== undefined) out[f] = run.flags[f];
  return out;
}

/** ハルトの視点の選択肢のうち、決まったハルトの行動（フラグ）と同じ結果になるものを選ぶ */
function pinsFromHarutoFlags(content: Content, flags: Record<string, unknown>): Record<string, string> {
  const pins: Record<string, string> = {};
  for (const ch of content.chapters)
    for (const ev of ch.events) {
      if (!ev.viewpointSwitch) continue;
      for (const sc of ev.scenes) {
        if (sc.viewpoint !== 'haruto' || !sc.choices) continue;
        const c = sc.choices.find((x) => {
          const set = Object.entries(x.setFlags ?? {}).filter(([k]) => (HARUTO_ONLY_FLAGS as readonly string[]).includes(k));
          return set.length > 0 && set.every(([k, v]) => flags[k] === v);
        });
        if (c) pins[`${ev.id}/${sc.id}`] = c.id;
      }
    }
  return pins;
}

/**
 * 主人公以外の1人の標準ルート。
 * - 確率ノードは同じ seed で解決する（§6.5 の方式のため、乱数を消費しない）。
 * - 視点切替のあるイベントでは、プレイヤーがその周回で選んだ選択を優先する（付録A-19）。
 * - ハルトの行動は、どの標準ルートでも1つにそろえる（付録B-32）。
 *   ハルトで遊んでいるときは、プレイヤーの選択（フラグ）をミナミの標準ルートに最初から入れておく。
 *   ハルト以外で遊んでいるときは、ミナミの側で決まった「ハルトの決定」（確率）にハルトの標準ルートを合わせる。
 *   `minamiRoute` は、ミナミの標準ルートを先に計算した結果（ユウ・ケイで遊んでいるとき）。
 */
export function standardRoute(content: Content, run: RunState, character: CharacterId, minamiRoute?: RunState): RunState {
  const shared: Record<string, string> = {};
  for (const ch of content.chapters)
    for (const ev of ch.events) {
      if (!ev.viewpointSwitch) continue;
      for (const sc of ev.scenes) {
        const key = `${ev.id}/${sc.id}`;
        if (run.choices[key]) shared[key] = run.choices[key];
      }
    }
  const s = createRun(content, { protagonist: character, seed: run.seed, conditions: run.conditions, avatarSalts: run.avatarSalts, runId: `${run.runId}-${character}` });
  s.conditions = { ...run.conditions };
  if (character === 'minami' && run.protagonist === 'haruto') Object.assign(s.flags, harutoFlags(run));
  if (character === 'haruto' && run.protagonist !== 'haruto') {
    const decided = run.protagonist === 'minami' ? run : minamiRoute;
    if (decided) Object.assign(shared, pinsFromHarutoFlags(content, harutoFlags(decided)));
  }
  s.pinnedChoices = shared;
  return autoPlay(content, s);
}

export function standardRoutes(content: Content, run: RunState): Partial<Record<CharacterId, RunState>> {
  const out: Partial<Record<CharacterId, RunState>> = {};
  // ミナミを先に計算する（ハルトの標準ルートを、ミナミの側で決まったハルトの行動に合わせるため）
  if (run.protagonist !== 'minami') out.minami = standardRoute(content, run, 'minami');
  for (const id of CHARACTER_IDS) if (id !== run.protagonist && id !== 'minami') out[id] = standardRoute(content, run, id, out.minami);
  return out;
}

export interface TrajectoryPoint {
  /** 0 は開始時（初期値） */
  age: number;
  params: Params;
}

/** 開始時と各章の終わりのパラメーター（内部値） */
export function trajectory(content: Content, run: RunState): TrajectoryPoint[] {
  const initial = getCharacter(content, run.protagonist).initial;
  const pts: TrajectoryPoint[] = [{ age: 0, params: { ...initial } }];
  for (const ch of sortedChapters(content)) pts.push({ age: ch.age, params: paramsFrom(initial, run.ledger, (e) => e.age <= ch.age) });
  return pts;
}
