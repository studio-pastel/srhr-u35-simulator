import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { invariantHolds, playThrough, rawContent, realContent } from '../helpers';
import { fixtureChapter19 } from '../fixtures/chance-chapter';
import { validateContent } from '../../src/engine/validate';
import {
  advanceScene,
  beginChapter,
  choose,
  createRun,
  currentScene,
  switchViewpoint,
} from '../../src/engine/progression';
import { CHARACTER_IDS } from '../../src/engine/schema';
import type { Content } from '../../src/engine/schema';
import type { RunState } from '../../src/engine/types';

const real = realContent();

function withFixture(): Content {
  const raw = rawContent();
  (raw.chapters as unknown[]).push(fixtureChapter19);
  const r = validateContent(raw, { production: false, allowUnverified: true });
  if (r.errors.length || !r.content) throw new Error(r.errors.join('\n'));
  return r.content;
}
const fixture = withFixture();

const seedArb = fc.stringMatching(/^[0-9a-f]{32}$/);
const charArb = fc.constantFrom(...CHARACTER_IDS);
const condArb = fc.record({
  sexEducation: fc.constantFrom('taught', 'notTaught'),
  ecAccess: fc.constantFrom('otc2026', 'prescriptionOnly'),
  parentalLeave: fc.constantFrom('easy', 'hard'),
});

describe('要因分解の不変条件（§6.3）', () => {
  it('任意の選択列・読まずに進む章で、初期値＋ledger＝params が常に成り立つ', () => {
    fc.assert(
      fc.property(seedArb, charArb, condArb, fc.array(fc.nat(), { minLength: 1, maxLength: 40 }), fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }), (seed, protagonist, conditions, picks, skips) => {
        for (const content of [real, fixture]) {
          let i = 0;
          const s0 = createRun(content, { protagonist, seed, conditions });
          expect(invariantHolds(content, s0)).toBe(true);
          playThrough(content, s0, (n) => picks[i++ % picks.length]! % n, {
            skipChapter: (age) => skips[[16, 17, 19].indexOf(age)] ?? false,
            onStep: (s) => expect(invariantHolds(content, s)).toBe(true),
          });
        }
      }),
      { numRuns: 150 },
    );
  });

  it('when を満たさない効果は記録しない', () => {
    // ケイ（familyCare: true）は生育条件の効果が付き、ミナミにはこのイベントがない
    const s = playThrough(real, createRun(real, { protagonist: 'kei', seed: '0'.repeat(32) }), () => 0);
    expect(s.ledger.some((e) => e.source === 'upbringing' && e.eventId === 'E16-KEI-CARE')).toBe(true);
    const notTaught = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32), conditions: { sexEducation: 'notTaught' } }), () => 0);
    expect(notTaught.ledger.some((e) => e.note === '授業で相談先を知った')).toBe(false);
  });
});

