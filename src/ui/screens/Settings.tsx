// 7.14 設定
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../app';
import { clearAll, DEFAULT_SETTINGS, isPersistent, setPersistent } from '../../engine/storage';

export function SettingsScreen() {
  const { settings, setSettings, setRun } = useApp();
  const [persist, setPersist] = useState(isPersistent);
  const [confirmPersist, setConfirmPersist] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);

  const turnOn = () => {
    if (setPersistent(true)) {
      setPersist(true);
      setMessage('この端末に保存するようにしました。');
    } else setMessage('この端末では保存できませんでした。タブを閉じると消える保存のまま続けます。');
    setConfirmPersist(false);
  };
  const turnOff = () => {
    setPersistent(false);
    setPersist(false);
    setMessage('タブを閉じると消える保存に戻しました。端末に残っていたデータは消しました。');
  };
  const clear = () => {
    clearAll();
    setRun(null);
    setSettings({ ...DEFAULT_SETTINGS });
    setPersist(false);
    setConfirmClear(false);
    setMessage('保存したデータを消しました。');
  };

  const Toggle = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
    <div class="toolbar" role="group" aria-label={label} style={{ fontSize: 15, margin: '8px 0' }}>
      <span style={{ minWidth: '7em' }}>{label}</span>
      <button type="button" class="toggle" aria-pressed={on} onClick={() => onChange(true)}>
        オン
      </button>
      <button type="button" class="toggle" aria-pressed={!on} onClick={() => onChange(false)}>
        オフ
      </button>
    </div>
  );

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        設定
      </h1>
      <div aria-live="polite">{message && <p class="panel">{message}</p>}</div>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>保存の方法</h2>
        <p class="sub">
          いまは「{persist ? 'この端末に保存' : 'タブを閉じると消える保存'}」です。
        </p>
        {!persist && !confirmPersist && (
          <button type="button" class="btn" onClick={() => setConfirmPersist(true)}>
            この端末に保存して、あとで続きから遊ぶ
          </button>
        )}
        {confirmPersist && (
          <div class="panel caution">
            <p style={{ marginTop: 0 }}>この端末を他の人も使う場合、その人に進行状況を見られる可能性があります。</p>
            <button type="button" class="btn primary" onClick={turnOn}>
              それでも、この端末に保存する
            </button>
            <button type="button" class="btn" onClick={() => setConfirmPersist(false)}>
              やめる
            </button>
          </div>
        )}
        {persist && (
          <button type="button" class="btn" onClick={turnOff}>
            タブを閉じると消える保存に戻す
          </button>
        )}
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>保存したデータを消す</h2>
        {!confirmClear ? (
          <button type="button" class="btn" onClick={() => setConfirmClear(true)}>
            保存したデータを消す
          </button>
        ) : (
          <>
            <p>進行状況と設定を、この端末から消します。元に戻せません。</p>
            <button type="button" class="btn primary" onClick={clear}>
              消す
            </button>
            <button type="button" class="btn" onClick={() => setConfirmClear(false)}>
              やめる
            </button>
          </>
        )}
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>表示</h2>
        <div class="toolbar" role="group" aria-label="文字の大きさ" style={{ fontSize: 15, margin: '8px 0' }}>
          <span style={{ minWidth: '7em' }}>文字の大きさ</span>
          <button type="button" class="toggle" aria-pressed={settings.fontSize === 'normal'} onClick={() => setSettings({ ...settings, fontSize: 'normal' })}>
            標準
          </button>
          <button type="button" class="toggle" aria-pressed={settings.fontSize === 'large'} onClick={() => setSettings({ ...settings, fontSize: 'large' })}>
            大
          </button>
        </div>
        <Toggle label="ルビ" on={settings.ruby} onChange={(v) => setSettings({ ...settings, ruby: v })} />
        <Toggle label="演出" on={settings.motion} onChange={(v) => setSettings({ ...settings, motion: v })} />
        <p class="sub">端末で「視差効果を減らす」などの設定をしている場合は、ここがオンでも演出をしません。</p>
      </section>
    </>
  );
}
