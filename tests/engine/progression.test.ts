import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { invariantHolds, playThrough, rawContent, realContent } from '../helpers';
import { validateContent } from '../../src/engine/validate';
import {
  advanceReview,
  advanceScene,
  advancePeek,
  advanceStatCards,
  beginChapter,
  chapterResourceTags,
  choose,
  createRun,
  currentScene,
} from '../../src/engine/progression';
import { AGES, CHARACTER_IDS } from '../../src/engine/schema';
import type { Content } from '../../src/engine/schema';
import type { RunState } from '../../src/engine/types';

const real = realContent();

const seedArb = fc.stringMatching(/^[0-9a-f]{32}$/);
const charArb = fc.constantFrom(...CHARACTER_IDS);
const condArb = fc.record({
  sexEducation: fc.constantFrom('taught', 'notTaught'),
  ecAccess: fc.constantFrom('otc2026', 'prescriptionOnly'),
  parentalLeave: fc.constantFrom('easy', 'hard'),
  partnership: fc.constantFrom('byResidence', 'available', 'notAvailable'),
});

describe('要因分解の不変条件（§6.3）', () => {
  it('任意の選択列・読まずに進む章で、初期値＋ledger＝params が常に成り立つ', () => {
    fc.assert(
      fc.property(seedArb, charArb, condArb, fc.array(fc.nat(), { minLength: 1, maxLength: 60 }), fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }), (seed, protagonist, conditions, picks, skips) => {
        let i = 0;
        const s0 = createRun(real, { protagonist, seed, conditions });
        expect(invariantHolds(real, s0)).toBe(true);
        playThrough(real, s0, (n) => picks[i++ % picks.length]! % n, {
          skipChapter: (age) => skips[(AGES as readonly number[]).indexOf(age)] ?? false,
          onStep: (s) => expect(invariantHolds(real, s)).toBe(true),
        });
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
    return playThrough(real, createRun(real, { protagonist: 'kei', seed, conditions }), (n) => picks[i++ % picks.length]! % n);
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
    // source を省いた結果効果を足したコンテンツで確かめる
    const raw = rawContent() as { chapters: { age: number; events: { id: string; scenes: { id: string; chance?: { outcomes: { happens: { effects?: unknown[] } } } }[] }[] }[] };
    const ks = raw.chapters.find((c) => c.age === 19)!.events.find((e) => e.id === 'E19-KS-CONTRACEPTION')!;
    ks.scenes.find((x) => x.id === 'trouble')!.chance!.outcomes.happens.effects = [{ param: 'psychSafety', sign: -1, size: 'S', note: 'トラブルが起きた' }];
    const content = validateContent(raw, { production: false, allowUnverified: true }).content!;
    const s = playThrough(content, createRun(content, { protagonist: 'kei', seed: '0'.repeat(32) }), () => 0, { override: () => true });
    expect(s.ledger.find((x) => x.note === 'トラブルが起きた')?.source).toBe('chance');
  });

  it('modifier の適用で、確率を変えた要因と前後の値を記録する', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'kei', seed: '0'.repeat(32) }), () => 0, { override: () => true });
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
      real,
      createRun(real, { protagonist: 'kei', seed: '0'.repeat(32), conditions }),
      (n, s) => {
        const sc = currentScene(real, s)!;
        if (s.position.eventId === 'E17-KEI-MYTH') return sc.choices!.findIndex((c) => c.id === (believe ? 'believe' : 'research'));
        // 19歳でサキと話すときも「外に出せば、大丈夫だよ」を選ぶ（17歳で信じた場合だけ出る選択肢）
        if (believe && s.position.eventId === 'E19-KS-CONTRACEPTION' && sc.id === 'start') return 2;
        return 0;
      },
      { override: () => true, onStep: (s) => s.position.eventId === 'E19-KS-CONTRACEPTION' && s.position.step === 'scene' && visited.push(s.position.sceneId) },
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
    const results = new Set<string>();
    for (const pick17 of [0, 1, 2]) {
      for (const pick19 of [0, 1, 2]) {
        for (const pick21 of [0, 1]) {
          let s = createRun(real, { protagonist: 'minami', seed: '1'.repeat(32) });
          s = playThrough(real, s, (n, x) => {
            if (x.position.eventId === 'E17-MH-CONTROL') return pick17;
            if (x.position.eventId === 'E19-MH-ESCALATE') return pick19;
            if (x.position.eventId === 'E21-MINAMI-STALKING') return pick21;
            return 0;
          });
          results.add(JSON.stringify([s.flags.harutoControl17, s.flags.harutoRoute]));
        }
      }
    }
    expect(results.size).toBe(1);
  });

  it('ミナミのプレイでは、17歳のハルトは canonical、19歳のハルトは確率（ハルトの決定）で決まる（付録B-12）', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0);
    expect(s.flags.harutoControl17).toBe('continued');
    const node = s.chanceLog.find((c) => c.nodeId === 'CH-HARUTO19')!;
    expect(node.actorLabel).toBe('ハルトの決定');
    expect(s.flags.harutoRoute).toBe(node.happened ? 'continued' : 'stopped');
  });

  it('CH-HARUTO19：基本の確率23.0%に、生育条件と社会条件のオッズ比を掛ける。ミナミの選択は使わない', () => {
    for (const sexEducation of ['taught', 'notTaught']) {
      const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32), conditions: { sexEducation } }), () => 0);
      const node = s.chanceLog.find((c) => c.nodeId === 'CH-HARUTO19')!;
      expect(node.base).toBe(0.23);
      expect(node.modifiersApplied.map((m) => m.source)).toEqual(sexEducation === 'taught' ? ['upbringing', 'society'] : ['upbringing']);
      // 0.23 → オッズ比1.92 → 約36.4%、さらに 0.75 → 約30.1%
      expect(node.finalP).toBeCloseTo(sexEducation === 'taught' ? 0.3008 : 0.3645, 3);
    }
  });

  it('ハルトで遊ぶときは確率を使わず、プレイヤーの選択で決まる', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) }), () => 0);
    expect(s.chanceLog.some((c) => c.nodeId === 'CH-HARUTO19')).toBe(false);
    expect(s.flags.harutoRoute).toBe('stopped'); // 最初の選択肢「自分の言動を振り返る」
  });

  it('相手の視点は、主人公の場面が終わったあとに「そのころ」として出る。選択肢はなく、パラメーターも動かない（付録B-11）', () => {
    let s = atE17(real, 'minami');
    expect(s.position.viewpoint).toBe('minami');
    while (s.position.step === 'scene') s = playStep(s);
    expect(s.position.step).toBe('peek');
    expect(s.position.eventId).toBe('E17-MH-CONTROL');
    const track = s.position.peek!.find((t) => t.viewpoint === 'haruto')!;
    // ハルトの視点は canonical（確かめつづける）で進んでいる
    expect(track.scenes.find((x) => x.sceneId === 'h-choose')?.choiceId).toBe('keepChecking');
    expect(s.flags.harutoControl17).toBe('continued');
    const before = { ...s.params };
    const ledger = s.ledger.length;
    s = advancePeek(real, s);
    expect(s.params).toEqual(before);
    expect(s.ledger.length).toBe(ledger);
    expect(s.completedEvents).toContain('E17-MH-CONTROL');
  });

  it('ハルトを主人公にした場合、ミナミの視点の効果も選択もハルトに付かない', () => {
    let s = atE17(real, 'haruto');
    expect(s.position.viewpoint).toBe('haruto');
    expect(s.position.sceneId).toBe('h-start');
    while (s.position.step === 'scene') s = playStep(s);
    expect(s.position.step).toBe('peek');
    expect(s.flags.minamiResponse17).toBe('spoke'); // ミナミの canonical
    expect(s.ledger.some((e) => e.eventId === 'E17-MH-CONTROL' && e.sceneId.startsWith('m-'))).toBe(false);
  });

  it('するかどうか（E17-MH-TALK）：ミナミで遊ぶと、ハルトはどの答えでも同意を確かめる（P7・付録B-30）', () => {
    for (const pick of [0, 1, 2]) {
      const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '2'.repeat(32) }), (n, x) => (x.position.eventId === 'E17-MH-TALK' ? pick : 0));
      expect(s.flags.harutoConsent17 ?? 'respected').toBe('respected');
      // するか・しないかに、選択による負の効果を付けない
      expect(s.ledger.some((e) => e.eventId === 'E17-MH-TALK' && e.source === 'choice' && e.delta < 0)).toBe(false);
    }
  });

  it('するかどうか：ハルトで「理由を聞きつづける」を選ぶと、ミナミの側は帰る場面になり、学び直す選択肢が出る', () => {
    let s = createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) });
    s = beginChapter(real, s, false);
    while (s.position.age === 16) s = playStep(s);
    s = beginChapter(real, s, false);
    expect(s.position.eventId).toBe('E17-MH-TALK');
    while (currentScene(real, s)!.id !== 'h-notYet') s = advanceScene(real, s);
    s = choose(real, s, 'press');
    expect(s.flags.harutoConsent17).toBe('pressed');
    expect(currentScene(real, s)!.choices!.map((c) => c.id)).toEqual(['apologize', 'blame']);
    s = choose(real, s, 'apologize');
    s = advanceScene(real, s);
    expect(s.position.step).toBe('peek');
    const minami = s.position.peek!.find((t) => t.viewpoint === 'minami')!;
    expect(minami.scenes.map((x) => x.sceneId)).toContain('m-pressed');
  });
});