describe('確率と乱数（§6.4・§6.5）', () => {
  const keiRun = (seed: string, picks: number[], conditions = {}) => {
    let i = 0;
    return playThrough(fixture, createRun(fixture, { protagonist: 'kei', seed, conditions }), (n) => picks[i++ % picks.length]! % n);
  };

  it('前の章の選択を変えても、後の章の u は変わらない', () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.nat(), { minLength: 1, maxLength: 6 }), fc.array(fc.nat(), { minLength: 1, maxLength: 6 }), (seed, a, b) => {
        const ua = keiRun(seed, a).chanceLog.find((c) => c.nodeId === 'CH-CONTRACEPTION')!.u;
        const ub = keiRun(seed, b).chanceLog.find((c) => c.nodeId === 'CH-CONTRACEPTION')!.u;
        expect(ua).toBe(ub);
      }),
    );
  });

  it('同じ seed で社会条件だけを変えたとき、finalP が変わらないノードの結果は変わらない', () => {
    fc.assert(
      fc.property(seedArb, condArb, condArb, fc.array(fc.nat(), { minLength: 1, maxLength: 6 }), (seed, c1, c2, picks) => {
        const r1 = keiRun(seed, picks, c1);
        const r2 = keiRun(seed, picks, c2);
        for (const e1 of r1.chanceLog) {
          const e2 = r2.chanceLog.find((x) => x.nodeId === e1.nodeId);
          if (e2 && e2.finalP === e1.finalP) expect(e2.happened).toBe(e1.happened);
        }
      }),
    );
  });

  it('確率ノードの結果効果は、YAML の記述に関係なく chance として記録する', () => {
    const s = playThrough(fixture, createRun(fixture, { protagonist: 'kei', seed: '0'.repeat(32) }), () => 0, { override: () => true });
    const e = s.ledger.find((x) => x.note === 'トラブルが起きた');
    expect(e?.source).toBe('chance');
  });

  it('modifier の適用で、確率を変えた要因と前後の値を記録する', () => {
    const s = playThrough(fixture, createRun(fixture, { protagonist: 'kei', seed: '0'.repeat(32) }), () => 0, { override: () => true });
    const ec = s.chanceLog.find((c) => c.nodeId === 'CH-EC')!;
    expect(ec.modifiersApplied).toEqual([expect.objectContaining({ source: 'choice', statRef: 'S26', from: 1, to: 0.16 })]);
    expect(ec.finalP).toBeCloseTo(0.16);
  });
});

describe('CH-EC（§10.4）', () => {
  /** E17-KEI-MYTH で「信じる」を選び、19歳で避妊のトラブルが起きたときに通るシーン */
  function scenesVisited(conditions: Record<string, string>, believe: boolean): string[] {
    const visited: string[] = [];
    playThrough(
      fixture,
      createRun(fixture, { protagonist: 'kei', seed: '0'.repeat(32), conditions }),
      (n, s) => {
        const sc = currentScene(fixture, s)!;
        if (s.position.eventId === 'E17-KEI-MYTH') return sc.choices!.findIndex((c) => c.id === (believe ? 'believe' : 'research'));
        return 0;
      },
      { override: () => true, onStep: (s) => s.position.eventId === 'E19-TEST-KS' && s.position.step === 'scene' && visited.push(s.position.sceneId) },
    );
    return visited;
  }

  it('withdrawal かつ知識なしのとき、緊急避妊の選択肢が出ない', () => {
    expect(scenesVisited({ sexEducation: 'notTaught' }, true)).not.toContain('ecAsk');
  });
  it('学校で学んでいれば、withdrawal でも選択肢が出る', () => {
    expect(scenesVisited({ sexEducation: 'taught' }, true)).toContain('ecAsk');
  });
  it('自分で調べた場合は、選択肢が出る', () => {
    expect(scenesVisited({ sexEducation: 'notTaught' }, false)).toContain('ecAsk');
  });
});

