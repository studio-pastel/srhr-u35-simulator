// 開発時だけの確認画面（#/dev）。本番ビルドには含まれない。
// 16・17歳の章には確率ノードがないため、確率カードの表示をここで確かめる。
// ノードはテスト用の見本で、§10.4 の CH-CONTRACEPTION・CH-EC と同じ統計値（S25・S26）を使う。
import { useState } from 'preact/hooks';
import { useApp } from '../app';
import { computeChance } from '../../engine/chance';
import { chanceU } from '../../engine/rng';
import type { ChanceNode } from '../../engine/schema';
import type { ChanceLogEntry } from '../../engine/types';
import { ProbabilityCard } from '../components/Cards';
import { FactorChart } from '../components/FactorChart';
import { emptyBreakdown } from '../../engine/effects';

const SAMPLE: ChanceNode = {
  id: 'DEV-SAMPLE-EC',
  label: '妊娠が成立する確率（見本）',
  base: { value: 1.0, statRef: 'S25' },
  modifiers: [{ when: 'flags.usedEC == true', op: 'mul', value: 0.16, source: 'choice', statRef: 'S26', note: '緊急避妊薬を使った' }],
  outcomes: { happens: { effects: [], next: 'END' }, notHappens: { effects: [], next: 'END' } },
};

export function DevPreview() {
  const { content, animate } = useApp();
  const [seed, setSeed] = useState('0123456789abcdef0123456789abcdef');
  const [usedEC, setUsedEC] = useState(true);
  const ctx = { flags: { usedEC }, cond: {}, up: {}, char: 'kei' };
  const c = computeChance(SAMPLE, ctx);
  const u = chanceU(seed, SAMPLE.id);
  const entry: ChanceLogEntry = {
    nodeId: SAMPLE.id + seed + usedEC,
    label: SAMPLE.label,
    age: 19,
    eventId: 'DEV',
    base: c.base,
    baseStatRef: SAMPLE.base.statRef,
    modifiersApplied: c.modifiersApplied,
    finalP: c.finalP,
    u,
    happened: u < c.finalP,
  };
  const bd = emptyBreakdown();
  bd.body.choice.plus = 10;
  bd.body.upbringing.minus = -5;
  bd.safety.society.plus = 5;
  bd.safety.chance.minus = -20;
  bd.options.society.minus = -5;
  bd.options.choice.plus = 5;
  bd.connection.chance.plus = 10;
  bd.autonomy.upbringing.minus = -5;
  bd.psychSafety.others.minus = -20;
  bd.psychSafety.others.plus = 10;
  return (
    <>
      <h1>開発用の確認画面</h1>
      <p class="sub">本番ビルドには含まれません。</p>
      <button type="button" class="btn small" onClick={() => setUsedEC(!usedEC)}>
        緊急避妊薬：{usedEC ? '使った' : '使わない'}
      </button>
      <button type="button" class="btn small" onClick={() => setSeed(Math.random().toString(16).slice(2).padEnd(32, '0'))}>
        シードを変える
      </button>
      <ProbabilityCard entry={entry} content={content} animate={animate} />
      <ProbabilityCard entry={{ ...entry, nodeId: 'actor' + seed, label: '人工妊娠中絶を選ぶ確率（見本）', actorLabel: 'サキの決定', base: 0.441, baseStatRef: 'S27', modifiersApplied: [], finalP: 0.441, happened: u < 0.441 }} content={content} animate={animate} />
      <div class="panel">
        <FactorChart data={bd} title="要因分解（見本）" hasActor />
      </div>
    </>
  );
}
