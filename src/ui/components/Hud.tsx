// 5パラメーターのミニゲージ（§16.2）。タップで章のふりかえりの途中経過を開く。
import { useEffect, useRef, useState } from 'preact/hooks';
import { PARAM_KEYS } from '../../engine/constants';
import type { ParamKey } from '../../engine/schema';
import { PARAM_LABELS, type Params } from '../../engine/types';
import { displayValue } from '../../engine/effects';

export function Hud({ params, onOpen, quiet }: { params: Params; onOpen: () => void; quiet: boolean }) {
  const prev = useRef<Params>(params);
  const [deltas, setDeltas] = useState<Partial<Record<ParamKey, number>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 変化量（例：+10）を1秒表示する（§16.6）
  useEffect(() => {
    const d: Partial<Record<ParamKey, number>> = {};
    for (const k of PARAM_KEYS) {
      const diff = params[k] - prev.current[k];
      if (diff !== 0) d[k] = diff;
    }
    prev.current = params;
    if (Object.keys(d).length === 0) return;
    setDeltas(d);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDeltas({}), 1000);
  }, [params]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button type="button" class="hud" onClick={onOpen} aria-label="パラメーター。押すと、この章の途中経過を開きます">
      {PARAM_KEYS.map((k) => {
        const v = displayValue(params[k]);
        const d = deltas[k];
        return (
          <span class="hud-row" key={k}>
            <span>{PARAM_LABELS[k]}</span>
            <span class="hud-bar" aria-hidden="true">
              {/* 暴力を扱うイベントでは、減少を強調する演出を使わない（§16.6） */}
              <span class="hud-fill" style={{ width: `${v.value}%`, display: 'block', transition: quiet ? 'none' : undefined }} />
            </span>
            <span class="num">
              {v.value}
              {v.clamped && <span class="sr-only">（{v.clamped === 'upper' ? '上限' : '下限'}に達しています）</span>}
              {v.clamped && <span aria-hidden="true">{v.clamped === 'upper' ? '▲' : '▼'}</span>}
              {d !== undefined && <span class="hud-delta"> {d > 0 ? `+${d}` : d}</span>}
            </span>
          </span>
        );
      })}
    </button>
  );
}