describe('視点切替と P7（§6.7）', () => {
  /** ミナミで E17 まで進め、視点切替イベントの冒頭の状態を返す */
  function atE17(content: Content, protagonist: 'minami' | 'haruto'): RunState {
    let s = createRun(content, { protagonist, seed: '0'.repeat(32) });
    s = playUntil(content, s, (x) => x.position.eventId === 'E17-MH-CONTROL' && x.position.step === 'scene');
    return s;
  }
  function playUntil(content: Content, s: RunState, stop: (s: RunState) => boolean): RunState {
    let cur = s;
    let found: RunState | null = null;
    try {
      playThrough(content, cur, () => 0, {
        onStep: (x) => {
          if (!found && stop(x)) {
            found = x;
            throw new Error('stop');
          }
        },
      });
    } catch (e) {
      if ((e as Error).message !== 'stop') throw e;
    }
    if (!found) throw new Error('到達しませんでした');
    return found;
  }

  it('ミナミの視点の選択列をすべて試しても、harutoControl17・harutoRoute は変わらない', () => {
    for (const content of [real, fixture]) {
      const results = new Set<string>();
      for (const pick17 of [0, 1, 2]) {
        for (const pick19 of [0, 1, 2]) {
          let s = createRun(content, { protagonist: 'minami', seed: '1'.repeat(32) });
          s = playThrough(content, s, (n, x) => {
            if (x.position.eventId === 'E17-MH-CONTROL') return pick17;
            if (x.position.eventId === 'E19-TEST-MH') return pick19;
            return 0;
          });
          results.add(JSON.stringify([s.flags.harutoControl17, s.flags.harutoRoute]));
        }
      }
      expect(results.size).toBe(1);
    }
  });

  it('ミナミのプレイで視点を切り替えなかった場合は、ハルトの canonical を使う', () => {
    const s = playThrough(fixture, createRun(fixture, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0);
    expect(s.flags.harutoControl17).toBe('continued');
    expect(s.flags.harutoRoute).toBe('continued');
  });

  it('ハルトの視点で選んだ場合は、その選択が harutoControl17 を決める', () => {
    let s = atE17(real, 'minami');
    s = switchViewpoint(real, s, 'haruto');
    // h-start → h-think → (h-know) → h-choose
    while (!currentScene(real, s)!.choices) s = advanceScene(real, s);
    const before = { ...s.params };
    s = choose(real, s, 'stop');
    expect(s.flags.harutoControl17).toBe('stopped');
    expect(s.params).toEqual(before); // ハルトの選択でミナミのパラメーターは動かない
    s = advanceScene(real, s); // h-stop → END
    expect(s.position.viewpoint).toBe('minami'); // 読み終えたら主人公の視点に戻る
    expect(s.position.tracksDone?.haruto).toBe(true);
  });

  it('ハルトを主人公にした場合、ミナミの視点の選択でパラメーターは動かない', () => {
    let s = atE17(real, 'haruto');
    s = switchViewpoint(real, s, 'minami');
    while (!currentScene(real, s)!.choices) s = advanceScene(real, s);
    const before = { ...s.params };
    s = choose(real, s, 'friend');
    expect(s.params).toEqual(before);
    expect(s.flags.minamiResponse17).toBe('toldFriend');
  });
});

describe('読まずに進む章（§6.2-3、付録A-4）', () => {
  it('canonical で自動進行し、効果は本来の要因のまま skipped 付きで記録する', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) }), () => 1, { skipChapter: (a) => a === 16 });
    expect(s.skippedChapters).toEqual([16]);
    const e16 = s.ledger.filter((e) => e.age === 16);
    expect(e16.length).toBeGreaterThan(0);
    expect(e16.every((e) => e.skipped)).toBe(true);
    expect(e16.some((e) => e.source === 'upbringing')).toBe(true);
    expect(s.flags.harutoToldHome).toBe(false); // canonical は「見ないふりをする」
    expect(s.ledger.filter((e) => e.age === 17).every((e) => !e.skipped)).toBe(true);
  });

  it('視点切替のある章を読まずに進んでも、両方の視点が canonical で解決される', () => {
    const run = createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) });
    const s = playThrough(real, run, () => 0, { skipChapter: (a) => a === 17 });
    expect(s.flags.minamiResponse17).toBe('spoke');
    expect(s.flags.harutoControl17).toBe('continued');
  });
});

describe('主人公ごとの通しプレイ（フェーズ1：17歳の章末まで）', () => {
  it.each(CHARACTER_IDS)('%s は16歳から17歳のふりかえりまで進める', (id) => {
    const steps: string[] = [];
    const s = playThrough(real, createRun(real, { protagonist: id, seed: '0'.repeat(32) }), () => 0, { onStep: (x) => steps.push(`${x.position.age}:${x.position.step}`) });
    expect(s.position.step).toBe('finished');
    expect(steps).toContain('17:review');
    expect(s.completedEvents).toContain('E16-ALL-SEXED');
  });

  it('章トップで、トリガー注意のある章を判定する', () => {
    const s = createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) });
    const after = beginChapter(real, s, false);
    expect(after.position.eventId).toBe('E16-ALL-SEXED');
  });
});
