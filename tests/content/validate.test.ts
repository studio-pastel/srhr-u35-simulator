import { describe, expect, it } from 'vitest';
import { rawContent } from '../helpers';
import { validateContent } from '../../src/engine/validate';

const dev = { production: false, allowUnverified: false };

/** 実コンテンツに、mutate で手を加えて検証する */
function validateWith(mutate: (raw: any) => void, opts = dev) {
  const raw: any = rawContent();
  mutate(raw);
  return validateContent(raw, { ...opts, requireAllChapters: true });
}
const ch19 = (raw: any) => raw.chapters.find((c: any) => c.age === 19);
const ev = (raw: any, id: string) => ch19(raw).events.find((e: any) => e.id === id);
/** E19-KS-CONTRACEPTION のシーン */
const ks = (raw: any, sceneId: string) => ev(raw, 'E19-KS-CONTRACEPTION').scenes.find((s: any) => s.id === sceneId);
/** E19-MH-ESCALATE のシーン */
const mh = (raw: any, sceneId: string) => ev(raw, 'E19-MH-ESCALATE').scenes.find((s: any) => s.id === sceneId);

describe('実コンテンツ', () => {
  it('開発モードの検証を通る', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.errors).toEqual([]);
  });
  it('16〜35歳の全章がそろい、到達性の検査も通る', () => {
    expect(validateWith(() => {}).errors).toEqual([]);
  });
  it('章が欠けていると失敗する', () => {
    expect(validateWith((r) => (r.chapters = r.chapters.filter((c: any) => c.age !== 24))).errors.join()).toMatch(/24歳の章がありません/);
  });
  it('S01〜S37 がすべてある', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.content!.stats.map((s) => s.id)).toEqual(Array.from({ length: 37 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`));
  });
  it('Claude Code が書いた本文はすべて status: draft', () => {
    const r = validateContent(rawContent(), dev);
    const events = r.content!.chapters.flatMap((c) => c.events);
    expect(events.every((e) => e.status === 'draft')).toBe(true);
  });
  it('統計の原典確認（T8 など）がすべて済めば、ALLOW_UNVERIFIED なしの本番の検証が通る（§14 フェーズ3）', () => {
    const raw: any = rawContent();
    for (const st of raw.stats) st.verified = true;
    for (const c of raw.conditions) for (const o of c.options) o.verified = true;
    expect(validateContent(raw, { production: true, allowUnverified: false, requireAllChapters: true }).errors).toEqual([]);
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
    ['存在しない next', (r) => (ks(r, 'notice').next = 'nowhere'), /存在しないシーン nowhere/],
    ['存在しない statRef', (r) => (ks(r, 'trouble').chance.base.statRef = 'S99'), /存在しない統計 S99/],
    ['存在しない statCard', (r) => (ev(r, 'E19-KS-CONTRACEPTION').statCard = ['S98']), /存在しない統計 S98/],
    ['存在しない社会条件', (r) => (ks(r, 'notice').branches[0].when = "cond.nope == 'a'"), /存在しない社会条件 cond.nope/],
    ['存在しない社会条件の選択肢', (r) => (ks(r, 'notice').branches[0].when = "cond.sexEducation == 'maybe'"), /選択肢 maybe/],
    ['存在しないフラグ', (r) => (ks(r, 'notice').branches[0].when = 'flags.neverSet == true'), /flags.neverSet/],
    ['構文エラーの FlagExpr', (r) => (ks(r, 'notice').branches[0].when = "flags.method == 'x"), /構文エラー/],
    ['source のない効果', (r) => delete ks(r, 'clinic').effects[0].source, /スキーマ違反.*source/],
    ['確率ノードの結果効果に chance 以外の要因', (r) => (ks(r, 'trouble').chance.outcomes.happens.effects = [{ param: 'body', sign: -1, size: 'S', source: 'choice', note: 'x' }]), /要因は chance だけ/],
    ['statRef のない ChanceModifier', (r) => delete ks(r, 'trouble').chance.modifiers[0].statRef, /スキーマ違反.*statRef/],
    ['neutral の選択肢に負の効果', (r) => {
      const c = ks(r, 'ecAsk').choices[0];
      c.neutral = true;
      c.effects = [{ param: 'body', sign: -1, size: 'S', source: 'choice', note: 'x' }];
    }, /neutral/],
    ['ミナミの視点から harutoRoute を書き換える', (r) => (mh(r, 'm-choose').choices[0].setFlags = { harutoRoute: 'stopped' }), /P7/],
    ['ミナミの視点から harutoControl17 を書き換える', (r) => (mh(r, 'm-choose').choices[1].setFlags = { harutoControl17: 'stopped' }), /P7/],
    ['行き止まりのシーン', (r) => delete ks(r, 'unaware').next, /行き止まり/],
    ['note が20字を超える', (r) => (ks(r, 'clinic').effects[0].note = 'あ'.repeat(21)), /21字です（上限 20字）/],
    ['到達できない（表示できる選択肢がない）', (r) => ks(r, 'ecAsk').choices.forEach((c: any) => (c.requires = 'false')), /表示できる選択肢がありません/],
    ['統計カードの文に、表にない数字を書く', (r) => (r.stats[0].cardText = '日本では、女性の22.7%、男性の99.9%です。'), /数字 99\.9 が value/],
    ['統計カードの文の書き出し', (r) => (r.stats[0].cardText = '女性で22.7%です。'), /「日本では、」で始めて/],
    ['米国データの書き出し', (r) => (r.stats.find((s: any) => s.id === 'S25').cardText = '日本では、20%です。'), /国名（例：「米国では、」）で始めて/],
    ['シーンに入ったときの効果に choice', (r) => (ks(r, 'unaware').effects = [{ param: 'safety', sign: -1, size: 'S', source: 'choice', note: 'x' }]), /choice は使えません/],
    ['ルビの書き方の誤り', (r) => (ks(r, 'unaware').text = '{漢字かんじ}'), /ルビ/],
  ];
  it.each(cases)('%s', (_, mutate, re) => {
    const r = validateWith(mutate);
    expect(r.errors.join('\n')).toMatch(re);
  });

  it('本番ビルドでは verified: false の統計を参照する確率ノードで失敗する', () => {
    const r = validateWith(() => {}, { production: true, allowUnverified: false });
    expect(r.errors.join('\n')).toMatch(/E19-KS-CONTRACEPTION\/ec\[CH-EC\]\.modifiers\[0\]：本番ビルドで verified: false の統計 S26/);
  });
});

describe('警告（ビルドは通す）', () => {
  it('200字を超えるシーン', () => {
    const r = validateWith((raw) => (ks(raw, 'unaware').text = 'あ'.repeat(201)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/201字です（上限 200字）/);
  });
  it('30字を超える選択肢', () => {
    const r = validateWith((raw) => (ks(raw, 'ecAsk').choices[1].label = 'あ'.repeat(31)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/31字です（上限 30字）/);
  });
  it('ルビは親文字だけを数える', () => {
    const r = validateWith((raw) => (ks(raw, 'unaware').text = '{漢|かんかんかんかんかん}'.repeat(200)));
    expect(r.warnings.join('\n')).not.toMatch(/シーン本文/);
  });
  it('draft の件数を出す', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.drafts.length).toBeGreaterThan(0);
  });
});
