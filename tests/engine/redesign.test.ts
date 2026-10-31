// 場面をとばす、会話の行・舞台の検証、吹き出しの組み立て。
import { describe, expect, it } from 'vitest';
import { makeProfile, rawContent, realContent } from '../helpers';
import { advanceScene, beginChapter, choose, createRun, currentScene, skipEvent, visibleChoices } from '../../src/engine/progression';
import { validateContent } from '../../src/engine/validate';
import { linesOf, sceneSpec, stageOf } from '../../src/ui/stage';
import type { Profile } from '../../src/engine/profile';
import type { RunState } from '../../src/engine/types';

const real = realContent();
const SEED = '0'.repeat(32);

/** 16歳のイベントの最初の場面まで進める */
function toEvent(profile: Profile, eventId: string): RunState {
  let s = beginChapter(real, createRun(real, { profile, seed: SEED }), false);
  for (let i = 0; i < 80 && s.position.eventId !== eventId; i++) {
    const sc = currentScene(real, s)!;
    s = sc.choices?.length ? choose(real, s, visibleChoices(real, s, sc)[0]!.id) : advanceScene(real, s);
  }
  expect(s.position.eventId).toBe(eventId);
  return s;
}

describe('この場面をとばす（付録B-17）', () => {
  it('イベントの残りを canonical で進め、効果は skipped 付きで記録し、とばしたイベントを残す', () => {
    const s = skipEvent(real, toEvent(makeProfile({ familyCare: true }), 'E16-CARE'));
    expect(s.skippedEvents).toEqual(['E16-CARE']);
    const own = s.ledger.filter((e) => e.eventId === 'E16-CARE');
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((e) => e.skipped)).toBe(true);
    expect(s.flags.toldTeacher).toBe(true);
  });

  it('暴力の場面をとばしても、途中で止まらず次へ進む（相談先は画面の下からだけ。付録B-39）', () => {
    const s = skipEvent(real, toEvent(makeProfile({ witnessedDV: true }), 'E16-HOME'));
    expect(s.completedEvents).toContain('E16-HOME');
    expect(s.position.eventId).not.toBe('E16-HOME');
    expect(s.ledger.filter((e) => e.source === 'others' && e.eventId === 'E16-HOME')).toHaveLength(1);
  });

  it('とばしたのはそのイベントだけで、次のイベントの効果に skipped は付かない', () => {
    const s = skipEvent(real, toEvent(makeProfile({ familyCare: true, witnessedDV: true }), 'E16-CARE'));
    expect(s.position.skipping).toBeUndefined();
    expect(s.ledger.filter((e) => e.eventId === 'E16-HOME').every((e) => !e.skipped)).toBe(true);
  });
});

describe('会話の行と舞台の検証（付録B-1・B-2）', () => {
  const run = (mutate: (raw: any) => void) => {
    const raw: any = rawContent();
    mutate(raw);
    return validateContent(raw, { production: false, allowUnverified: true });
  };
  const ev = (raw: any) => raw.chapters.find((c: any) => c.age === 16).events[0];
  it('cast.yaml にない人物の行はエラー', () => {
    expect(run((r) => ev(r).scenes[0].lines.push({ who: 'nobody', text: 'x' })).errors.join()).toMatch(/登場人物 nobody/);
  });
  it('舞台に cast.yaml にない人物を置くとエラー', () => {
    expect(run((r) => (ev(r).stage.cast = [{ id: 'ghost' }])).errors.join()).toMatch(/登場人物 ghost/);
  });
  it('text も lines もない場面はエラー', () => {
    expect(run((r) => delete ev(r).scenes[0].lines).errors.join()).toMatch(/text か lines/);
  });
  it('主人公の見た目がないとエラー', () => {
    expect(run((r) => (r.cast = r.cast.filter((c: any) => c.id !== 'me'))).errors.join()).toMatch(/主人公 me/);
  });
  it('相談先はすべてカテゴリを持つ', () => {
    expect(real.resources.every((x) => x.categories.length > 0)).toBe(true);
  });
});

describe('吹き出しと舞台の組み立て', () => {
  it('self は主人公になり、名前と見た目は選んだ属性のものになる', () => {
    const profile = makeProfile({ name: 'リン' });
    const s = beginChapter(real, createRun(real, { profile, seed: SEED }), false);
    const sc = currentScene(real, s)!;
    expect(linesOf(real, s, sc).find((l) => l.kind === 'inner')!.name).toBe('リン（心の声）');
    const spec = sceneSpec(real, s, stageOf(real.chapters.find((c) => c.age === 16)!.events[0], sc));
    expect(spec.actors[0]!.look).toEqual(profile.look);
  });

  it('partner は、この周回で決まった相手になる。決まっていなければ描かない', () => {
    const s = createRun(real, { profile: makeProfile(), seed: SEED });
    const stage = { place: 'bedroom', time: 'dusk', cast: [{ id: 'self' }, { id: 'partner' }] } as const;
    expect(sceneSpec(real, s, stage as never).actors).toHaveLength(1);
    s.flags.partnerId = 'sou';
    expect(sceneSpec(real, s, stage as never).actors[1]!.look).toEqual(real.cast.find((c) => c.id === 'sou')!.look);
  });

  it('属性に合う吹き出しだけが出る', () => {
    const scene = (attractedTo: Profile['attractedTo']) => {
      const s = beginChapter(real, createRun(real, { profile: makeProfile({ attractedTo }), seed: SEED }), false);
      return linesOf(real, s, currentScene(real, s)!).map((l) => l.text).join();
    };
    expect(scene('men')).toMatch(/ソウ/);
    expect(scene('women')).toMatch(/サキ/);
    expect(scene('none')).not.toMatch(/ソウ|サキ/);
  });

  it('脇役は cast.yaml の年齢で、主人公は周回の年齢で描く', () => {
    const s = createRun(real, { profile: makeProfile(), seed: SEED });
    const spec = sceneSpec(real, s, { place: 'living', time: 'dusk', cast: [{ id: 'self' }, { id: 'sora' }] });
    expect(spec.actors.map((a) => a.age)).toEqual([16, 5]);
  });
});