/** 1ステップ進める（選択肢は最初のもの） */
function playStep(s: RunState): RunState {
  switch (s.position.step) {
    case 'chapterTop':
      return beginChapter(real, s, false);
    case 'scene': {
      const sc = currentScene(real, s)!;
      return sc.choices?.length ? choose(real, s, sc.choices[0]!.id) : advanceScene(real, s);
    }
    case 'peek':
      return advancePeek(real, s);
    case 'statCards':
      return advanceStatCards(real, s);
    case 'review':
      return advanceReview(real, s);
    default:
      throw new Error(s.position.step);
  }
}

describe('シーンに入ったときの効果と「他者の行為」（付録A-14・A-15）', () => {
  const harm = (s: RunState) => s.ledger.filter((e) => e.eventId === 'E17-MH-CONTROL' && e.source === 'others' && e.delta < 0);

  it('ミナミがどの選択をしても、束縛による心理的安全の低下は他者の行為として1回だけ記録される', () => {
    for (const pick of [0, 1, 2]) {
      const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), (n, x) => (x.position.eventId === 'E17-MH-CONTROL' ? pick : 0));
      expect(harm(s)).toEqual([expect.objectContaining({ param: 'psychSafety', delta: -20, source: 'others' })]);
      expect(s.ledger.some((e) => e.eventId === 'E17-MH-CONTROL' && e.source === 'choice' && e.delta < 0)).toBe(false);
    }
  });

  it('ハルトを主人公にした場合、ミナミの視点の効果はハルトに付かない', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) }), () => 0);
    expect(harm(s)).toEqual([]);
  });

  it('読まずに進んだ章でも、入ったときの効果は skipped 付きで記録される', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0, { skipChapter: (a) => a === 17 });
    expect(harm(s)).toEqual([expect.objectContaining({ skipped: true })]);
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

  it('読まずに進んだ章でも、その章の相談窓口のタグを集められる（付録A-11）', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'yu', seed: '0'.repeat(32) }), () => 0, { skipChapter: (a) => a === 17 });
    expect(chapterResourceTags(real, s, 17)).toEqual(['violence']);
    expect(chapterResourceTags(real, s, 16)).toEqual([]);
  });

  it('視点切替のある章を読まずに進んでも、両方の視点が canonical で解決される', () => {
    const run = createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) });
    const s = playThrough(real, run, () => 0, { skipChapter: (a) => a === 17 });
    expect(s.flags.minamiResponse17).toBe('spoke');
    expect(s.flags.harutoControl17).toBe('continued');
  });
});

