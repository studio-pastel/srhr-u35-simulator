// 要因分解の積み上げ横棒（§7.7）。正負は中心線で分け、色と模様を併用する。表を添える（§9）。
import { PARAM_KEYS, SOURCES } from '../../engine/constants';
import type { ParamKey, Source } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS } from '../../engine/types';
import type { Breakdown, PlusMinus } from '../../engine/effects';

let uid = 0;

const FILL: Record<Source, string> = {
  choice: 'var(--f-choice)',
  upbringing: 'var(--f-upbringing)',
  society: 'var(--f-society)',
  others: 'var(--f-others)',
  chance: 'var(--f-chance)',
};

/** 模様の定義：選択＝塗りつぶし、生育条件＝右上がりの斜線、社会条件＝ドット、他者の行為＝横じま、偶然＝斜め格子 */
export function FactorPatterns({ prefix }: { prefix: string }) {
  const ink = 'rgb(255 255 255 / 0.7)';
  return (
    <defs>
      <pattern id={`${prefix}-choice`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL.choice} />
      </pattern>
      <pattern id={`${prefix}-upbringing`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL.upbringing} />
        <path d="M-2 10L10 -2M-2 2L2 -2M6 10L10 6" stroke={ink} stroke-width="1.6" />
      </pattern>
      <pattern id={`${prefix}-society`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL.society} />
        <circle cx="4" cy="4" r="1.6" fill={ink} />
      </pattern>
      <pattern id={`${prefix}-others`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL.others} />
        <path d="M0 2H8M0 6H8" stroke={ink} stroke-width="1.4" />
      </pattern>
      <pattern id={`${prefix}-chance`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL.chance} />
        <path d="M0 0L8 8M8 0L0 8" stroke="rgb(0 0 0 / 0.45)" stroke-width="1.2" />
      </pattern>
    </defs>
  );
}

export function FactorLegend({ hasActor }: { hasActor?: boolean }) {
  const prefix = `lg${++uid}`;
  return (
    <>
      <ul class="legend" aria-label="凡例">
        {SOURCES.map((s) => (
          <li key={s}>
            <svg width="20" height="14" aria-hidden="true">
              <FactorPatterns prefix={prefix} />
              <rect x="0.5" y="0.5" width="19" height="13" rx="2" fill={`url(#${prefix}-${s})`} stroke="var(--text)" stroke-width="0.75" />
            </svg>
            {SOURCE_LABELS[s]}
          </li>
        ))}
      </ul>
      {hasActor && <p class="sub">「偶然」には、他の登場人物の決定を統計で表したものも含みます。</p>}
    </>
  );
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** 表やラベル用：「+10」「−20」「+10 −20」 */
function pmText(v: PlusMinus): string {
  const parts = [];
  if (v.plus) parts.push(sign(v.plus));
  if (v.minus) parts.push(sign(v.minus));
  return parts.length ? parts.join(' ') : '0';
}

function rowSummary(p: ParamKey, b: Record<Source, PlusMinus>): string {
  const parts = SOURCES.filter((s) => b[s].plus || b[s].minus).map((s) => `${SOURCE_LABELS[s]} ${pmText(b[s])}`);
  return `${PARAM_LABELS[p]}：${parts.length ? parts.join('、') : '変化なし'}`;
}

export function FactorChart({ data, title, hasActor }: { data: Breakdown; title: string; hasActor?: boolean }) {
  const prefix = `fc${++uid}`;
  const W = 320;
  const LABEL = 76;
  const center = LABEL + (W - LABEL) / 2;
  const half = (W - LABEL) / 2 - 6;
  const rowH = 30;
  const H = PARAM_KEYS.length * rowH + 8;
  let maxAbs = 10;
  for (const p of PARAM_KEYS) {
    let pos = 0;
    let neg = 0;
    for (const s of SOURCES) {
      pos += data[p][s].plus;
      neg -= data[p][s].minus;
    }
    maxAbs = Math.max(maxAbs, pos, neg);
  }
  const scale = half / maxAbs;
  const summary = PARAM_KEYS.map((p) => rowSummary(p, data[p])).join('。');

  return (
    <figure class="factor-chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}。${summary}`}>
        <FactorPatterns prefix={prefix} />
        {PARAM_KEYS.map((p, i) => {
          const y = 4 + i * rowH;
          let right = center;
          let left = center;
          // 増えた分は中心線から右へ、減った分は左へ。同じ要因でも相殺せずに両方描く
          const segs = SOURCES.flatMap((s) => {
            const out = [];
            const { plus, minus } = data[p][s];
            if (plus > 0) {
              const w = plus * scale;
              out.push(<rect key={`${s}+`} x={right} y={y + 6} width={w} height={rowH - 12} fill={`url(#${prefix}-${s})`} stroke="var(--text)" stroke-width="0.75" />);
              right += w;
            }
            if (minus < 0) {
              const w = -minus * scale;
              left -= w;
              out.push(<rect key={`${s}-`} x={left} y={y + 6} width={w} height={rowH - 12} fill={`url(#${prefix}-${s})`} stroke="var(--text)" stroke-width="0.75" />);
            }
            return out;
          });
          return (
            <g key={p}>
              <text x="0" y={y + rowH / 2 + 4} font-size="12" fill="var(--text)">
                {PARAM_LABELS[p]}
              </text>
              {segs}
            </g>
          );
        })}
        <line x1={center} x2={center} y1="0" y2={H} stroke="var(--text-sub)" stroke-width="1.5" />
        <text x={center - 4} y={H - 1} font-size="9" text-anchor="end" fill="var(--text-sub)">
          − 減った
        </text>
        <text x={center + 4} y={H - 1} font-size="9" fill="var(--text-sub)">
          ＋ 増えた
        </text>
      </svg>
      <FactorLegend hasActor={hasActor} />
      <details>
        <summary>表で見る</summary>
        <table class="data num">
          <caption class="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">パラメーター</th>
              {SOURCES.map((s) => (
                <th key={s} scope="col">
                  {SOURCE_LABELS[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARAM_KEYS.map((p) => (
              <tr key={p}>
                <th scope="row">{PARAM_LABELS[p]}</th>
                {SOURCES.map((s) => (
                  <td key={s}>{pmText(data[p][s])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
