// 話している人の顔アイコン（付録B-27）。装飾として扱い、名前は必ず文字で添える。
import { useEffect, useRef } from 'preact/hooks';
import { drawFace, type Face, type Look } from '../pixel/render';

export function FaceIcon({ look, age, face }: { look: Look; age: number; face?: Face }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawFace(ref.current, look, age, face ?? 'normal');
  }, [JSON.stringify(look), age, face]);
  return <canvas ref={ref} class="face-icon" aria-hidden="true" />;
}
