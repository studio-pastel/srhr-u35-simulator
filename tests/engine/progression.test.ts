// 主人公1人と属性（付録B-43）の進行。
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { invariantHolds, makeProfile, playThrough, realContent } from '../helpers';
import { beginChapter, chapterResourceTags, createRun, currentScene, visibleChoices } from '../../src/engine/progression';
import { ATTRACTIONS, BODY_RESPECTS, FAMILY_STORIES, GENDERS, historyOf, initialOf, pregnancyPossible, randomProfile, SINGLE_PARENT_REASONS, singleParentOf, upOf, type Profile } from '../../src/engine/profile';
import { lifeStory } from '../../src/engine/lifestory';
import { compareRuns, startReplay } from '../../src/engine/replay';
import { autoPlay, trajectory } from '../../src/engine/standard';
import { sampleProfiles } from '../../src/engine/validate';
import type { RunState } from '../../src/engine/types';

const real = realContent();
const SEED = '0'.repeat(32);
const run = (over: Partial<Profile> = {}, opts: { conditions?: Record<string, string>; seed?: string } = {}) => createRun(real, { profile: makeProfile(over), seed: opts.seed ?? SEED, conditions: opts.conditions });
/** イベントとシーンを指定して選択肢を選ぶ。ほかは最初の選択肢 */
const picking = (picks: Record<string, string>) => (n: number, s: RunState) => {
  const key = `${s.position.eventId}/${s.position.sceneId}`;
  if (!picks[key]) return 0;
  const i = visibleChoices(real, s, currentScene(real, s)!).findIndex((c) => c.id === picks[key]);
  if (i < 0) throw new Error(`選択肢がありません：${key}#${picks[key]}`);
  return i;
};

describe('要因分解の不変条件（§6.3）', () => {
  it('任意の属性・選択列・読まずに進む章で、初期値＋ledger＝params が常に成り立つ', () => {
    const profiles = sampleProfiles(real);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: profiles.length - 1 }), fc.array(fc.nat(9), { minLength: 1, maxLength: 40 }), fc.boolean(), (pi, picks, skip) => {
        let i = 0;
        const s = playThrough(real, createRun(real, { profile: profiles[pi]!, seed: SEED }), (n) => picks[i++ % picks.length]! % n, { skipChapter: (a) => skip && a === 17 });
        return invariantHolds(real, s);
      }),
      { numRuns: 60 },
    );
  });

  it('はじめのパラメーターは、生い立ちの出来事で変わる（付録B-47）', () => {
    const base = real.characters[0]!.initial;
    const of = (o: Partial<Profile>) => initialOf(base, makeProfile({ bodyRespect: 'managed', ...o }));
    expect(of({ familyStory: 'twoStable' }).living).toBe(base.living + 5);
    expect(of({ familyStory: 'divorceMoved' }).living).toBe(base.living - 5);
    expect(of({ familyStory: 'divorceRelief' }).connection).toBe(base.connection + 2);
    expect(of({ familyStory: 'bereaved' }).living).toBe(base.living - 3);
    expect(of({ familyStory: 'twoCold' }).living).toBe(base.living);
    expect(of({ familyStory: 'twoCold' }).connection).toBe(base.connection - 5);
    expect(of({ bodyRespect: 'dismissed' }).body).toBe(base.body - 2);
    expect(of({ bodyRespect: 'managed' }).autonomy).toBe(base.autonomy - 5);
    expect(of({ bodyRespect: 'respected' }).autonomy).toBe(base.autonomy + 3);
  });
});

