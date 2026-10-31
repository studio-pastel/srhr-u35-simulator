// 体験の再設計（SPEC.md 付録B）：場面をとばす、支援カード、会話の行・舞台の検証、吹き出しの組み立て。
import { describe, expect, it } from 'vitest';
import { playThrough, rawContent, realContent } from '../helpers';
import { advanceScene, beginChapter, choose, createRun, currentScene, skipEvent } from '../../src/engine/progression';
import { validateContent } from '../../src/engine/validate';
import { linesOf, sceneSpec, stageOf } from '../../src/ui/stage';
import type { RunState } from '../../src/engine/types';

const real = realContent();
const SEED = '0'.repeat(32);

/** 主人公のイベント（16歳）の最初の場面まで進める */
function toOwnEvent(protagonist: RunState['protagonist'], eventId: string): RunState {
  let s = beginChapter(real, createRun(real, { protagonist, seed: SEED }), false);
  for (let i = 0; i < 50 && s.position.eventId !== eventId; i++) {
    const sc = currentScene(real, s)!;
    s = sc.choices?.length ? choose(real, s, sc.choices[0]!.id) : advanceScene(real, s);
  }
  expect(s.position.eventId).toBe(eventId);
  return s;
}

describe('この場面をとばす（付録B-17）', () => {
  it('イベントの残りを canonical で進め、効果は skipped 付きで記録し、とばしたイベントを残す', () => {
    const s = skipEvent(real, toOwnEvent('kei', 'E16-KEI-CARE'));
    expect(s.skippedEvents).toEqual(['E16-KEI-CARE']);
    const own = s.ledger.filter((e) => e.eventId === 'E16-KEI-CARE');
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((e) => e.skipped)).toBe(true);
    expect(s.flags.keiToldTeacher).toBe(true); // canonical は「担任に事情を話す」
    expect(s.position.step).toBe('review'); 
  });

  it('暴力の場面をとばしても、途中で止まらず次へ進む（相談先は画面の下からだけ。付録B-39）', () => {
    const s = skipEvent(real, toOwnEvent('haruto', 'E16-HARUTO-HOME'));
    expect(s.completedEvents).toContain('E16-HARUTO-HOME');
    expect(s.position.eventId).not.toBe('E16-HARUTO-HOME');
    // 場面に入った時点の「他者の行為」は、とばしても重ねて記録されない
    expect(s.ledger.filter((e) => e.source === 'others' && e.eventId === 'E16-HARUTO-HOME')).toHaveLength(1);
  });
});

describe('会話の行と舞台の検証（付録B-1・B-2）', () => {
  const ev = (raw: any) => raw.chapters.find((c: any) => c.age === 16).events.find((e: any) => e.id === 'E16-KEI-CARE');
  const run = (mutate: (raw: any) => void) => {
    const raw: any = rawContent();
    mutate(raw);
    return validateContent(raw, { production: false, allowUnverified: true, requireAllChapters: true });
  };
  it('cast.yaml にない人物の行はエラー', () => {
    expect(run((r) => ev(r).scenes[0].lines.push({ who: 'nobody', text: 'x' })).errors.join()).toMatch(/登場人物 nobody/);
  });
  it('舞台に cast.yaml にない人物を置くとエラー', () => {
    expect(run((r) => (ev(r).stage.cast = [{ id: 'ghost' }])).errors.join()).toMatch(/登場人物 ghost/);
  });
  it('text も lines もない場面はエラー', () => {
    expect(run((r) => delete ev(r).scenes[0].lines).errors.join()).toMatch(/text か lines/);
  });
  it('40字を超える吹き出しは警告', () => {
    const r = run((raw) => (ev(raw).scenes[0].lines[0].text = 'あ'.repeat(41)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/41字です（上限 40字）/);
  });
  it('主人公4人の見た目がそろっていないとエラー', () => {
    expect(run((r) => (r.cast = r.cast.filter((c: any) => c.id !== 'yu'))).errors.join()).toMatch(/主人公 yu/);
  });
  it('相談先はすべてカテゴリを持つ', () => {
    expect(real.resources.every((x) => x.categories.length > 0)).toBe(true);
  });
});

describe('吹き出しと舞台の組み立て', () => {
  it('self は、いま遊んでいる主人公になる', () => {
    const s = beginChapter(real, createRun(real, { protagonist: 'yu', seed: SEED }), false);
    const sc = currentScene(real, s)!;
    const lines = linesOf(real, s, sc);
    expect(lines.find((l) => l.kind === 'inner')!.name).toBe('ユウ（心の声）');
    const spec = sceneSpec(real, s, stageOf(real.chapters.find((c) => c.age === 16)!.events[0], sc));
    expect(spec.actors).toHaveLength(2);
    expect(spec.actors[0]!.look).toEqual(real.cast.find((c) => c.id === 'yu')!.look);
  });

  it('旧形式の地の文は、「。」で区切って吹き出しにする', () => {
    const s = createRun(real, { protagonist: 'kei', seed: SEED });
    const lines = linesOf(real, s, { id: 'x', text: '一文目。二文目。' });
    expect(lines.map((l) => l.text)).toEqual(['一文目。', '二文目。']);
  });

  it('脇役は cast.yaml の年齢で、主人公は周回の年齢で描く', () => {
    const s = createRun(real, { protagonist: 'kei', seed: SEED });
    const spec = sceneSpec(real, s, { place: 'living', time: 'dusk', cast: [{ id: 'kei' }, { id: 'sora' }] });
    expect(spec.actors.map((a) => a.age)).toEqual([16, 5]);
  });
});
