// フェーズ2：標準ルート（§6.8）、2周目と比較（§6.5・§7.10）、19〜35歳の確率ノード（§10.4）。
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { playThrough, realContent } from '../helpers';
import { createRun, currentScene, visibleChoices } from '../../src/engine/progression';
import { autoPlay, standardRoute, standardRoutes, trajectory } from '../../src/engine/standard';
import { compareRuns, startReplay, switchableConditions } from '../../src/engine/replay';
import type { RunState } from '../../src/engine/types';

const real = realContent();
const seedArb = fc.stringMatching(/^[0-9a-f]{32}$/);
const SEED = '0'.repeat(32);

/** 指定したイベントで、指定した選択肢IDを選び、ほかは最初の選択肢で進める */
function playPicking(protagonist: RunState['protagonist'], picks: Record<string, string>, conditions = {}, seed = SEED): RunState {
  return playThrough(real, createRun(real, { protagonist, seed, conditions }), (n, s) => {
    const sc = currentScene(real, s)!;
    const want = picks[`${s.position.eventId}/${sc.id}`];
    if (!want) return 0;
    const i = visibleChoices(real, s, sc).findIndex((c) => c.id === want);
    if (i < 0) throw new Error(`選べません：${want}`);
    return i;
  });
}

describe('標準ルート（§6.8、付録A-19）', () => {
  it('標準ルートの計算は、プレイ中の周回の結果に影響しない', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom('minami', 'haruto', 'yu', 'kei' as const), (seed, p) => {
        const run = playThrough(real, createRun(real, { protagonist: p, seed }), () => 0);
        const before = JSON.stringify(run);
        standardRoutes(real, run);
        expect(JSON.stringify(run)).toBe(before);
      }),
      { numRuns: 20 },
    );
  });

  it('主人公以外の3人の軌跡を、同じ seed で計算する', () => {
    const run = playThrough(real, createRun(real, { protagonist: 'yu', seed: SEED }), () => 0);
    const routes = standardRoutes(real, run);
    expect(Object.keys(routes).sort()).toEqual(['haruto', 'kei', 'minami']);
    expect(routes.kei!.seed).toBe(run.seed);
    expect(routes.kei!.position.step).toBe('finished');
  });

  it('ハルトで遊んで19歳で「振り返る」を選ぶと、ミナミの標準ルートにつきまといは起きない', () => {
    const reflect = playPicking('haruto', { 'E19-MH-ESCALATE/h-choose': 'reflect' });
    expect(reflect.flags.harutoRoute).toBe('stopped');
    expect(standardRoute(real, reflect, 'minami').completedEvents).not.toContain('E21-MINAMI-STALKING');
    const blame = playPicking('haruto', { 'E19-MH-ESCALATE/h-choose': 'blame' });
    expect(standardRoute(real, blame, 'minami').completedEvents).toContain('E21-MINAMI-STALKING');
  });

  it('ミナミで遊ぶと、ハルトの標準ルートは、ミナミの側で決まった「ハルトの決定」に合う（付録B-32）', () => {
    for (const seed of ['0'.repeat(32), '1'.repeat(32), '2'.repeat(32), '3'.repeat(32)]) {
      const run = playThrough(real, createRun(real, { protagonist: 'minami', seed }), () => 0);
      expect(standardRoute(real, run, 'haruto').flags.harutoRoute).toBe(run.flags.harutoRoute);
    }
  });

  it('ユウで遊ぶと、ミナミとハルトの標準ルートで、ハルトの行動がそろう', () => {
    for (const seed of ['0'.repeat(32), '1'.repeat(32), '2'.repeat(32), '3'.repeat(32)]) {
      const run = playThrough(real, createRun(real, { protagonist: 'yu', seed }), () => 0);
      const r = standardRoutes(real, run);
      expect(r.haruto!.flags.harutoRoute).toBe(r.minami!.flags.harutoRoute);
    }
  });

  it('ハルトで遊んで17歳で押した場合、ミナミの標準ルートでもミナミは帰る場面になる', () => {
    const run = playPicking('haruto', { 'E17-MH-TALK/h-notYet': 'press' });
    expect(run.flags.harutoConsent17).toBe('pressed');
    expect(standardRoute(real, run, 'minami').choices['E17-MH-TALK/m-choose']).toBe('notYet');
    expect(standardRoute(real, run, 'minami').ledger.some((e) => e.eventId === 'E17-MH-TALK' && e.sceneId === 'm-respected')).toBe(false);
  });

  it('軌跡は開始時と8章ぶんの点を持つ', () => {
    const run = autoPlay(real, createRun(real, { protagonist: 'kei', seed: SEED }));
    const t = trajectory(real, run);
    expect(t.map((p) => p.age)).toEqual([0, 16, 17, 19, 21, 24, 27, 30, 35]);
    expect(t.at(-1)!.params).toEqual(run.params);
  });
});

