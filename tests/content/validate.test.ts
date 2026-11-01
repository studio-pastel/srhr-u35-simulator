import { describe, expect, it } from 'vitest';
import { rawContent } from '../helpers';
import { validateContent } from '../../src/engine/validate';

const dev = { production: false, allowUnverified: false };

/** 実コンテンツに、mutate で手を加えて検証する */
function validateWith(mutate: (raw: any) => void, opts = dev) {
  const raw: any = rawContent();
  mutate(raw);
  return validateContent(raw, opts);
}
const ch17 = (raw: any) => raw.chapters.find((c: any) => c.age === 17);
const ev = (raw: any, id: string) => ch17(raw).events.find((e: any) => e.id === id);
/** E17-TRIP のシーン */
const ks = (raw: any, sceneId: string) => ev(raw, 'E17-TRIP').scenes.find((s: any) => s.id === sceneId);
/** E17-MIND のシーン */
const mind = (raw: any, sceneId: string) => ev(raw, 'E17-MIND').scenes.find((s: any) => s.id === sceneId);

describe('実コンテンツ', () => {
  it('開発モードの検証を通る', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.errors).toEqual([]);
  });
  it('章が欠けていても、requireAllChapters のときだけ失敗する（試作は16〜17歳だけ）', () => {
    expect(validateContent(rawContent(), { ...dev, requireAllChapters: true }).errors.join()).toMatch(/19歳の章がありません/);
  });
  it('S01〜S58 がすべてある', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.content!.stats.map((s) => s.id)).toEqual(Array.from({ length: 58 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`));
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
    expect(validateContent(raw, { production: true, allowUnverified: false }).errors).toEqual([]);
  });
  it('いまの本文は、本番ビルドを通る（暫定値の統計を参照していない）', () => {
    expect(validateContent(rawContent(), { production: true, allowUnverified: false }).errors).toEqual([]);
  });
  it('本番ビルドでは verified: false の統計カードで失敗し、ALLOW_UNVERIFIED=1 なら通る', () => {
    const raw: any = rawContent();
    raw.stats.find((s: any) => s.id === 'S43').verified = false;
    const prod = validateContent(raw, { production: true, allowUnverified: false });
    expect(prod.errors.length).toBeGreaterThan(0);
    expect(prod.errors.every((e) => e.includes('verified: false'))).toBe(true);
    expect(validateContent(raw, { production: true, allowUnverified: true }).errors).toEqual([]);
  });
});

describe('ビルドを失敗させる条件（§12.1）', () => {
  const cases: [string, (raw: any) => void, RegExp][] = [
    ['スキーマ違反', (r) => (r.characters[0].initial.body = 'x'), /スキーマ違反/],
    ['存在しない next', (r) => (ks(r, 'start').next = 'nowhere'), /存在しないシーン nowhere/],
    ['存在しない statRef', (r) => (mind(r, 'start').chance.base.statRef = 'S99'), /存在しない統計 S99/],
    ['存在しない statCard', (r) => (ev(r, 'E17-TRIP').statCard = ['S98']), /存在しない統計 S98/],
    ['存在しない社会条件', (r) => (ks(r, 'start').branches[0].when = "cond.nope == 'a'"), /存在しない社会条件 cond.nope/],
    ['存在しない社会条件の選択肢', (r) => (ks(r, 'start').branches[0].when = "cond.sexEducation == 'maybe'"), /選択肢 maybe/],
    ['存在しないフラグ', (r) => (ks(r, 'start').branches[0].when = 'flags.neverSet == true'), /flags.neverSet/],
    ['存在しない属性', (r) => (ks(r, 'start').branches[0].when = "up.nope == 'x'"), /up.nope/],
    ['構文エラーの FlagExpr', (r) => (ks(r, 'start').branches[0].when = "flags.method == 'x"), /構文エラー/],
    ['source のない効果', (r) => delete ks(r, 'normal').choices[0].effects[0].source, /スキーマ違反.*source/],
    ['確率ノードの結果効果に chance 以外の要因', (r) => (mind(r, 'start').chance.outcomes.happens.effects = [{ param: 'body', sign: -1, size: 'S', source: 'choice', note: 'x' }]), /要因は chance だけ/],
    ['statRef のない ChanceModifier', (r) => delete mind(r, 'start').chance.modifiers[0].statRef, /スキーマ違反.*statRef/],
    ['neutral の選択肢に負の効果', (r) => {
      const c = ks(r, 'normal').choices[0];
      c.neutral = true;
      c.effects = [{ param: 'body', sign: -1, size: 'S', source: 'choice', note: 'x' }];
    }, /neutral/],
    ['行き止まりのシーン', (r) => delete ks(r, 'saved').next, /行き止まり/],
    ['note が20字を超える', (r) => (ks(r, 'normal').choices[0].effects[0].note = 'あ'.repeat(21)), /21字です（上限 20字）/],
    ['到達できない（表示できる選択肢がない）', (r) => ks(r, 'normal').choices.forEach((c: any) => (c.requires = 'false')), /表示できる選択肢がありません/],
    ['到達できない（表示できる吹き出しがない）', (r) => ks(r, 'saved').lines.forEach((l: any) => (l.when = 'false')), /表示できる吹き出しがありません/],
    ['統計カードの文に、表にない数字を書く', (r) => (r.stats[0].cardText = '日本では、女性の22.7%、男性の99.9%です。'), /数字 99\.9 が value/],
    ['統計カードの文の書き出し', (r) => (r.stats[0].cardText = '女性で22.7%です。'), /「日本では、」で始めて/],
    ['米国データの書き出し', (r) => (r.stats.find((s: any) => s.id === 'S25').cardText = '日本では、20%です。'), /国名（例：「米国では、」）で始めて/],
    ['暴力の場面で、パートナーとの近さを変える（付録B-9）', (r) => (ev(r, 'E17-SNS').scenes[0].closeness = [{ who: 'partner', delta: 1, note: 'x' }]), /暴力の場面では、partner との近さを変えられません|partner は me の近しい人/],
    ['近しい人にいない相手の距離を変える', (r) => (ks(r, 'saved').closeness = [{ who: 'mori', delta: 1, note: 'x' }]), /mori は me の近しい人/],
    ['シーンに入ったときの効果に choice', (r) => (ks(r, 'saved').effects = [{ param: 'living', sign: -1, size: 'S', source: 'choice', note: 'x' }]), /choice は使えません/],
    ['ルビの書き方の誤り', (r) => (ks(r, 'saved').lines[0].text = '{漢字かんじ}'), /ルビ/],
  ];
  it.each(cases)('%s', (_, mutate, re) => {
    const r = validateWith(mutate);
    expect(r.errors.join('\n')).toMatch(re);
  });

  it('本番ビルドでは verified: false の統計を参照する確率ノードで失敗する', () => {
    const r = validateWith((raw) => (raw.stats.find((s: any) => s.id === 'S54').verified = false), { production: true, allowUnverified: false });
    expect(r.errors.join('\n')).toMatch(/E17-MIND\/start\[CH-MIND\]\.base：本番ビルドで verified: false の統計 S54/);
  });
});

describe('警告（ビルドは通す）', () => {
  it('40字を超える吹き出し', () => {
    const r = validateWith((raw) => (ks(raw, 'saved').lines[0].text = 'あ'.repeat(41)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/41字です（上限 40字）/);
  });
  it('30字を超える選択肢', () => {
    const r = validateWith((raw) => (ks(raw, 'normal').choices[1].label = 'あ'.repeat(31)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/31字です（上限 30字）/);
  });
  it('ルビは親文字だけを数える', () => {
    const r = validateWith((raw) => (ks(raw, 'saved').lines[0].text = '{漢|かんかんかんかんかん}'.repeat(10)));
    expect(r.warnings.join('\n')).not.toMatch(/吹き出しが/);
  });
  it('draft の件数を出す', () => {
    const r = validateContent(rawContent(), dev);
    expect(r.drafts.length).toBeGreaterThan(0);
  });
});

describe('セリフの決まり（付録B-48）', () => {
  const events: any[] = (rawContent() as any).chapters.flatMap((c: any) => c.events);
  it('話す人は、その場面の舞台にいる（メッセージを除く）', () => {
    const offstage = events.flatMap((ev) =>
      ev.scenes.flatMap((sc: any) => {
        const cast: string[] = (sc.stage ?? ev.stage)?.cast.map((c: any) => c.id) ?? [];
        return (sc.lines ?? [])
          .filter((l: any) => !['self', 'narration'].includes(l.who) && l.kind !== 'message' && !cast.includes(l.who))
          .map((l: any) => `${ev.id}/${sc.id}：${l.who}`);
      }),
    );
    expect(offstage).toEqual([]);
  });
  it('どの場面にも、なぜ起きたのかが書いてある', () => {
    expect(events.filter((ev) => !ev.trigger).map((ev) => ev.id)).toEqual([]);
  });
  it('パラメーターは場面の終わりに見せるので、選んですぐ終わる選択肢に効果を付けない（付録B-50）', () => {
    const silent = events.flatMap((ev) =>
      ev.scenes.flatMap((sc: any) =>
        (sc.choices ?? []).filter((c: any) => c.next === 'END' && (c.effects?.length || c.closeness?.length)).map((c: any) => `${ev.id}/${sc.id}/${c.id}`),
      ),
    );
    expect(silent).toEqual([]);
  });

  it('確率で決まる場面だけが「偶然」になっている', () => {
    for (const ev of events) expect(ev.trigger?.kind === 'chance').toBe(ev.kind === 'chance');
  });
});

describe('性のあり方の書き方（付録B-49）', () => {
  it('不在を感じさせる表現や、性自認を言い切る表現を本文に使わない', () => {
    const raw: any = rawContent();
    const text = JSON.stringify([raw.prologue, raw.chapters]);
    for (const word of ['どちらにも属さない', 'どっちでもない', '男でも女でもない', 'どちらの話にも', '自分は女子じゃない', '自分は男子じゃない']) expect(text).not.toContain(word);
  });
});
