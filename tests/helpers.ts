import { loadRawContent } from '../scripts/lib/load-content';
import { validateContent } from '../src/engine/validate';
import type { Content } from '../src/engine/schema';
import type { RunState } from '../src/engine/types';
import {
  advanceChance,
  advanceReview,
  advanceScene,
  advancePeek,
  beginChapter,
  choose,
  currentScene,
  visibleChoices,
  type ChanceOverride,
} from '../src/engine/progression';
import { PARAM_KEYS } from '../src/engine/schema';
import { getCharacter } from '../src/engine/progression';

export function rawContent(): Record<string, unknown> {
  return loadRawContent();
}

export function realContent(): Content {
  const r = validateContent(rawContent(), { production: false, allowUnverified: true });
  if (!r.content) throw new Error(r.errors.join('\n'));
  return r.content;
}

/** 不変条件（§6.3）：初期値 ＋ ledger の delta の合計 ＝ params の内部値 */
export function invariantHolds(content: Content, s: RunState): boolean {
  const init = getCharacter(content, s.protagonist).initial;
  return PARAM_KEYS.every((k) => init[k] + s.ledger.filter((e) => e.param === k).reduce((a, e) => a + e.delta, 0) === s.params[k]);
}

/**
 * pick(選択肢の数) で選択を決めながら、最後まで進める。
 * 各ステップで onStep を呼ぶ。章は読む（skip=false）か、skipChapter で決める。
 */
export function playThrough(
  content: Content,
  start: RunState,
  pick: (n: number, s: RunState) => number,
  opts: { skipChapter?: (age: number) => boolean; onStep?: (s: RunState) => void; override?: ChanceOverride } = {},
): RunState {
  let s = start;
  for (let guard = 0; s.position.step !== 'finished'; guard++) {
    if (guard > 10_000) throw new Error('終わりません');
    switch (s.position.step) {
      case 'chapterTop':
        s = beginChapter(content, s, opts.skipChapter?.(s.position.age) ?? false, opts.override);
        break;
      case 'scene': {
        const sc = currentScene(content, s)!;
        if (sc.choices?.length) {
          const vis = visibleChoices(content, s, sc);
          s = choose(content, s, vis[pick(vis.length, s) % vis.length]!.id, opts.override);
        } else s = advanceScene(content, s, opts.override);
        break;
      }
      case 'chance':
        s = advanceChance(content, s, opts.override);
        break;
      case 'peek':
        s = advancePeek(content, s);
        break;
      case 'review':
        s = advanceReview(content, s);
        break;
    }
    opts.onStep?.(s);
  }
  return s;
}