describe('主人公ごとの通しプレイ（16〜35歳）', () => {
  it.each(CHARACTER_IDS)('%s は16歳から35歳のふりかえりまで進める', (id) => {
    const steps: string[] = [];
    const s = playThrough(real, createRun(real, { protagonist: id, seed: '0'.repeat(32) }), () => 0, { onStep: (x) => steps.push(`${x.position.age}:${x.position.step}`) });
    expect(s.position.step).toBe('finished');
    for (const a of AGES) expect(steps).toContain(`${a}:review`);
    expect(s.completedEvents).toContain('E35-ALL-REVIEW');
    expect(s.completedEvents).toContain('E16-ALL-SEXED');
  });

  it('章トップで、トリガー注意のある章を判定する', () => {
    const s = createRun(real, { protagonist: 'haruto', seed: '0'.repeat(32) });
    const after = beginChapter(real, s, false);
    expect(after.position.eventId).toBe('E16-ALL-SEXED');
  });
});

describe('要因分解の表示用の集計', () => {
  it('同じ要因の増えた分と減った分を相殺せずに分ける（加害と支援）', async () => {
    const { breakdown } = await import('../../src/engine/effects');
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), (n, x) =>
      x.position.eventId === 'E17-MH-CONTROL' ? 2 : 0,
    );
    const b = breakdown(s.ledger, (e) => e.eventId === 'E17-MH-CONTROL');
    expect(b.psychSafety.others).toEqual({ plus: 10, minus: -20 });
  });
});

