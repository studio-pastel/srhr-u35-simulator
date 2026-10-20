// 他の主人公の標準ルート（§6.8、付録A-19）と、パラメーターの軌跡。
import { CHARACTER_IDS } from './constants';
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

/**
 * 主人公以外の1人の標準ルート。
 * - 確率ノードは同じ seed で解決する（§6.5 の方式のため、乱数を消費しない）。
 * - 視点切替のあるイベントでは、プレイヤーがその周回で選んだ選択を優先する（付録A-19）。
 *   例：ハルトで遊んで19歳で「振り返る」を選んだら、ミナミの標準ルートでもハルトは止まる。
 */
export function standardRoute(content: Content, run: RunState, character: CharacterId): RunState {
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
  s.pinnedChoices = shared;
  return autoPlay(content, s);
}

export function standardRoutes(content: Content, run: RunState): Partial<Record<CharacterId, RunState>> {
  const out: Partial<Record<CharacterId, RunState>> = {};
  for (const id of CHARACTER_IDS) if (id !== run.protagonist) out[id] = standardRoute(content, run, id);
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
