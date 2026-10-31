// 折れ線グラフ（§7.8・§7.10）。ライブラリを使わず SVG で組む。
// 線は色だけで区別せず、線種と線の端のラベルを併用する（§9、§16.4）。表を添える。
import { displayValue } from '../../engine/effects';

export interface Series {
  label: string;
  /** x の各点の値（内部値。表示は 0〜100 に丸める）。null は点なし */
  values: (number | null)[];
  dash: string;
  color: string;
  width?: number;
}

/** 6種類の線種：実線、破線、点線、一点鎖線、二点鎖線、長破線 */
export const DASHES = ['', '6 4', '1.5 3', '8 3 1.5 3', '8 3 1.5 3 1.5 3', '12 4', '3 3'];

export function LineChart({
  title,
  xLabels,
  series,
  highlight = [],
  height = 220,
}: {
  title: string;
  xLabels: string[];
  series: Series[];
  /** 強調する x の位置（比較で差が開いた章） */
  highlight?: number[];
  height?: number;
}) {
  const W = 340;
  const H = height;
  const left = 26;
  const right = 78; // 端のラベル用の余白
  const top = 10;
  const bottom = 22;
  const n = xLabels.length;
  const x = (i: number) => left + ((W - left - right) * i) / Math.max(1, n - 1);
  const y = (v: number) => top + (H - top - bottom) * (1 - displayValue(v).value / 100);

  // 端のラベルが重ならないように、縦の位置をずらす
  const ends = series
    .map((s, i) => {
      const lastIdx = s.values.map((v, j) => (v === null ? -1 : j)).filter((j) => j >= 0).at(-1);
      return lastIdx === undefined ? null : { i, yy: y(s.values[lastIdx]!), xx: x(lastIdx) };
    })
    .filter((e): e is { i: number; yy: number; xx: number } => e !== null)
    .sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k]!.yy - ends[k - 1]!.yy < 12) ends[k]!.yy = ends[k - 1]!.yy + 12;

  const summary = series
    .map((s) => {
      const vs = s.values.filter((v): v is number => v !== null).map((v) => displayValue(v).value);
      return `${s.label}：${vs[0]}から${vs.at(-1)}`;
    })
    .join('。');

  return (
    <figure style={{ margin: '8px 0' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}。${summary}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {highlight.map((i) => (
          <rect key={`h${i}`} x={x(i) - 9} y={top} width={18} height={H - top - bottom} fill="var(--caution-bg)" stroke="var(--f-chance)" stroke-dasharray="2 2" />
        ))}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={left - 4} y={y(v) + 3} font-size="9" text-anchor="end" fill="var(--text-sub)">
              {v}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - 6} font-size="9" text-anchor="middle" fill="var(--text-sub)">
            {l}
          </text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
          return (
            <g key={si}>
              <polyline points={pts.join(' ')} fill="none" stroke={s.color} stroke-width={s.width ?? 2} stroke-dasharray={s.dash} stroke-linejoin="round" />
              {s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={1.8} fill={s.color} />))}
            </g>
          );
        })}
        {ends.map((e) => {
          const s = series[e.i]!;
          return (
            <g key={`e${e.i}`}>
              <line x1={e.xx + 3} x2={e.xx + 14} y1={e.yy} y2={e.yy} stroke={s.color} stroke-width={s.width ?? 2} stroke-dasharray={s.dash} />
              <text x={e.xx + 17} y={e.yy + 3} font-size="10" fill="var(--text)">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <details>
        <summary>表で見る</summary>
        <div style={{ overflowX: 'auto' }}>
          <table class="data num">
            <caption class="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col"> </th>
                {xLabels.map((l, i) => (
                  <th key={i} scope="col">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.label}>
                  <th scope="row">{s.label}</th>
                  {s.values.map((v, i) => (
                    <td key={i}>{v === null ? '―' : displayValue(v).value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
