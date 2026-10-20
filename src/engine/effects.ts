// 効果の適用と要因分解（§6.3）。
import { PARAM_KEYS, SOURCES } from './constants';
import type { ChanceEffect, Config, Effect, ParamKey, Source } from './schema';
import type { LedgerEntry, Params, RunState } from './types';
import { check, type EvalContext } from './flags';

export interface EffectOrigin {
  age: number;
  eventId: string;
  sceneId: string;
  skipped?: boolean;
}

/**
 * 効果を params と ledger に適用する。when を満たさない効果は記録しない。
 * forceSource を渡すと、YAML の記述に関係なくその要因で記録する（確率ノードの結果効果）。
 */
export function applyEffects(
  state: RunState,
  effects: readonly (Effect | ChanceEffect)[],
  config: Config,
  ctx: EvalContext,
  origin: EffectOrigin,
  forceSource?: Source,
): void {
  for (const e of effects) {
    if (!check(e.when, ctx)) continue;
    const delta = e.sign * config.effectSize[e.size];
    const source = forceSource ?? e.source ?? 'chance';
    state.params[e.param] += delta;
    const entry: LedgerEntry = {
      age: origin.age,
      eventId: origin.eventId,
      sceneId: origin.sceneId,
      param: e.param,
      delta,
      source,
      note: e.note,
    };
    if (e.statRef) entry.statRef = e.statRef;
    if (origin.skipped) entry.skipped = true;
    state.ledger.push(entry);
  }
}

export type Breakdown = Record<ParamKey, Record<Source, number>>;

export function emptyBreakdown(): Breakdown {
  const b = {} as Breakdown;
  for (const p of PARAM_KEYS) {
    b[p] = {} as Record<Source, number>;
    for (const s of SOURCES) b[p][s] = 0;
  }
  return b;
}

/** ledger を source ごとに合計する。filter で章などに絞れる */
export function breakdown(ledger: readonly LedgerEntry[], filter?: (e: LedgerEntry) => boolean): Breakdown {
  const b = emptyBreakdown();
  for (const e of ledger) {
    if (filter && !filter(e)) continue;
    b[e.param][e.source] += e.delta;
  }
  return b;
}

/** 初期値に、条件に合う ledger の delta を足した値（内部値） */
export function paramsFrom(initial: Params, ledger: readonly LedgerEntry[], filter?: (e: LedgerEntry) => boolean): Params {
  const p = { ...initial };
  for (const e of ledger) if (!filter || filter(e)) p[e.param] += e.delta;
  return p;
}

/** 表示用の値。0〜100 に丸め、丸めが起きたかを返す */
export function displayValue(v: number): { value: number; clamped: 'upper' | 'lower' | null } {
  if (v > 100) return { value: 100, clamped: 'upper' };
  if (v < 0) return { value: 0, clamped: 'lower' };
  return { value: Math.round(v), clamped: null };
}
