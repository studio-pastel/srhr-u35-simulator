// 7.2 主人公を選ぶ。4人を、それぞれの16歳の暮らしの場所に立つドット絵で見せる（付録B-1）。
// 特定の属性を強調する見出しは付けない。
import { useEffect, useRef } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { createRun } from '../../engine/progression';
import type { CharacterId } from '../../engine/schema';
import { mainStage } from '../review';
import { PixelStage } from '../components/PixelStage';

export function Select() {
  const { content, pending, setRun, animate } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);

  const start = (id: CharacterId) => {
    setRun(createRun(content, { protagonist: id, seed: pending.seed }));
    navigate('play');
  };

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        誰の人生を生きる？
      </h1>
      <p class="sub">同じ高校に通う、16歳の4人です。</p>
      <div class="char-grid">
        {content.characters.map((c) => {
          const look = content.cast.find((m) => m.id === c.id)!.look;
          const stage = mainStage(content, c.id, 16);
          const spec = { place: stage?.place ?? 'classroom', time: stage?.time ?? 'day', actors: [{ look, age: 16, x: 48 }] };
          return (
            <section class="panel char-card2" key={c.id} aria-labelledby={`ch-${c.id}`}>
              <PixelStage spec={spec} label={`${c.name}、16歳`} animate={animate} />
              <h2 id={`ch-${c.id}`}>{c.name}</h2>
              <p style={{ margin: '0 0 4px' }}>{c.profile}</p>
              <p class="sub" style={{ margin: 0 }}>
                {c.upbringingSummary}
              </p>
              <button type="button" class="btn primary" onClick={() => start(c.id)}>
                {c.name}で始める
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
