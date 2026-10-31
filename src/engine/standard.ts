// 自動進行と、パラメーターの軌跡。
import type { Content } from './schema';
import type { Params, RunState } from './types';
import { paramsFrom } from './effects';
import { advanceReview, autoStep, beginChapter, sortedChapters } from './progression';

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

export interface TrajectoryPoint {
  /** 0 は開始時（初期値） */
  age: number;
  params: Params;
}

/** 開始時と各章の終わりのパラメーター（内部値） */
export function trajectory(content: Content, run: RunState): TrajectoryPoint[] {
  const initial = run.initial;
  const pts: TrajectoryPoint[] = [{ age: 0, params: { ...initial } }];
  for (const ch of sortedChapters(content)) pts.push({ age: ch.age, params: paramsFrom(initial, run.ledger, (e) => e.age <= ch.age) });
  return pts;
}
