import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chanceU, newSeed } from '../../src/engine/rng';

describe('乱数（§6.5）', () => {
  it('同じ seed・同じ nodeId なら u は常に同じ', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (seed, node) => {
        expect(chanceU(seed, node)).toBe(chanceU(seed, node));
      }),
    );
  });
  it('u は [0,1) に入る', () => {
    fc.assert(fc.property(fc.string(), fc.string(), (seed, node) => {
      const u = chanceU(seed, node);
      return u >= 0 && u < 1;
    }));
  });
  it('u はおおむね一様に分布する', () => {
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) bins[Math.floor(chanceU(`s${i}`, 'CH-X') * 10)]++;
    for (const b of bins) expect(Math.abs(b - 2000)).toBeLessThan(200);
  });
  it('newSeed は32文字の16進', () => {
    expect(newSeed()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSeed()).not.toBe(newSeed());
  });
});
