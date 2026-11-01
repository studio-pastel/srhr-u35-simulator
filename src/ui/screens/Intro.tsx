// 表紙（付録B-46・B-47）。なぜ遊ぶのかを統計で見せ、SRHR とプレコンセプションケアを説明し、遊びかたをまとめる。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { isPersistent } from '../../engine/storage';
import { PARAM_KEYS, SOURCES } from '../../engine/constants';
import { createRun } from '../../engine/progression';
import { randomProfile } from '../../engine/profile';
import { newSeed } from '../../engine/rng';
import { PARAM_HINTS, PARAM_LABELS, SOURCE_LABELS } from '../../engine/types';
import type { Look } from '../../engine/schema';
import { ExternalLink } from '../components/Cards';
import { ParamIcon } from '../components/ParamIcons';
import { FaceIcon } from '../components/Faces';
import { RichText } from '../components/RichText';

export function Intro() {
  const { run, content, setRun } = useApp();
  const [confirming, setConfirming] = useState(false);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  const canResume = run !== null && run.position.step !== 'finished';
  // 同じ人が、0歳から35歳まで年を重ねていく
  const look = content.cast.find((c) => c.id === content.presets[0]!.id)!.look as Look;
  const home = content.home;

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

  const buttons = (
    <>
      {canResume && (
        <button type="button" class="btn primary" onClick={() => navigate('play')}>
          続きから遊ぶ
        </button>
      )}
      <button type="button" class={canResume ? 'btn' : 'btn primary'} onClick={startNew}>
        {confirming ? 'いまの人生を終えて、新しく始める' : canResume ? '新しく始める' : 'はじめる'}
      </button>
    </>
  );

  return (
    <div class="cover-page fade-in">
      <section class="cover">
        <div class="cover-inner">
          <p class="cover-brand">SRHR U35 SIMULATOR</p>
          <h1 tabIndex={-1} ref={h} class="cover-catch">
            {home.catch.split('、').map((part, i, all) => (
              <span key={i}>{i < all.length - 1 ? `${part}、` : part}</span>
            ))}
          </h1>
          <p class="cover-lead">{home.lead}</p>
          <div class="cover-actions">{buttons}</div>
          <ol class="cover-line" aria-hidden="true">
            {[0, 6, 16, 27, 35].map((age) => (
              <li key={age}>
                <FaceIcon look={look} age={age} />
                <span class="num">{age}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {home.themes.map((t, i) => (
        <section key={t.title} class="cover-theme">
          <div class="cover-theme-head">
            <span class="cover-index num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h2>{t.title}</h2>
            <p>{t.body}</p>
            <p class="home-play">{t.play}</p>
          </div>
          <div class="cover-stats">
            {t.stats.map((x) => {
              const s = content.stats.find((y) => y.id === x.id)!;
              return (
                <div key={x.id} class="stat-tile">
                  <span class="stat-big num">{x.big}</span>
                  <p>
                    <RichText text={s.cardText} />
                  </p>
                  <p class="stat-source">
                    <ExternalLink href={s.source.url}>{s.source.title}</ExternalLink>（{s.source.year}）
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section class="cover-explain">
        {home.explain.map((e) => (
          <article key={e.title}>
            <h2>{e.title}</h2>
            <p>{e.body}</p>
            {e.source && (
              <p class="stat-source">
                <ExternalLink href={e.source.url}>{e.source.label}</ExternalLink>
              </p>
            )}
          </article>
        ))}
      </section>

      <section class="cover-guide">
        <div>
          <h2>遊びかた</h2>
          <p>性別も、好きになる人も、家族の歩みも、ランダムに決まります。0歳から15歳までの生い立ちのあと、その人として吹き出しを読み進め、セリフや行動を選びます。</p>
          <p>点数や「よい結末」はありません。いまは試作で、17歳までです。</p>
        </div>
        <div>
          <h2>パラメーター</h2>
          <ul class="cover-params">
            {PARAM_KEYS.map((k) => (
              <li key={k}>
                <ParamIcon param={k} size={18} />
                <span>
                  <strong>{PARAM_LABELS[k]}</strong>
                  {PARAM_HINTS[k]}
                </span>
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
        <div>
          <h2>安心して遊ぶために</h2>
          <ul class="ob-safety">
            <li>
              <span class="ob-key">この場面をとばす</span>
              <span>性や暴力の場面もあります。行為そのものは描きません。どの場面でもとばせます。</span>
            </li>
            <li>
              <span class="ob-key">話せる場所</span>
              <span>画面のいちばん下の「私も相談したいことがある」から、いつでも相談先を見られます。</span>
            </li>
            <li>
              <span class="ob-key">Esc キー</span>
              <span>すぐに別のページへ移ります。「戻る」でも、このサイトには戻りません。</span>
            </li>
            <li>
              <span class="ob-key">保存</span>
              <span>{isPersistent() ? 'この端末に保存しています。' : 'タブを閉じると消えます。'}本名などの個人情報は聞きません。</span>
            </li>
          </ul>
        </div>
      </section>

      <div class="home-cta">{buttons}</div>
    </div>
  );
}
