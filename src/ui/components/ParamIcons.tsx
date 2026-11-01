// 4つのパラメーターのアイコン（自作の SVG）と、いつも出すステータス（付録B-28・B-40）。
import { useEffect, useRef, useState } from 'preact/hooks';
import { PARAM_KEYS } from '../../engine/constants';
import type { ParamKey } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS, type LedgerEntry, type Params } from '../../engine/types';
import { displayValue } from '../../engine/effects';

const PATHS: Record<ParamKey, string> = {
  // からだ：ハート
  body: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  // つながり：つながった輪
  connection: 'M9 15a4 4 0 1 1 0-6M15 9a4 4 0 1 1 0 6M8 12h8',
  // 自己決定：方位磁針
  autonomy: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM15 9l-2 5l-4 1l2-5z',
  // くらし：家
  living: 'M4 11l8-7l8 7M6 10v10h12V10M10 20v-6h4v6',
};

export function ParamIcon({ param, size = 18 }: { param: ParamKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="param-icon">
      <path d={PATHS[param]} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** 数字を、もとの値から新しい値へ数え上げる */
function CountUp({ value, animate }: { value: number; animate: boolean }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (!animate || from === value) {
      setShown(value);
      return;
    }
    const steps = 18;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(Math.round(from + ((value - from) * i) / steps));
      if (i >= steps) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [value, animate]);
  return <span class="status-value num">{shown}</span>;
}

/**
 * 場面の下にいつも出す4つのパラメーター（付録B-40・B-47）。名前・数字・ゲージを常に見せる。
 * 動いたときは、増減の数字が飛び出し、数字が数え上がり、ゲージが伸び縮みする。
 */
export function StatusBar({ params, change, animate, onOpen }: { params: Params; change: { entries: LedgerEntry[]; stamp: number } | null; animate: boolean; onOpen?: () => void }) {
  const items = PARAM_KEYS.map((k) => {
        const v = displayValue(params[k]).value;
        const delta = (change?.entries ?? []).filter((e) => e.param === k).reduce((a, e) => a + e.delta, 0);
        const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
        return (
          <span key={`${k}-${delta ? change!.stamp : 0}`} class={`status-item ${dir}`}>
            <span class="status-head">
              <ParamIcon param={k} size={16} />
              <span class="status-name">{PARAM_LABELS[k]}</span>
              <CountUp value={v} animate={animate} />
            </span>
            <span class="status-gauge" aria-hidden="true">
              <span style={{ width: `${v}%` }} />
            </span>
            {delta !== 0 && (
              <span class={`status-float ${dir} num`} aria-hidden="true">
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </span>
        );
  });
  // 開くものがない画面（生い立ち）では、押せる形にしない
  if (!onOpen)
    return (
      <div class="status-bar" role="group" aria-label="パラメーター">
        {items}
      </div>
    );
  return (
    <button type="button" class="status-bar" onClick={onOpen} aria-label="パラメーターと記録を開く">
      {items}
    </button>
  );
}

/** 変化の理由。絵をふさがず、ステータスのすぐ下に出す */
export function ChangeNotes({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul class="change-notes" role="status" aria-live="polite">
      {entries.map((e, i) => (
        <li key={i} class={`reason f-${e.source}`}>
          <strong class="num">
            {PARAM_LABELS[e.param]} {e.delta > 0 ? `+${e.delta}` : e.delta}
          </strong>{' '}
          {e.note}（{SOURCE_LABELS[e.source]}）
        </li>
      ))}
    </ul>
  );
}
