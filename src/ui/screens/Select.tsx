// 7.2 主人公を選ぶ。特定の属性を強調する見出しは付けない。
import { useEffect, useRef } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { createRun } from '../../engine/progression';
import { Avatar } from '../components/Avatar';
import { avatarsFor } from '../../engine/avatar';
import type { CharacterId } from '../../engine/schema';

export function Select() {
  const { content, pending, setPending, setRun } = useApp();
  const avatars = avatarsFor(pending.seed, pending.salts);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);

  const reroll = (id: CharacterId) => setPending({ ...pending, salts: { ...pending.salts, [id]: pending.salts[id] + 1 } });
  const start = (id: CharacterId) => {
    setRun(createRun(content, { protagonist: id, seed: pending.seed, avatarSalts: pending.salts }));
    navigate('play');
  };

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        主人公を選ぶ
      </h1>
      <p class="sub">同じ高校の同級生4人です。誰の人生をたどるかを選んでください。</p>
      {content.characters.map((c) => (
        <section class="panel" key={c.id} aria-labelledby={`ch-${c.id}`}>
          <div class="char-card">
            <Avatar spec={avatars[c.id]} size={72} />
            <div>
              <h2 id={`ch-${c.id}`}>{c.name}</h2>
              <p style={{ margin: '0 0 4px' }}>{c.profile}</p>
              <p class="sub" style={{ margin: 0 }}>
                {c.upbringingSummary}
              </p>
            </div>
          </div>
          <button type="button" class="btn primary" onClick={() => start(c.id)}>
            {c.name}で始める
          </button>
          <button type="button" class="btn small" onClick={() => reroll(c.id)} aria-label={`${c.name}の見た目を変える`}>
            見た目を変える
          </button>
        </section>
      ))}
    </>
  );
}
