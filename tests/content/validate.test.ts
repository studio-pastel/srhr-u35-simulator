import { describe, expect, it } from 'vitest';
import { rawContent } from '../helpers';
import { fixtureChapter19 } from '../fixtures/chance-chapter';
import { validateContent } from '../../src/engine/validate';

const dev = { production: false, allowUnverified: false };

/** 実コンテンツ＋テスト用の章に、mutate で手を加えて検証する */
function validateWith(mutate: (raw: any) => void, opts = dev) {
  const raw: any = rawContent();
  raw.chapters.push(structuredClone(fixtureChapter19));
  mutate(raw);
  return validateContent(raw, opts);
}
const ch19 = (raw: any) => raw.chapters.find((c: any) => c.age === 19);
const ks = (raw: any) => ch19(raw).events.find((e: any) => e.id === 'E19-TEST-KS');
const mh = (raw: any) => ch19(raw).events.find((e: any) => e.id === 'E19-TEST-MH');

describe('実コンテンツ', () => {
  it('開発モードの検証を通る', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.errors).toEqual([]);
  });
  it('テスト用の章を足しても通る（到達性を含む）', () => {
    expect(validateWith(() => {}).errors).toEqual([]);
  });
  it('S01〜S27 がすべてある', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.content!.stats.map((s) => s.id)).toEqual(Array.from({ length: 27 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`));
  });
  it('Claude Code が書いた本文はすべて status: draft', () => {
    const r = validateContent(rawContent(), dev);
    const events = r.content!.chapters.flatMap((c) => c.events);
    expect(events.every((e) => e.status === 'draft')).toBe(true);
  });
  it('本番ビルドでは verified: false の統計カードで失敗し、ALLOW_UNVERIFIED=1 なら通る', () => {
    const prod = validateContent(rawContent(), { production: true, allowUnverified: false });
    expect(prod.errors.length).toBeGreaterThan(0);
    expect(prod.errors.every((e) => e.includes('verified: false'))).toBe(true);
    expect(validateContent(rawContent(), { production: true, allowUnverified: true }).errors).toEqual([]);
  });
});

describe('ビルドを失敗させる条件（§12.1）', () => {
  const cases: [string, (raw: any) => void, RegExp][] = [
    ['スキーマ違反', (r) => (r.characters[0].initial.body = 'x'), /スキーマ違反/],
    ['存在しない next', (r) => (ks(r).scenes[1].next = 'nowhere'), /存在しないシーン nowhere/],
    ['存在しない statRef', (r) => (ks(r).scenes[0].chance.base.statRef = 'S99'), /存在しない統計 S99/],
    ['存在しない statCard', (r) => (ks(r).statCard = ['S98']), /存在しない統計 S98/],
    ['存在しない社会条件', (r) => (ks(r).scenes[1].branches[0].when = "cond.nope == 'a'"), /存在しない社会条件 cond.nope/],
    ['存在しない社会条件の選択肢', (r) => (ks(r).scenes[1].branches[0].when = "cond.sexEducation == 'maybe'"), /選択肢 maybe/],
    ['存在しないフラグ', (r) => (ks(r).scenes[1].branches[0].when = 'flags.neverSet == true'), /flags.neverSet/],
    ['構文エラーの FlagExpr', (r) => (ks(r).scenes[1].branches[0].when = "flags.method == 'x"), /構文エラー/],
    ['source のない効果', (r) => delete ks(r).scenes[2].choices[0].effects[0].source, /スキーマ違反.*source/],
    ['確率ノードの結果効果に chance 以外の要因', (r) => (ks(r).scenes[0].chance.outcomes.happens.effects[0].source = 'choice'), /要因は chance だけ/],
    ['statRef のない ChanceModifier', (r) => delete ks(r).scenes[0].chance.modifiers[0].statRef, /スキーマ違反.*statRef/],
    ['neutral の選択肢に負の効果', (r) => {
      const c = ks(r).scenes[2].choices[0];
      c.neutral = true;
      c.effects[0].sign = -1;
    }, /neutral/],
    ['ミナミの視点から harutoRoute を書き換える', (r) => (mh(r).scenes[0].choices[0].setFlags = { harutoRoute: 'stopped' }), /P7/],
    ['ミナミの視点から harutoControl17 を書き換える', (r) => (mh(r).scenes[0].choices[1].setFlags = { harutoControl17: 'stopped' }), /P7/],
    ['行き止まりのシーン', (r) => delete ks(r).scenes[3].next, /行き止まり/],
    ['note が20字を超える', (r) => (ks(r).scenes[2].choices[0].effects[0].note = 'あ'.repeat(21)), /21字です（上限 20字）/],
    ['到達できない（表示できる選択肢がない）', (r) => ks(r).scenes[2].choices.forEach((c: any) => (c.requires = 'false')), /表示できる選択肢がありません/],
    ['統計カードの文に、表にない数字を書く', (r) => (r.stats[0].cardText = '日本では、女性の22.7%、男性の99.9%です。'), /数字 99\.9 が value/],
    ['統計カードの文の書き出し', (r) => (r.stats[0].cardText = '女性で22.7%です。'), /「日本では、」で始めて/],
    ['米国データの書き出し', (r) => (r.stats[24].cardText = '日本では、20%です。'), /「米国では、」で始めて/],
    ['ルビの書き方の誤り', (r) => (ks(r).scenes[3].text = '{漢字かんじ}'), /ルビ/],
  ];
  it.each(cases)('%s', (_, mutate, re) => {
    const r = validateWith(mutate);
    expect(r.errors.join('\n')).toMatch(re);
  });

  it('本番ビルドでは verified: false の統計を参照する確率ノードで失敗する', () => {
    const r = validateWith((raw) => (ks(raw).scenes[4].chance.modifiers[0].statRef = 'S26'), { production: true, allowUnverified: false });
    expect(r.errors.join('\n')).toMatch(/S26/);
  });
});

describe('警告（ビルドは通す）', () => {
  it('200字を超えるシーン', () => {
    const r = validateWith((raw) => (ks(raw).scenes[3].text = 'あ'.repeat(201)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/201字です（上限 200字）/);
  });
  it('30字を超える選択肢', () => {
    const r = validateWith((raw) => (ks(raw).scenes[2].choices[1].label = 'あ'.repeat(31)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/31字です（上限 30字）/);
  });
  it('ルビは親文字だけを数える', () => {
    const r = validateWith((raw) => (ks(raw).scenes[3].text = '{漢|かんかんかんかんかん}'.repeat(200)));
    expect(r.warnings.join('\n')).not.toMatch(/シーン本文/);
  });
  it('draft の件数を出す', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.drafts.length).toBeGreaterThan(0);
  });
});
