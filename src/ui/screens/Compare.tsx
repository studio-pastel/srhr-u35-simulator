// 7.10 比較：2つの周回の軌跡を重ね、差が開いた章と、その理由を示す。
import { useEffect, useRef } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { PARAM_KEYS } from '../../engine/constants';
import type { Source } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS, type RunState } from '../../engine/types';
import { sortedChapters } from '../../engine/progression';
import { compareRuns } from '../../engine/replay';
import { trajectory } from '../../engine/standard';
import { loadHistory } from '../../engine/storage';
import { LineChart } from '../components/LineChart';
import { pct } from '../components/Cards';
import { AGE_LABELS } from './OverallReview';

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function runName(content: ReturnType<typeof useApp>['content'], r: RunState, tag: string): string {
  return `${tag}（${r.profile.name}）`;
}

export function CompareScreen() {
  const { content, run } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);

  const history = loadHistory();
  const b = run?.position.step === 'finished' && run.replayOf ? run : [...history].reverse().find((r) => r.replayOf);
  const a = b?.replayOf ? history.find((r) => r.runId === b.replayOf!.runId) : undefined;

  if (!a || !b) {
    return (
      <>
        <h1 tabIndex={-1} ref={h}>
          比較
        </h1>
        <p>比べられる2つの周回がありません。1周目を終えたあと、「2周目へ」から遊んでください。</p>
        <button type="button" class="btn primary" onClick={() => navigate('replay')}>
          2周目を選ぶ
        </button>
      </>
    );
  }

  const nameA = runName(content, a, '1周目');
  const nameB = runName(content, b, '2周目');
  const changed = b.replayOf!.changed;
  const cond = typeof changed === 'object' ? content.conditions.find((c) => c.id === changed.condition) : undefined;
  const optLabel = (id: string) => cond?.options.find((o) => o.id === id)?.label ?? id;
  const diffs = compareRuns(content, a, b);
  const ages = sortedChapters(content).map((c) => c.age);
  const highlight = diffs.flatMap((d, i) => (d.widened ? [i + 1] : []));
  const hasFactorDiff = (d: (typeof diffs)[number]) => PARAM_KEYS.some((p) => Object.keys(d.factorDiff[p]).length > 0);
  // 差が開いた章を先に、それ以外で差が出た章を後に並べる
  const changedChapters = [
    ...diffs.filter((d) => d.widened),
    ...diffs.filter((d) => !d.widened && (hasFactorDiff(d) || d.chanceDiffs.length > 0 || d.eventsOnlyA.length > 0 || d.eventsOnlyB.length > 0)),
  ];
  /** イベントIDの代わりに、扱う領域で示す */
  const eventLabel = (id: string) => {
    const ev = content.chapters.flatMap((c) => c.events).find((e) => e.id === id);
    return ev ? `「${ev.domains.join('・')}」の場面` : id;
  };
  const ta = trajectory(content, a);
  const tb = trajectory(content, b);

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        2つの周回を比べる
      </h1>
      <div class="panel">
        <p style={{ marginTop: 0 }}>
          {typeof changed === 'object' && cond ? (
            <>
              変えた社会条件：<strong>{cond.label}</strong>
              <br />
              {nameA}：{optLabel(changed.from)}
              <br />
              {nameB}：{optLabel(changed.to)}
            </>
          ) : (
            <>主人公を変えて遊んだ周回です。</>
          )}
        </p>
        <p class="sub" style={{ marginBottom: 0 }}>
          {b.replayOf!.sameSeed ? '偶然（確率で決まる出来事の「出た値」）は同じです。違いは、変えた条件と、それによって変わった確率から生まれています。' : '偶然も変えて遊んだ周回です。違いには、偶然の差も含まれます。'}
        </p>
      </div>

      <h2>パラメーターの軌跡</h2>
      <p class="sub">点線の枠は、2つの周回の差が前の章より{content.config.effectSize.M}以上開いた章です。</p>
      {PARAM_KEYS.map((k) => (
        <div class="panel" key={k}>
          <h3 style={{ marginTop: 0 }}>{PARAM_LABELS[k]}</h3>
          <LineChart
            title={`${PARAM_LABELS[k]}の比較`}
            xLabels={AGE_LABELS(content)}
            height={170}
            highlight={highlight}
            series={[
              { label: '1周目', values: ta.map((p) => p.params[k]), dash: '', color: 'var(--accent)' },
              { label: '2周目', values: tb.map((p) => p.params[k]), dash: '6 4', color: 'var(--f-upbringing)' },
            ]}
          />
        </div>
      ))}

      <h2>差が出た章と、その理由</h2>
      {changedChapters.length === 0 && <p>2つの周回のあいだに、差は出ませんでした。</p>}
      {changedChapters.map((d) => (
        <section class={`panel${d.widened ? ' caution' : ''}`} key={d.age} aria-labelledby={`diff-${d.age}`}>
          <h3 id={`diff-${d.age}`} style={{ marginTop: 0 }}>
            {d.age}歳{d.widened ? `（差が${content.config.effectSize.M}以上開いた章）` : ''}
          </h3>
          {d.widened && (
            <p style={{ margin: '4px 0' }}>
              差が開いたパラメーター：
              {d.widenedParams.map((p) => `${PARAM_LABELS[p]}（2周目 − 1周目 = ${sign(d.gap[p])}）`).join('、')}
            </p>
          )}
          {hasFactorDiff(d) && (
            <>
              <h4 style={{ margin: '8px 0 0' }}>この章の、要因ごとの違い（2周目 − 1周目）</h4>
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {PARAM_KEYS.flatMap((p) =>
                  (Object.entries(d.factorDiff[p]) as [Source, number][]).map(([s, v]) => (
                    <li key={p + s} class="num">
                      {PARAM_LABELS[p]}：{SOURCE_LABELS[s]} {sign(v)}
                    </li>
                  )),
                )}
              </ul>
            </>
          )}
          {d.chanceDiffs.length > 0 && (
            <>
              <h4 style={{ margin: '8px 0 0' }}>違いが出た確率</h4>
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {d.chanceDiffs.map((c) => (
                  <li key={c.nodeId} class="num">
                    {c.label}：1周目 {c.a ? `${pct(c.a.finalP)}・${c.a.happened ? '起きた' : '起きなかった'}` : 'なし'}、2周目{' '}
                    {c.b ? `${pct(c.b.finalP)}・${c.b.happened ? '起きた' : '起きなかった'}` : 'なし'}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(d.eventsOnlyA.length > 0 || d.eventsOnlyB.length > 0) && (
            <p class="sub" style={{ marginBottom: 0 }}>
              片方の周回にだけあった出来事：
              {[...d.eventsOnlyA.map((e) => `${eventLabel(e)}（1周目）`), ...d.eventsOnlyB.map((e) => `${eventLabel(e)}（2周目）`)].join('、')}
            </p>
          )}
        </section>
      ))}
      <p class="sub">章：{ages.join('・')}歳</p>
      <button type="button" class="btn primary" onClick={() => navigate('replay')}>
        もう一度、条件を変えて遊ぶ
      </button>
    </>
  );
}