describe('属性で出来事が変わる（付録B-43）', () => {
  const events = (over: Partial<Profile>) => playThrough(real, run(over), () => 0).completedEvents;
  it('全ての属性の組み合わせで、最後まで進める', () => {
    for (const profile of sampleProfiles(real)) {
      const s = playThrough(real, createRun(real, { profile, seed: SEED }), () => 0);
      expect(s.position.step).toBe('finished');
      expect(invariantHolds(real, s)).toBe(true);
    }
  });
  it('月経の場面は、からだの条件で出る（性自認では決めない）', () => {
    expect(events({ gender: 'transMan', body: 'canBePregnant' })).toContain('E16-DIET');
    expect(events({ gender: 'man', body: 'cannot' })).not.toContain('E16-DIET');
    expect(events({ gender: 'man', body: 'cannot' })).toContain('E16-BODYWORRY');
  });
  it('制服の場面は、トランスジェンダーとノンバイナリーの人に出る', () => {
    for (const gender of ['transWoman', 'transMan', 'nonbinary'] as const) expect(events({ gender })).toContain('E16-UNIFORM');
    for (const gender of ['woman', 'man'] as const) expect(events({ gender })).not.toContain('E16-UNIFORM');
  });
  it('家庭の条件の場面は、選んだときだけ出る', () => {
    expect(events({ familyCare: true })).toContain('E16-CARE');
    expect(events({})).not.toContain('E16-CARE');
    expect(events({ familyStory: 'twoTense' })).toContain('E16-HOME');
    expect(events({})).not.toContain('E16-HOME');
  });
  it('16歳の授業の場面はない', () => {
    expect(real.chapters.flatMap((c) => c.events).some((e) => e.id === 'E16-ALL-SEXED')).toBe(false);
  });
  it('恋愛感情をあまり持たない・まだわからない人には、パートナーの場面が出ない', () => {
    for (const attractedTo of ['none', 'unsure'] as const) expect(events({ attractedTo })).not.toContain('E17-TALK');
    for (const attractedTo of ['men', 'women', 'any'] as const) expect(events({ attractedTo })).toContain('E17-TALK');
  });
  it('性の話は、付き合うと決めたあとにだけ出る。付き合わなければ出ない（付録B-48）', () => {
    const s = playThrough(real, run(), picking({ 'E17-ASKOUT/start': 'no' }));
    expect(s.completedEvents).toContain('E17-ASKOUT');
    expect(s.completedEvents).not.toContain('E17-TALK');
  });
  it('気になる人を秘密にしても、付き合うかどうかの場面は来る（付録B-48）', () => {
    for (const [attractedTo, pick] of [['men', 'dodgeSou'], ['women', 'dodgeSaki']] as const) {
      const s = playThrough(real, run({ attractedTo }), picking({ 'E16-CRUSH/start': pick }));
      expect(s.completedEvents).toContain('E17-ASKOUT');
    }
    const any = playThrough(real, run({ attractedTo: 'any' }), picking({ 'E16-CRUSH/start': 'dodgeAny', 'E16-CRUSH/dodgeWho': 'thinkSaki' }));
    expect(any.flags.partnerId).toBe('saki');
  });
  it('学校で学んだかどうかのフラグは、最初から入る', () => {
    expect(run({}, { conditions: { sexEducation: 'taught' } }).flags.knowsConsent).toBe(true);
    expect(run({}, { conditions: { sexEducation: 'notTaught' } }).flags.knowsConsent).toBe(false);
  });
  it('妊娠の可能性は、からだとパートナーの組み合わせで決まる', () => {
    expect(pregnancyPossible(makeProfile({ body: 'canBePregnant' }), 'sou')).toBe(true);
    expect(pregnancyPossible(makeProfile({ gender: 'man', body: 'cannot' }), 'sou')).toBe(false);
    expect(pregnancyPossible(makeProfile({ gender: 'man', body: 'cannot' }), 'saki')).toBe(true);
    expect(pregnancyPossible(makeProfile({ body: 'canBePregnant' }), 'saki')).toBe(false);
  });
});

describe('するかどうか（付録B-30）', () => {
  it('するか・しないかに、選択による負の効果を付けない', () => {
    for (const id of ['notYet', 'talk', 'silent']) {
      const s = playThrough(real, run(), picking({ 'E17-TALK/asked': id }));
      expect(s.ledger.some((e) => e.eventId === 'E17-TALK' && e.source === 'choice' && e.delta < 0)).toBe(false);
    }
  });
  it('自分から聞いて押すと、相手は先に帰り、学び直す選択肢が出る', () => {
    const s = playThrough(real, run(), picking({ 'E17-TALK/start': 'askFirst', 'E17-TALK/selfAsk': 'press', 'E17-TALK/press': 'apologize' }));
    expect(s.choices['E17-TALK/press']).toBe('apologize');
    expect(s.ledger).toContainEqual(expect.objectContaining({ eventId: 'E17-TALK', param: 'autonomy', source: 'choice', note: '自分の行動を見直した' }));
  });
});

