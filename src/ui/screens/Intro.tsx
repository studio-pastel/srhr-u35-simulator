// 最初の画面（付録B-45）。主旨、遊びかた、画面の見かた、安心して遊ぶための説明を1画面にまとめ、押せばすぐ始まる。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { isPersistent } from '../../engine/storage';
import { PARAM_KEYS, SOURCES } from '../../engine/constants';
import { createRun } from '../../engine/progression';
import { randomProfile } from '../../engine/profile';
import { newSeed } from '../../engine/rng';
import { PARAM_LABELS, SOURCE_LABELS } from '../../engine/types';
import type { SceneSpec } from '../pixel/render';
import { ParamIcon } from '../components/ParamIcons';
import { PixelStage } from '../components/PixelStage';

export function Intro() {
  const { run, content, animate, setRun } = useApp();
  const [confirming, setConfirming] = useState(false);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  const canResume = run !== null && run.position.step !== 'finished';
  const look = (id: string) => content.cast.find((c) => c.id === id)!.look;

  // タイトル：夕方の校門に、4人が並ぶ
  const title: SceneSpec = {
    place: 'gate',
    time: 'dusk',
    actors: content.presets.map((p) => p.id).map((id, i) => ({ look: look(id), age: 16, x: 18 + i * 20, face: 'normal' as const })),
  };

  const startNew = () => {
    // 進行中の周回を消してしまうので、もう一度押してもらう
    if (canResume && !confirming) {
      setConfirming(true);
      return;
    }
    const seed = newSeed();
    setRun(createRun(content, { profile: randomProfile(seed), seed }));
    navigate('birth');
  };

  return (
    <section class="onboarding fade-in">
      <div class="ob-title">
        <PixelStage spec={title} label="夕方の校門に、4人の高校生が並んでいる" animate={animate} />
        <h1 tabIndex={-1} ref={h} class="ob-logo">
          SRHR U35 SIMULATOR
        </h1>
        <p class="ob-tagline">
          どこに、どんな自分で生まれるかは選べない。
          <br />
          生まれてから35歳までの、誰かの人生を生きてみる。
        </p>
        {canResume && (
          <button type="button" class="btn primary" onClick={() => navigate('play')}>
            続きから遊ぶ
          </button>
        )}
        <button type="button" class={canResume ? 'btn' : 'btn primary'} onClick={startNew}>
          {confirming ? 'いまの人生を終えて、新しく始める' : canResume ? '新しく始める' : 'はじめる'}
        </button>
      </div>

      <div class="ob-grid">
        <div class="ob-card">
          <h2>このゲームについて</h2>
          <p>性別も、好きになる人も、家庭の状況も、ランダムに決まります。その人として進学、仕事、恋愛、妊娠、病気などの出来事を生き、セリフや行動を選びます。</p>
          <p>点数や「よい結末」はありません。いまは試作で、17歳までです。</p>
        </div>
        <div class="ob-card">
          <h2>画面の見かた</h2>
          <p>吹き出しや「次へ」を押して読み進めます。場面の下のパラメーターは、出来事のたびに動きます。</p>
          <ul class="ob-params">
            {PARAM_KEYS.map((k) => (
              <li key={k}>
                <ParamIcon param={k} size={16} />
                {PARAM_LABELS[k]}
              </li>
            ))}
          </ul>
          <p>変化には、5つの理由があります。人生は、選択だけでは決まりません。</p>
          <ul class="ob-factors">
            {SOURCES.map((s) => (
              <li key={s} class={`ob-factor f-${s}`}>
                {SOURCE_LABELS[s]}
              </li>
            ))}
          </ul>
        </div>
        <div class="ob-card">
          <h2>安心して遊ぶために</h2>
          <ul class="ob-safety">
            <li>
              <span class="ob-key ob-exit">すぐに閉じる</span>
              <span>右上のボタンか Esc キーで、すぐに別のページに移ります。「戻る」でも、このサイトには戻りません。</span>
            </li>
            <li>
              <span class="ob-key">この場面をとばす</span>
              <span>性や暴力の場面もあります。行為そのものは描きません。どの場面でもとばせます。</span>
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
        </div>
      </div>
    </section>
  );
}