describe('2周目と比較（§6.5・§7.9・§7.10）', () => {
  it('切り替えられる社会条件は、その主人公に効くものだけ', () => {
    expect(switchableConditions(real, 'yu').map((c) => c.id)).toEqual(['sexEducation', 'partnership']);
    expect(switchableConditions(real, 'kei').map((c) => c.id)).toEqual(['sexEducation', 'ecAccess', 'parentalLeave']);
  });

  it('「同じ偶然で」はシードとアバターのソルトを引き継ぐ', () => {
    const prev = autoPlay(real, createRun(real, { protagonist: 'minami', seed: SEED, avatarSalts: { yu: 3 } }));
    const same = startReplay(real, prev, { kind: 'condition', condition: 'sexEducation', to: 'notTaught', sameSeed: true });
    expect(same.seed).toBe(prev.seed);
    expect(same.avatarSalts.yu).toBe(3);
    expect(same.conditions.sexEducation).toBe('notTaught');
    expect(same.replayOf).toEqual({ runId: prev.runId, changed: { condition: 'sexEducation', from: 'taught', to: 'notTaught' }, sameSeed: true });
    const fresh = startReplay(real, prev, { kind: 'condition', condition: 'sexEducation', to: 'notTaught', sameSeed: false });
    expect(fresh.seed).not.toBe(prev.seed);
  });

  it('同じ偶然で条件だけ変えると、比較で差が開いた章が出る', () => {
    const a = autoPlay(real, createRun(real, { protagonist: 'minami', seed: SEED }));
    const b = autoPlay(real, startReplay(real, a, { kind: 'condition', condition: 'sexEducation', to: 'notTaught', sameSeed: true }));
    const diff = compareRuns(real, a, b);
    const c17 = diff.find((d) => d.age === 17)!;
    expect(c17.widened).toBe(true);
    expect(c17.widenedParams).toContain('autonomy');
    expect(c17.factorDiff.autonomy.society).toBe(-10);
    expect(diff.find((d) => d.age === 16)!.widened).toBe(false);
  });

  it('比較では、結果か確率が違った確率ノードを挙げる', () => {
    const a = autoPlay(real, createRun(real, { protagonist: 'yu', seed: SEED, conditions: { partnership: 'available' } }));
    const b = autoPlay(real, startReplay(real, a, { kind: 'condition', condition: 'partnership', to: 'notAvailable', sameSeed: true }));
    const c24 = compareRuns(real, a, b).find((d) => d.age === 24)!;
    expect(c24.chanceDiffs.map((c) => c.nodeId)).toEqual(['CH-RESIDENCE']);
  });
});

