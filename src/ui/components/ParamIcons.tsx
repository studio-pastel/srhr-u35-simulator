// 6つのパラメーターのアイコン（自作の SVG）と、いつも小さく出すステータス、変化カード（付録B-28）。
import { useEffect, useState } from 'preact/hooks';
import { PARAM_KEYS } from '../../engine/constants';
import type { ParamKey } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS, type LedgerEntry, type Params } from '../../engine/types';
import { displayValue } from '../../engine/effects';

const PATHS: Record<ParamKey, string> = {
  // からだ：ハート
  body: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  // 安全：盾
  safety: 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z',
  // 心理的安全：手のひらで包む
  psychSafety: 'M4 13c2 0 3 1 4 2h4a2 2 0 0 1 0 4H7M4 13v7M20 9a3 3 0 1 1-6 0a3 3 0 0 1 6 0z',
  // 選択肢の幅：分かれ道
  options: 'M12 21v-7M12 14l-6-6M12 14l6-6M6 8V4M18 8V4M4 6l2-2l2 2M16 6l2-2l2 2',
  // つながり：つながった輪
  connection: 'M9 15a4 4 0 1 1 0-6M15 9a4 4 0 1 1 0 6M8 12h8',
  // 自己決定：方位磁針
  autonomy: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM15 9l-2 5l-4 1l2-5z',
};

export function ParamIcon({ param, size = 18 }: { param: ParamKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="param-icon">
      <path d={PATHS[param]} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** 場面の下にいつも出す、6つのアイコンと小さなゲージ。変化したものは光らせる */
export function StatusBar({ params, changed, onOpen }: { params: Params; changed: ParamKey[]; onOpen: () => void }) {
  return (
    <button type="button" class="status-bar" onClick={onOpen} aria-label="パラメーターと記録を開く">
      {PARAM_KEYS.map((k) => {
        const v = displayValue(params[k]).value;
        return (
          <span key={k} class={`status-item${changed.includes(k) ? ' changed' : ''}`}>
            <ParamIcon param={k} size={16} />
            <span class="status-gauge" aria-hidden="true">
              <span style={{ width: `${v}%` }} />
            </span>
            <span class="sr-only">
              {PARAM_LABELS[k]} {v}
            </span>
          </span>
        );
      })}
    </button>
  );
}

/** 選んだ直後に出す変化カード。もとの値から新しい値へゲージが伸び縮みし、理由を添える */
export function ChangeCard({ entries, before, animate, onClose }: { entries: LedgerEntry[]; before: Params; animate: boolean; onClose: () => void }) {
  const byParam = new Map<ParamKey, LedgerEntry[]>();
  for (const e of entries) byParam.set(e.param, [...(byParam.get(e.param) ?? []), e]);
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <div class="change-card" role="status" aria-live="polite">
      {[...byParam.entries()].map(([k, list]) => {
        const delta = list.reduce((a, e) => a + e.delta, 0);
        const from = displayValue(before[k]).value;
        const to = displayValue(before[k] + delta).value;
        return (
          <div key={k} class={`change-row ${delta >= 0 ? 'up' : 'down'}`}>
            <div class="change-head">
              <ParamIcon param={k} size={20} />
              <span class="change-label">{PARAM_LABELS[k]}</span>
              <span class="change-gauge" aria-hidden="true">
                <span class="change-fill" style={{ width: `${grown ? to : from}%` }} />
                <span class="change-mark" style={{ left: `${from}%` }} />
              </span>
              <span class="change-delta num">{delta > 0 ? `+${delta}` : delta}</span>
            </div>
            <p class="change-reasons">
              {list.map((e, i) => (
                <span key={i} class={`reason f-${e.source}`}>
                  {e.note}（{SOURCE_LABELS[e.source]}）
                </span>
              ))}
            </p>
          </div>
        );
      })}
      <button type="button" class="change-ok" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}
