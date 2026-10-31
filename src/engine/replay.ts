// 2周目と比較（§6.5、§7.9、§7.10）。
import { PARAM_KEYS } from './constants';
import type { Content, ParamKey, SocialCondition, Source } from './schema';
import type { Profile } from './profile';
import type { ChanceLogEntry, RunState } from './types';
import { breakdown, type Breakdown } from './effects';
import { createRun, sortedChapters } from './progression';
import { trajectory } from './standard';
import { newSeed } from './rng';

/** 切り替えられる社会条件（§7.9） */
export function switchableConditions(content: Content): SocialCondition[] {
  return content.conditions.filter((c) => c.affects.length > 0);
}

export type ReplayRequest =
  | { kind: 'profile'; profile: Profile }
  | { kind: 'condition'; condition: string; to: string; sameSeed: boolean };

/** 2周目を始める。「同じ偶然で」はシードを引き継ぐ（§6.5）。属性を変えるときも同じ偶然で比べる（付録B-43） */
export function startReplay(content: Content, prev: RunState, req: ReplayRequest): RunState {
  if (req.kind === 'profile') {
    return createRun(content, {
      profile: req.profile,
      seed: prev.seed,
      conditions: prev.conditions,
      replayOf: { runId: prev.runId, changed: 'profile', sameSeed: true },
    });
  }
  const cond = content.conditions.find((c) => c.id === req.condition);
  if (!cond || !cond.options.some((o) => o.id === req.to)) throw new Error(`社会条件を切り替えられません：${req.condition}=${req.to}`);
  const from = prev.conditions[req.condition] ?? '';
  return createRun(content, {
    profile: prev.profile,
    seed: req.sameSeed ? prev.seed : newSeed(),
    conditions: { ...prev.conditions, [req.condition]: req.to },
    replayOf: { runId: prev.runId, changed: { condition: req.condition, from, to: req.to }, sameSeed: req.sameSeed },
  });
}

export interface ChapterDiff {
  age: number;
  /** 章の終わりの差（b − a） */
  gap: Record<ParamKey, number>;
  /** 前の章から差が M 以上広がった（付録A-20） */
  widened: boolean;
  widenedParams: ParamKey[];
  /** 結果か最終の確率が違った確率ノード */
  chanceDiffs: { nodeId: string; label: string; a?: ChanceLogEntry; b?: ChanceLogEntry }[];
  /** 要因ごとの変化の差（b − a、増減の合計） */
  factorDiff: Record<ParamKey, Partial<Record<Source, number>>>;
  /** 片方の周回にだけあったイベント */
  eventsOnlyA: string[];
  eventsOnlyB: string[];
}

const net = (b: Breakdown, p: ParamKey, s: Source) => b[p][s].plus + b[p][s].minus;

export function compareRuns(content: Content, a: RunState, b: RunState): ChapterDiff[] {
  const ta = trajectory(content, a);
  const tb = trajectory(content, b);
  const threshold = content.config.effectSize.M;
  const out: ChapterDiff[] = [];
  const chapters = sortedChapters(content);
  for (let i = 0; i < chapters.length; i++) {
    const age = chapters[i]!.age;
    const pa = ta[i + 1]!.params;
    const pb = tb[i + 1]!.params;
    const prevA = ta[i]!.params;
    const prevB = tb[i]!.params;
    const gap = {} as Record<ParamKey, number>;
    const widenedParams: ParamKey[] = [];
    for (const k of PARAM_KEYS) {
      gap[k] = pb[k] - pa[k];
      if (Math.abs(gap[k]) - Math.abs(prevB[k] - prevA[k]) >= threshold) widenedParams.push(k);
    }
    const ba = breakdown(a.ledger, (e) => e.age === age);
    const bb = breakdown(b.ledger, (e) => e.age === age);
    const factorDiff = {} as ChapterDiff['factorDiff'];
    for (const k of PARAM_KEYS) {
      factorDiff[k] = {};
      for (const s of Object.keys(ba[k]) as Source[]) {
        const d = net(bb, k, s) - net(ba, k, s);
        if (d !== 0) factorDiff[k][s] = d;
      }
    }
    const nodes = new Set([...a.chanceLog, ...b.chanceLog].filter((c) => c.age === age).map((c) => c.nodeId));
    const chanceDiffs: ChapterDiff['chanceDiffs'] = [];
    for (const id of nodes) {
      const ca = a.chanceLog.find((c) => c.nodeId === id);
      const cb = b.chanceLog.find((c) => c.nodeId === id);
      if (!ca || !cb || ca.finalP !== cb.finalP || ca.happened !== cb.happened)
        chanceDiffs.push({ nodeId: id, label: (ca ?? cb)!.label, ...(ca ? { a: ca } : {}), ...(cb ? { b: cb } : {}) });
    }
    const evA = new Set(a.completedEvents.filter((e) => e.startsWith(`E${age}-`)));
    const evB = new Set(b.completedEvents.filter((e) => e.startsWith(`E${age}-`)));
    out.push({
      age,
      gap,
      widened: widenedParams.length > 0,
      widenedParams,
      chanceDiffs,
      factorDiff,
      eventsOnlyA: [...evA].filter((e) => !evB.has(e)),
      eventsOnlyB: [...evB].filter((e) => !evA.has(e)),
    });
  }
  return out;
}
