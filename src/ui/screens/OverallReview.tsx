// 7.8 全体のふりかえり（35歳）。スコアや評価の言葉は出さない（P1）。
import { useEffect, useRef } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { PARAM_KEYS } from '../../engine/constants';
import { PARAM_LABELS, type RunState } from '../../engine/types';
import { breakdown } from '../../engine/effects';
import { trajectory } from '../../engine/standard';
import { loadHistory, saveCompleted } from '../../engine/storage';
import { DASHES, LineChart, type Series } from '../components/LineChart';
import { FactorChart } from '../components/FactorChart';
import { LifeMap } from '../components/LifeMap';
import { BondRings } from '../components/Bonds';

export const AGE_LABELS = (content: { chapters: { age: number }[] }) => ['開始', ...[...content.chapters].map((c) => c.age).sort((a, b) => a - b).map(String)];

export function OverallReview({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  const { content } = useApp();
  const h = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h.current?.focus();
    saveCompleted(run);
  }, [run.runId]);

  const me = { name: run.profile.name };
  const xLabels = AGE_LABELS(content);
  const mine = trajectory(content, run);

  const paramSeries: Series[] = PARAM_KEYS.map((k, i) => ({
    label: PARAM_LABELS[k],
    values: mine.map((p) => p.params[k]),
    dash: DASHES[i]!,
    color: `var(--p-${k})`,
  }));

  const source = run.replayOf ? loadHistory().find((r) => r.runId === run.replayOf!.runId) : undefined;

  return (
    <section>
      <h1 tabIndex={-1} ref={h}>
        {content.chapters.length > 2 ? '16歳から35歳まで' : '試作はここまで（16〜17歳）'}
      </h1>
      <p class="sub">{me.name}の20年をふりかえります。どの道のりにも、点数や正解はありません。</p>

      {run.skippedChapters.length > 0 && (
        <p class="panel caution">読まずに進んだ章：{run.skippedChapters.map((a) => `${a}歳`).join('、')}（選択は自動で決まりました）</p>
      )}

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>{me.name}の人生の地図</h2>
        <LifeMap run={run} />
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>いまの、まわりの人</h2>
        <BondRings run={run} />
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>{me.name}のパラメーターの軌跡</h2>
        <LineChart title={`${me.name}のパラメーターの軌跡`} xLabels={xLabels} series={paramSeries} height={260} />
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>変化の理由</h2>
        <p class="sub">ここまでの変化を、5つの要因に分けて示します。中心線より右が増えた分、左が減った分です。</p>
        <FactorChart data={breakdown(run.ledger)} title="ここまでの要因分解" hasActor={run.chanceLog.some((c) => c.actorLabel)} />
      </div>

      {source && (
        <button type="button" class="btn primary" onClick={() => navigate('compare')}>
          前の周回と比べる
        </button>
      )}
      <button type="button" class={source ? 'btn' : 'btn primary'} onClick={() => navigate('replay')}>
        2周目へ
      </button>
      <button
        type="button"
        class="btn"
        onClick={() => {
          onRestart();
          navigate('select');
        }}
      >
        最初から選びなおす
      </button>
    </section>
  );
}
