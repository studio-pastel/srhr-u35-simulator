// 7.8 全体のふりかえり（35歳）。スコアや評価の言葉は出さない（P1）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { PARAM_KEYS } from '../../engine/constants';
import type { CharacterId, ParamKey } from '../../engine/schema';
import { PARAM_LABELS, type RunState } from '../../engine/types';
import { breakdown } from '../../engine/effects';
import { getCharacter } from '../../engine/progression';
import { standardRoutes, trajectory } from '../../engine/standard';
import { loadHistory, saveCompleted } from '../../engine/storage';
import { DASHES, LineChart, type Series } from '../components/LineChart';
import { FactorChart } from '../components/FactorChart';

const OTHER_COLORS = ['var(--p-options)', 'var(--p-connection)', 'var(--p-autonomy)'];

export const AGE_LABELS = (content: { chapters: { age: number }[] }) => ['開始', ...[...content.chapters].map((c) => c.age).sort((a, b) => a - b).map(String)];

export function OverallReview({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  const { content } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  const [param, setParam] = useState<ParamKey>('psychSafety');
  const [shown, setShown] = useState<Partial<Record<CharacterId, boolean>>>({});

  useEffect(() => {
    h.current?.focus();
    saveCompleted(run);
  }, [run.runId]);

  const me = getCharacter(content, run.protagonist);
  const xLabels = AGE_LABELS(content);
  const mine = trajectory(content, run);
  // 他の3人の標準ルート（§6.8）。表示のときに一度だけ計算する
  const routes = useMemo(() => standardRoutes(content, run), [run.runId]);
  const others = (Object.keys(routes) as CharacterId[]).map((id) => ({ id, run: routes[id]!, traj: trajectory(content, routes[id]!) }));

  const paramSeries: Series[] = PARAM_KEYS.map((k, i) => ({
    label: PARAM_LABELS[k],
    values: mine.map((p) => p.params[k]),
    dash: DASHES[i]!,
    color: `var(--p-${k})`,
  }));

  const compareSeries: Series[] = [
    { label: me.name, values: mine.map((p) => p.params[param]), dash: '', color: 'var(--text)', width: 3 },
    // 人ごとに色と線種を固定する（重ねる人を切り替えても変わらないように）
    ...others
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => shown[o.id])
      .map(({ o, i }) => ({
        label: getCharacter(content, o.id).name,
        values: o.traj.map((p) => p.params[param]),
        dash: DASHES[i + 1]!,
        // アバターの色は背景とのコントラストが足りない場合があるため、ダークモード用の値を持つトークンを使う
        color: OTHER_COLORS[i]!,
      })),
  ];

  const source = run.replayOf ? loadHistory().find((r) => r.runId === run.replayOf!.runId) : undefined;

  return (
    <section>
      <h1 tabIndex={-1} ref={h}>
        16歳から35歳まで
      </h1>
      <p class="sub">{me.name}の20年をふりかえります。どの道のりにも、点数や正解はありません。</p>

      {run.skippedChapters.length > 0 && (
        <p class="panel caution">読まずに進んだ章：{run.skippedChapters.map((a) => `${a}歳`).join('、')}（選択は自動で決まりました）</p>
      )}

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>{me.name}のパラメーターの軌跡</h2>
        <LineChart title={`${me.name}のパラメーターの軌跡`} xLabels={xLabels} series={paramSeries} height={260} />
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>4人の軌跡を重ねる</h2>
        <p class="sub">ほかの3人は、あなたがこの周回で選んだことを反映した、それぞれの標準の道のりです。</p>
        <div class="toolbar" role="group" aria-label="パラメーター" style={{ marginBottom: 8 }}>
          {PARAM_KEYS.map((k) => (
            <button key={k} type="button" class="toggle" aria-pressed={param === k} onClick={() => setParam(k)}>
              {PARAM_LABELS[k]}
            </button>
          ))}
        </div>
        <div class="toolbar" role="group" aria-label="重ねる人">
          {others.map((o) => (
            <button key={o.id} type="button" class="toggle" aria-pressed={Boolean(shown[o.id])} onClick={() => setShown({ ...shown, [o.id]: !shown[o.id] })}>
              {getCharacter(content, o.id).name}を重ねる
            </button>
          ))}
        </div>
        <LineChart title={`${PARAM_LABELS[param]}の軌跡`} xLabels={xLabels} series={compareSeries} />
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>20年間の変化の理由</h2>
        <p class="sub">16歳から35歳までの変化を、5つの要因に分けて示します。中心線より右が増えた分、左が減った分です。</p>
        <FactorChart data={breakdown(run.ledger)} title="16歳から35歳までの要因分解" hasActor={run.chanceLog.some((c) => c.actorLabel)} />
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