describe('自分で選べない出来事（付録B-43）', () => {
  const node = (s: RunState, id: string) => s.chanceLog.find((c) => c.nodeId === id)!;
  const play = (gender: Profile['gender'], force?: boolean) => playThrough(real, run({ gender }), () => 0, { override: () => force });
  it('うつ病の確率は S54 の12か月の値で、トランスジェンダーとノンバイナリーには S57 の比を掛ける（付録B-46）', () => {
    expect(node(play('woman'), 'CH-MIND').finalP).toBe(0.03);
    expect(node(play('man'), 'CH-MIND').finalP).toBe(0.01);
    for (const g of ['transWoman', 'transMan', 'nonbinary'] as const) expect(node(play(g), 'CH-MIND').finalP).toBeCloseTo(0.021 * 2.82, 5);
  });
  it('性暴力は、どの性自認でも確率がある（付録B-43）', () => {
    for (const gender of GENDERS) expect(node(play(gender), 'CH-HARM').finalP).toBeGreaterThan(0);
    expect(node(play('woman'), 'CH-HARM').finalP).toBe(0.027);
    expect(node(play('man'), 'CH-HARM').finalP).toBe(0.005);
    expect(node(play('nonbinary'), 'CH-HARM').finalP).toBe(0.075);
  });
  it('起きたときの変化は、偶然として記録し、選択のせいにしない', () => {
    const s = play('woman', true);
    const harm = s.ledger.filter((e) => e.eventId === 'E17-HARM' && e.delta < 0);
    expect(harm.length).toBeGreaterThan(0);
    expect(harm.every((e) => e.source === 'chance')).toBe(true);
  });
  it('同じ seed なら、選択を変えても確率の出た値は変わらない', () => {
    const a = playThrough(real, run(), () => 0);
    const b = playThrough(real, run(), () => 1);
    expect(node(a, 'CH-HARM').u).toBe(node(b, 'CH-HARM').u);
  });
});

describe('格差とくらし（付録B-43）', () => {
  it('家計が苦しいと、くらしが下がった状態で始まり、旅行の場面が変わる', () => {
    const hard = playThrough(real, run({ familyStory: 'twoHardship' }), () => 0);
    expect(hard.choices['E17-TRIP/hard']).toBeDefined();
    const mid = playThrough(real, run(), () => 0);
    expect(mid.choices['E17-TRIP/normal']).toBeDefined();
    expect(hard.initial.living).toBeLessThan(mid.initial.living);
  });
  it('進路の場面の社会条件の変化は、性自認で変わる', () => {
    const social = (gender: Profile['gender']) => playThrough(real, run({ gender }), () => 0).ledger.filter((e) => e.eventId === 'E17-CAREER' && e.source === 'society');
    expect(social('woman').length).toBe(1);
    expect(social('man').length).toBe(0);
  });
});

describe('読まずに進む章と相談窓口のタグ', () => {
  it('読まずに進むと、効果は本来の要因のまま skipped 付きで記録する', () => {
    const s = playThrough(real, run({ familyStory: 'twoTense' }), () => 1, { skipChapter: (a) => a === 16 });
    expect(s.skippedChapters).toEqual([16]);
    const e16 = s.ledger.filter((e) => e.age === 16);
    expect(e16.length).toBeGreaterThan(0);
    expect(e16.every((e) => e.skipped)).toBe(true);
    expect(s.ledger.filter((e) => e.age === 17).every((e) => !e.skipped)).toBe(true);
  });
  it('その章の相談窓口のタグを集められる', () => {
    expect(chapterResourceTags(real, playThrough(real, run(), () => 0), 17)).toContain('violence');
  });
  it('章を始めると、最初の出来事は誰でも E16-CRUSH', () => {
    for (const attractedTo of ATTRACTIONS) expect(beginChapter(real, run({ attractedTo }), false).position.eventId).toBe('E16-CRUSH');
  });
});

describe('人との距離（付録B-9）', () => {
  it('パートナーの距離は、この周回の相手だけが動く', () => {
    const s = playThrough(real, run(), () => 0);
    expect(s.flags.partnerId).toBe('sou');
    expect(s.bondLog.some((e) => e.who === 'sou')).toBe(true);
    expect(s.bondLog.some((e) => e.who === 'saki')).toBe(false);
    for (const b of Object.values(s.bonds)) {
      expect(b.level).toBeGreaterThanOrEqual(0);
      expect(b.level).toBeLessThanOrEqual(3);
    }
  });
});

describe('2周目：属性だけ変える（付録B-43）', () => {
  it('同じ偶然のまま属性だけを変え、比べられる', () => {
    const first = autoPlay(real, run());
    const second = autoPlay(real, startReplay(real, first, { kind: 'profile', profile: makeProfile({ gender: 'man', body: 'cannot', attractedTo: 'women' }) }));
    expect(second.seed).toBe(first.seed);
    expect(second.replayOf?.changed).toBe('profile');
    expect(second.flags.partnerId).toBe('saki');
    expect(compareRuns(real, first, second).length).toBeGreaterThan(0);
    expect(trajectory(real, first)[0]!.params).toEqual(first.initial);
  });
});

