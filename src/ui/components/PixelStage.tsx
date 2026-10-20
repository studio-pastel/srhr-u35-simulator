// ドット絵の場面を描く canvas。演出を減らす設定のときは、呼吸やまばたきの動きを止める。
import { useEffect, useRef } from 'preact/hooks';
import { drawScene, type SceneSpec } from '../pixel/render';

export function PixelStage({ spec, label, animate }: { spec: SceneSpec; label: string; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(spec);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    drawScene(cv, spec);
    if (!animate) return;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      // 呼吸：0.6秒ごとに上半身を1ドット上下。まばたき：およそ4秒に1回
      const bob = Math.floor(tick / 2) % 2;
      drawScene(cv, { ...spec, actors: spec.actors.map((a, i) => ({ ...a, bob, blink: (tick + i * 3) % 14 === 0 })) });
    }, 300);
    return () => clearInterval(id);
  }, [key, animate]);
  return <canvas ref={ref} class="pixel-stage" role="img" aria-label={label} />;
}
