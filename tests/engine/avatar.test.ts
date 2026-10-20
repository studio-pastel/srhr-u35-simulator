import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE, AVATAR_SHAPES, avatarOrder, avatarsFor, hueDistance, hueOf } from '../../src/engine/avatar';
import { CHARACTER_IDS } from '../../src/engine/schema';

const zero = { minami: 0, haruto: 0, yu: 0, kei: 0 };

describe('アバター（§16.3）', () => {
  it('同じ入力なら同じアバターになる', () => {
    expect(avatarsFor('abc', zero)).toEqual(avatarsFor('abc', zero));
  });
  it('4人の塗り色は色相環上で互いに30度以上離れる', () => {
    for (let i = 0; i < 2000; i++) {
      const a = avatarsFor(`seed${i}`, zero);
      const hues = CHARACTER_IDS.map((id) => hueOf(a[id].color));
      for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) expect(hueDistance(hues[x]!, hues[y]!)).toBeGreaterThanOrEqual(30);
    }
  });
  it('ソルトを増やすと、その人物の見た目が変わりうる', () => {
    let changed = 0;
    for (let i = 0; i < 100; i++) {
      const a = avatarsFor(`s${i}`, zero);
      const b = avatarsFor(`s${i}`, { ...zero, yu: 1 });
      if (JSON.stringify(a.yu) !== JSON.stringify(b.yu)) changed++;
      // 先に色が決まる人物は変わらない
      const order = avatarOrder(`s${i}`);
      for (const id of order.slice(0, order.indexOf('yu'))) expect(b[id]).toEqual(a[id]);
    }
    expect(changed).toBeGreaterThan(80);
  });
  it('パレットにピンク系・水色系を含まない', () => {
    for (const c of AVATAR_PALETTE) {
      const h = hueOf(c);
      expect(h >= 300 && h < 345).toBe(false); // ピンク系
      expect(h >= 185 && h < 205).toBe(false); // 水色系
    }
  });
  it('回帰テスト：性別ごとの色相・形状の分布に偏りがない', () => {
    // 生成の入力に性別を含まないので構造上は偏らない。§16.3 のとおり回帰テストとして置く
    const groups: Record<string, string[]> = { f: ['minami', 'yu'], m: ['haruto', 'kei'] };
    const N = 6000;
    const count = (g: string[], key: 'shape' | 'color') => {
      const m = new Map<string, number>();
      for (let i = 0; i < N; i++) {
        const a = avatarsFor(`r${i}`, zero);
        for (const id of g) {
          const v = a[id as keyof typeof a][key];
          m.set(v, (m.get(v) ?? 0) + 1);
        }
      }
      return m;
    };
    for (const key of ['shape', 'color'] as const) {
      const f = count(groups.f!, key);
      const m = count(groups.m!, key);
      const values = key === 'shape' ? AVATAR_SHAPES : AVATAR_PALETTE;
      for (const v of values) {
        const pf = (f.get(v) ?? 0) / (2 * N);
        const pm = (m.get(v) ?? 0) / (2 * N);
        expect(Math.abs(pf - pm)).toBeLessThan(0.03);
      }
    }
  });
});