describe('ランダムな主人公（付録B-45）', () => {
  const many = Array.from({ length: 500 }, (_, i) => randomProfile(`seed-${i}`));

  it('同じシードなら同じ人になる', () => {
    expect(randomProfile('abc')).toEqual(randomProfile('abc'));
  });

  it('性自認と好きになる人は、すべての値が偏りなく出る', () => {
    for (const g of GENDERS) expect(many.filter((p) => p.gender === g).length).toBeGreaterThan(50);
    for (const a of ATTRACTIONS) expect(many.filter((p) => p.attractedTo === a).length).toBeGreaterThan(50);
  });

  it('性自認とからだの組み合わせが合っている', () => {
    for (const p of many) {
      if (p.gender === 'woman' || p.gender === 'transMan') expect(p.body).toBe('canBePregnant');
      if (p.gender === 'man' || p.gender === 'transWoman') expect(p.body).toBe('cannot');
    }
    expect(new Set(many.filter((p) => p.gender === 'nonbinary').map((p) => p.body)).size).toBe(2);
  });

  it('家族の歩みも、からだの感覚の尊重も、すべて起こり得て、年齢は決めた範囲に入る（付録B-47）', () => {
    expect(new Set(many.map((p) => p.familyStory)).size).toBe(FAMILY_STORIES.length);
    expect(new Set(many.map((p) => p.bodyRespect)).size).toBe(BODY_RESPECTS.length);
    for (const p of many) {
      if (p.familyStory === 'divorceMoved' || p.familyStory === 'divorceRelief') expect(p.familyAge).toBeGreaterThanOrEqual(3);
      if (p.familyStory === 'bereaved') expect(p.familyAge).toBeGreaterThanOrEqual(5);
      if (p.familyStory === 'unmarried') expect(p.familyAge).toBe(0);
      expect(p.familyAge).toBeLessThanOrEqual(14);
    }
  });

  it('父親と暮らしていない家庭では、親のあいだの暴力の場面が出ない', () => {
    for (const s of FAMILY_STORIES) expect(upOf(makeProfile({ familyStory: s })).witnessedDV === true && singleParentOf(s)).toBe(false);
  });

  it('ひとり親になった理由の比は、S58 の値と一致する', () => {
    const n = real.stats.find((s) => s.id === 'S58')!.numbers!;
    expect(SINGLE_PARENT_REASONS).toEqual({ divorce: n.motherDivorce, unmarried: n.motherUnmarried, bereaved: n.motherBereaved });
  });
});

describe('生い立ちの年表（付録B-47）', () => {
  const story = (o: Partial<Profile>) => lifeStory(real, createRun(real, { profile: makeProfile(o), seed: 'a'.repeat(32) }));

  it('年齢の順に並び、変化の合計がはじめのパラメーターになる', () => {
    for (const familyStory of FAMILY_STORIES)
      for (const bodyRespect of BODY_RESPECTS) {
        const o = { familyStory, bodyRespect, familyCare: true };
        const s = story(o);
        expect(s.map((e) => e.age)).toEqual(s.map((e) => e.age).sort((a, b) => a - b));
        expect(s.every((e) => e.text.length > 0)).toBe(true);
        const base = { ...real.characters[0]!.initial };
        for (const e of s) for (const x of e.effects) base[x.param] += x.delta;
        expect(base).toEqual(initialOf(real.characters[0]!.initial, makeProfile(o)));
      }
  });

  it('トランスジェンダーとノンバイナリーの気づきは、一度にではなく何年もかけて出る', () => {
    const marker = /引っかかった|列にいる|画面を閉じた|ノンバイナリー|たぶん|どっちでもない|どちらの話にも/;
    for (const [gender, body] of [['transWoman', 'cannot'], ['transMan', 'canBePregnant'], ['nonbinary', 'cannot']] as const) {
      const ages = new Set(story({ gender, body, attractedTo: 'unsure' }).filter((e) => e.age < 15 && e.age > 0 && e.effects.length === 0 && e.text.length > 0).map((e) => e.age));
      expect(ages.size).toBeGreaterThanOrEqual(4);
      const key = story({ gender, body }).filter((e) => marker.test(e.text)).map((e) => e.age);
      expect(Math.max(...key) - Math.min(...key)).toBeGreaterThanOrEqual(2);
    }
  });

  it('本人の属性だけを理由に減点しない：理由の文に「ひとり親」などのラベルを使わない', () => {
    for (const familyStory of FAMILY_STORIES) for (const e of historyOf(makeProfile({ familyStory }))) for (const x of e.effects) expect(x.note).not.toMatch(/ひとり親|未婚/);
  });

  it('月経のある人とない人で、からだの感覚の文が正しく出し分けられる', () => {
    expect(story({ body: 'cannot', bodyRespect: 'dismissed' }).some((e) => e.text.includes('頭痛やおなかの痛み'))).toBe(true);
    expect(story({ body: 'canBePregnant', bodyRespect: 'dismissed' }).some((e) => e.text.includes('月経が始まって'))).toBe(true);
  });
});
