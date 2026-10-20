// 7.9 2周目を選ぶ
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { CHARACTER_IDS } from '../../engine/constants';
import { getCharacter } from '../../engine/progression';
import { startReplay, switchableConditions, type ReplayRequest } from '../../engine/replay';
import { loadHistory } from '../../engine/storage';

export function ReplayScreen() {
  const { content, run, setRun } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);
  // 前の周回：いま終えた周回か、保存してある最後の周回
  const prev = run?.position.step === 'finished' ? run : loadHistory().at(-1);
  const [cond, setCond] = useState<{ id: string; to: string } | null>(null);

  if (!prev) {
    return (
      <>
        <h1 tabIndex={-1} ref={h}>
          2周目を選ぶ
        </h1>
        <p>終えた周回がありません。まず1周、遊んでみてください。</p>
        <button type="button" class="btn primary" onClick={() => navigate('select')}>
          主人公を選ぶ
        </button>
      </>
    );
  }

  const me = getCharacter(content, prev.protagonist);
  const start = (req: ReplayRequest) => {
    setRun(startReplay(content, prev, req));
    navigate('play');
  };
  const conds = switchableConditions(content, prev.protagonist);

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        2周目を選ぶ
      </h1>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>別の主人公で遊ぶ</h2>
        <p class="sub">同じ同級生の、別の人生をたどります。</p>
        {CHARACTER_IDS.filter((id) => id !== prev.protagonist).map((id) => (
          <button key={id} type="button" class="btn" onClick={() => start({ kind: 'protagonist', protagonist: id })}>
            {getCharacter(content, id).name}で遊ぶ
          </button>
        ))}
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>{me.name}で、社会条件を1つだけ変える</h2>
        <p class="sub">{me.name}の人生に関わる社会のしくみを1つ変えて、もう一度たどります。終わったあとで、前の周回と比べられます。</p>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend class="sr-only">変える社会条件</legend>
          {conds.map((c) => {
            const current = prev.conditions[c.id];
            return (
              <div key={c.id} style={{ margin: '12px 0' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{c.label}</p>
                <p class="sub" style={{ margin: 0 }}>
                  いま：{c.options.find((o) => o.id === current)?.label ?? '未設定'}
                </p>
                {c.options
                  .filter((o) => o.id !== current)
                  .map((o) => (
                    <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: 44, padding: '6px 0' }}>
                      <input
                        type="radio"
                        name="cond"
                        checked={cond?.id === c.id && cond.to === o.id}
                        onChange={() => setCond({ id: c.id, to: o.id })}
                        style={{ marginTop: 6 }}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
              </div>
            );
          })}
        </fieldset>
        <button type="button" class="btn primary" disabled={!cond} onClick={() => cond && start({ kind: 'condition', condition: cond.id, to: cond.to, sameSeed: true })}>
          同じ偶然で、条件だけ変える
        </button>
        <p class="sub" style={{ marginTop: 0 }}>確率で決まる出来事の「出た値」を前の周回と同じにします。変えた条件のちがいだけを比べられます。</p>
        <button type="button" class="btn" disabled={!cond} onClick={() => cond && start({ kind: 'condition', condition: cond.id, to: cond.to, sameSeed: false })}>
          偶然も変える
        </button>
      </section>
    </>
  );
}
