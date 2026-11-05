// 場面を描く canvas（付録B-57：まめ）。演出を減らす設定のときは、呼吸やまばたきの動きを止める。
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
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // 1秒に20回描けば、ゆっくりした呼吸には十分
      if (now - last < 50) return;
      last = now;
      const t = (now - start) / 1000;
      drawScene(cv, {
        ...spec,
        actors: spec.actors.map((a, i) => ({
          ...a,
          // 呼吸：およそ4秒で1回、人ごとに少しずらす
          bob: (1 - Math.cos(((t + i * 1.3) / 3.8) * Math.PI * 2)) / 2,
          // まばたき：およそ5秒に1回、0.15秒
          blink: (t + i * 1.7) % 5.2 < 0.15,
        })),
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [key, animate]);
  return <canvas ref={ref} class="pixel-stage" role="img" aria-label={label} />;
}