describe('19〜35歳の確率ノード（§10.4、付録A-17〜A-22）', () => {
  it('CH-SAKI-DECISION：ケイのどの選択でも、確率は44.1%のまま', () => {
    for (const pick of ['listen', 'share', 'distance']) {
      const run = playThrough(real, createRun(real, { protagonist: 'kei', seed: SEED }), (n, s) => {
        const sc = currentScene(real, s)!;
        if (s.position.eventId === 'E21-KS-PREGNANCY' && sc.id === 'choose') return sc.choices!.findIndex((c) => c.id === pick);
        return 0;
      }, { override: (id) => (id === 'CH-CONTRACEPTION' || id === 'CH-EC' ? true : undefined) });
      const node = run.chanceLog.find((c) => c.nodeId === 'CH-SAKI-DECISION')!;
      expect(node.finalP).toBe(0.441);
      expect(node.actorLabel).toBe('サキの決定');
    }
  });

  it('CH-RESIDENCE：制度のある自治体を選ぶと100%、社会条件で固定すると100%／0%', () => {
    const chose = playPicking('yu', { 'E24-YU-WORKPLACE/start': 'choose' });
    expect(chose.chanceLog.find((c) => c.nodeId === 'CH-RESIDENCE')!.finalP).toBe(1);
    expect(chose.flags.partnershipLocal).toBe(true);
    const none = playPicking('yu', {}, { partnership: 'notAvailable' });
    expect(none.chanceLog.find((c) => c.nodeId === 'CH-RESIDENCE')!.finalP).toBe(0);
    expect(none.flags.partnershipLocal).toBe(false);
    expect(none.completedEvents).toContain('E30-YU-PARTNERSHIP');
  });

  it('CH-RESIDENCE：「どこにも制度がない」社会では、制度のある自治体を選ぶ選択肢が出ない', () => {
    const s = createRun(real, { protagonist: 'yu', seed: SEED, conditions: { partnership: 'notAvailable' } });
    const ev = real.chapters.find((c) => c.age === 24)!.events.find((e) => e.id === 'E24-YU-WORKPLACE')!;
    const start = ev.scenes.find((x) => x.id === 'start')!;
    s.position = { ...s.position, age: 24, eventId: ev.id, sceneId: 'start', step: 'scene' };
    expect(visibleChoices(real, s, start).map((c) => c.id)).toEqual(['stay']);
  });

  it('CH-LBW：16歳で食事をさらに減らした場合だけ、確率が9.8%から14.9%になる（要因は選択）', () => {
    const extreme = playPicking('minami', { 'E16-MINAMI-DIET/choose': 'keepOn', 'E27-MINAMI-DECIDE/choose': 'now' });
    const node = extreme.chanceLog.find((c) => c.nodeId === 'CH-LBW')!;
    expect(node.base).toBe(0.098);
    expect(node.finalP).toBe(0.149);
    expect(node.modifiersApplied[0]).toEqual(expect.objectContaining({ source: 'choice', statRef: 'S30' }));
    const nurse = playPicking('minami', { 'E16-MINAMI-DIET/choose': 'nurse', 'E27-MINAMI-DECIDE/choose': 'now' });
    expect(nurse.chanceLog.find((c) => c.nodeId === 'CH-LBW')!.finalP).toBe(0.098);
  });

  it('CH-LBW・出産の結果では、ミナミのパラメーターを動かさない', () => {
    const run = playPicking('minami', { 'E27-MINAMI-DECIDE/choose': 'now' });
    expect(run.ledger.filter((e) => e.eventId === 'E30-MINAMI-BRANCH' && e.source === 'chance')).toEqual([]);
  });

  it('CH-ART：続けるたびに負担が記録され、6回を超えない', () => {
    // 27歳で「いずれ考える」→ 35歳で治療を始め、毎回「続ける」。出産に至らない結果に固定する
    const run = playThrough(real, createRun(real, { protagonist: 'minami', seed: SEED }), (n, s) => {
      const sc = currentScene(real, s)!;
      return s.position.eventId === 'E27-MINAMI-DECIDE' ? sc.choices!.findIndex((c) => c.id === 'later') : 0;
    }, { override: (id) => (id.startsWith('CH-ART') ? false : undefined) });
    const art = run.chanceLog.filter((c) => c.nodeId.startsWith('CH-ART'));
    expect(art.map((c) => c.nodeId)).toEqual(['CH-ART-1', 'CH-ART-2', 'CH-ART-3', 'CH-ART-4', 'CH-ART-5', 'CH-ART-6']);
    const burden = run.ledger.filter((e) => e.eventId === 'E35-MINAMI-ART' && e.param === 'body');
    expect(burden).toHaveLength(6);
    expect(burden.every((e) => e.source === 'choice' && e.statRef === 'S31')).toBe(true);
  });

  it('CH-PARTNER-WORK：ケイが父親のときだけ、24歳で判定する', () => {
    const father = playThrough(real, createRun(real, { protagonist: 'kei', seed: SEED }), () => 0, {
      override: (id) => ({ 'CH-CONTRACEPTION': true, 'CH-EC': true, 'CH-SAKI-DECISION': false } as Record<string, boolean>)[id],
    });
    expect(father.flags.keiFather).toBe(true);
    expect(father.chanceLog.find((c) => c.nodeId === 'CH-PARTNER-WORK')?.age).toBe(24);
    const notFather = playThrough(real, createRun(real, { protagonist: 'kei', seed: SEED }), () => 0, { override: (id) => (id === 'CH-CONTRACEPTION' ? false : undefined) });
    expect(notFather.chanceLog.some((c) => c.nodeId === 'CH-PARTNER-WORK')).toBe(false);
    expect(notFather.completedEvents).toContain('E21-KEI-STI');
  });
});
