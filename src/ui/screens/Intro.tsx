// オンボーディング（付録B-24）：タイトル → あそびかた → 安心して遊ぶために。
// 1画面に伝えることを1つにしぼり、ドット絵で見せる。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { isPersistent } from '../../engine/storage';
import { SOURCES } from '../../engine/constants';
import { SOURCE_LABELS } from '../../engine/types';
import type { SceneSpec } from '../pixel/render';
import { PixelStage } from '../components/PixelStage';

export function Intro() {
  const { run, content, animate } = useApp();
  const [step, setStep] = useState(0);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), [step]);
  const canResume = run !== null && run.position.step !== 'finished';
  const look = (id: string) => content.cast.find((c) => c.id === id)!.look;

  // タイトル：夕方の校門に、4人が並ぶ
  const title: SceneSpec = {
    place: 'gate',
    time: 'dusk',
    actors: content.presets.map((p) => p.id).map((id, i) => ({ look: look(id), age: 16, x: 18 + i * 20, face: 'normal' as const })),
  };
  // あそびかた：一人が、相手の言葉を聞いている
  const talk: SceneSpec = {
    place: 'classroom',
    time: 'day',
    actors: [
      { look: look('minami'), age: 16, x: 30, face: 'anxious' },
      { look: look('riko'), age: 16, x: 64, face: 'smile' },
    ],
  };

  return (
    <section class="onboarding">
      {step === 0 && (
        <div class="ob-title fade-in">
          <PixelStage spec={title} label="夕方の校門に、4人の高校生が並んでいる" animate={animate} />
          <h1 tabIndex={-1} ref={h} class="ob-logo">
            SRHR U35 SIMULATOR
          </h1>
          <p class="ob-tagline">
            16歳から35歳まで。
            <br />
            あなたの人生を、組み立てて生きてみる。
          </p>
          {canResume && (
            <button type="button" class="btn primary" onClick={() => navigate('play')}>
              続きから遊ぶ
            </button>
          )}
          <button type="button" class={canResume ? 'btn' : 'btn primary'} onClick={() => setStep(1)}>
            {canResume ? '新しく始める' : 'はじめる'}
          </button>
        </div>
      )}

      {step === 1 && (
        <div class="fade-in">
          <p class="ob-step num">1 / 2</p>
          <h1 tabIndex={-1} ref={h}>
            あそびかた
          </h1>
          <div class="ob-card">
            <PixelStage spec={talk} label="教室で、友だちと話している" animate={animate} />
            <h2>その人になって、選ぶ</h2>
            <p>吹き出しを押して読み進め、自分が言うセリフや、とる行動を選びます。</p>
          </div>
          <div class="ob-card">
            <h2>人生は、選択だけでは決まらない</h2>
            <p>変化には、5つの理由があります。</p>
            <ul class="ob-factors">
              {SOURCES.map((s) => (
                <li key={s} class={`ob-factor f-${s}`}>
                  {SOURCE_LABELS[s]}
                </li>
              ))}
            </ul>
          </div>
          <div class="ob-card">
            <h2>20年を、ふりかえる</h2>
            <ol class="life-strip" aria-label="章">
              {[...content.chapters]
                .sort((a, b) => a.age - b.age)
                .map((c) => (
                  <li key={c.age} class="life-dot future">
                    <span class="num">{c.age}</span>
                  </li>
                ))}
            </ol>
            <p>16歳から35歳まで。点数や「よい結末」はありません。いまは試作で、17歳までです。</p>
          </div>
          <button type="button" class="btn primary" onClick={() => setStep(2)}>
            次へ
          </button>
        </div>
      )}

      {step === 2 && (
        <div class="fade-in">
          <p class="ob-step num">2 / 2</p>
          <h1 tabIndex={-1} ref={h}>
            安心して遊ぶために
          </h1>
          <ul class="ob-safety">
            <li>
              <span class="ob-key ob-exit">すぐに閉じる</span>
              <span>右上のボタンか Esc キーで、すぐに別のページに移ります。「戻る」でも、このサイトには戻りません。</span>
            </li>
            <li>
              <span class="ob-key">この場面をとばす</span>
              <span>性や暴力の場面もあります。行為そのものは描きません。つらくなったら、どの場面でもとばせます。</span>
            </li>
            <li>
              <span class="ob-key">保存</span>
              <span>{isPersistent() ? 'この端末に保存しています。' : 'タブを閉じると消えます。'}本名などの個人情報は聞きません。</span>
            </li>
            <li>
              <span class="ob-key">話せる場所</span>
              <span>画面のいちばん下の「私も相談したいことがある」から、いつでも相談先を見られます。</span>
            </li>
          </ul>
          <button type="button" class="btn primary" onClick={() => navigate('select')}>
            主人公を組み立てる
          </button>
          <button type="button" class="tool" onClick={() => setStep(1)}>
            ◀ 戻る
          </button>
        </div>
      )}
    </section>
  );
}