describe('21歳の飲み会（付録B-33）', () => {
  it.each(CHARACTER_IDS)('%s も飲み会の場面を通る。飲み方の選択は、からだ・自己決定だけを動かす', (id) => {
    const s = playThrough(real, createRun(real, { protagonist: id, seed: '0'.repeat(32) }), (n, x) =>
      x.position.eventId === 'E21-ALL-DRINK' && currentScene(real, x)!.id === 'start' ? 2 : 0,
    );
    expect(s.completedEvents).toContain('E21-ALL-DRINK');
    expect(s.flags.drink21).toBe('along');
    const drink = s.ledger.filter((e) => e.eventId === 'E21-ALL-DRINK');
    expect(drink).toContainEqual(expect.objectContaining({ param: 'body', delta: -5, source: 'choice', statRef: 'S39' }));
    expect(drink.every((e) => ['body', 'autonomy', 'connection'].includes(e.param))).toBe(true);
  });
});

describe('24歳のケイとたばこ（付録B-33）', () => {
  it('勧められて吸い始めると keiSmokes が立ち、からだ −S（選択、S38）が付く。断れば付かない', () => {
    const pick = (take: boolean) =>
      playThrough(real, createRun(real, { protagonist: 'kei', seed: '0'.repeat(32) }), (n, x) =>
        x.position.eventId === 'E24-KEI-WORK' && currentScene(real, x)!.id === 'start' ? (take ? 1 : 0) : 0,
      );
    const took = pick(true);
    // 27歳の標準の選択は「禁煙外来に行ってみる」なので、最後は禁煙している
    expect(took.flags.keiQuit27).toBe(true);
    expect(took.ledger).toContainEqual(expect.objectContaining({ eventId: 'E27-KEI-PATH', param: 'body', delta: 10, source: 'choice', statRef: 'S38' }));
    expect(took.ledger).toContainEqual(expect.objectContaining({ eventId: 'E24-KEI-WORK', param: 'body', delta: -5, source: 'choice', statRef: 'S38' }));
    const declined = pick(false);
    expect(declined.flags.keiSmokes).toBe(false);
    expect(declined.flags.keiQuit27).toBeUndefined();
    expect(declined.ledger.some((e) => e.eventId === 'E24-KEI-WORK' && e.param === 'body')).toBe(false);
  });
});

describe('人との距離（付録B-9）', () => {
  it('ミナミの標準ルート：17歳でハルトが受けとめて近くなり、19歳か21歳で関係が終わる。リコは変わる', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0);
    expect(s.version).toBe(5);
    expect(s.bondLog).toContainEqual(expect.objectContaining({ age: 17, who: 'haruto', from: 2, to: 3 }));
    expect(s.bonds.haruto!.ended).toBe(true);
    // 関係が終わったあとは、それ以上変わらない
    const afterEnd = s.bondLog.findIndex((e) => e.who === 'haruto' && e.ended);
    expect(s.bondLog.slice(afterEnd + 1).some((e) => e.who === 'haruto')).toBe(false);
    // 近さは 0〜3 に収まる
    for (const b of Object.values(s.bonds)) expect(b.level).toBeGreaterThanOrEqual(0), expect(b.level).toBeLessThanOrEqual(3);
  });

  it('暴力の場面（束縛）では、ハルトとの近さは変わらない。パラメーターとは別に記録する', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0);
    expect(s.bondLog.some((e) => e.eventId === 'E17-MH-CONTROL' && e.who === 'haruto')).toBe(false);
    expect(s.ledger.every((e) => !('who' in e))).toBe(true);
  });

  it('相手の視点（そのころ）の選択では、主人公の距離は変わらない', () => {
    const s = playThrough(real, createRun(real, { protagonist: 'minami', seed: '0'.repeat(32) }), () => 0);
    expect(s.bondLog.some((e) => e.who === 'minami')).toBe(false);
  });
});
