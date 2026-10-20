// 確率イベント（§6.4）。
import type { ChanceNode } from './schema';
import type { AppliedModifier } from './types';
import { check, type EvalContext } from './flags';
import { chanceU } from './rng';

export interface ChanceComputation {
  base: number;
  modifiersApplied: AppliedModifier[];
  finalP: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** base から始め、条件に合う modifier を順に適用する。set は置き換え、mul は掛け算。最後に 0〜1 に丸める */
export function computeChance(node: ChanceNode, ctx: EvalContext): ChanceComputation {
  let p = node.base.value;
  const modifiersApplied: AppliedModifier[] = [];
  for (const m of node.modifiers) {
    if (!check(m.when, ctx)) continue;
    const from = p;
    p = m.op === 'set' ? m.value : p * m.value;
    modifiersApplied.push({ source: m.source, op: m.op, value: m.value, statRef: m.statRef, note: m.note, from, to: p });
  }
  return { base: node.base.value, modifiersApplied, finalP: clamp01(p) };
}

export function resolveChance(node: ChanceNode, ctx: EvalContext, seed: string) {
  const c = computeChance(node, ctx);
  const u = chanceU(seed, node.id);
  return { ...c, u, happened: u < c.finalP };
}
