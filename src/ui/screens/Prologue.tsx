// 0〜15歳の生い立ち（付録B-45・B-47）。年表が自動で進み、出来事の積み重ねとして15歳のパラメーターが決まる。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { lifeStory } from '../../engine/lifestory';
import { PARAM_LABELS, SOURCE_LABELS, type Params } from '../../engine/types';
import { StatusBar } from '../components/ParamIcons';
import { PixelStage } from '../components/PixelStage';
import { sceneSpec } from '../stage';

/** 1行を見せる時間。読める長さに合わせる */
const entryMs = (text: string) => 600 + 40 * [...text].length;

export function Prologue() {
  const { run, content, animate, setLifeAge } = useApp();
  const story = useMemo(() => (run ? lifeStory(content, run) : []), [run?.runId]);
  // 演出を減らす設定では、自動で動かさず、はじめから全部を見せる
  const [shown, setShown] = useState(animate ? 1 : story.length);
  const [paused, setPaused] = useState(false);
  const done = shown >= story.length;
  const age = story[Math.max(shown - 1, 0)]?.age ?? 0;

  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), [done]);
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest', behavior: animate ? 'smooth' : 'auto' }), [shown]);
  useEffect(() => setLifeAge(age), [age]);

  useEffect(() => {
    if (done || paused) return;
    const id = setTimeout(() => setShown(shown + 1), entryMs(story[shown - 1]?.text ?? ''));
    return () => clearTimeout(id);
  }, [shown, paused, done]);

  if (!run) {
    return (
      <>
        <h1>進行中の周回がありません</h1>
        <button type="button" class="btn primary" onClick={() => navigate('intro')}>
          はじめの画面へ
        </button>
      </>
    );
  }

  const p = run.profile;
  const params = paramsAt(content.characters[0]!.initial, story.slice(0, shown));
  const stage = [...content.prologue.stages].reverse().find((s) => s.from <= age)?.stage;
  const at = { ...run, position: { ...run.position, age } };

  return (
    <section class="fade-in prologue">
      <h1 tabIndex={-1} ref={h} class="prologue-title">
        {done ? `私（${p.name}）、15歳` : `私（${p.name}）の15年`}
      </h1>
      <div class="stage-sticky">
        <div class="stage-wrap">
          <PixelStage spec={sceneSpec(content, at, stage)} label={`${p.name}、${age}歳`} animate={animate} />
        </div>
        <StatusBar params={params} change={null} animate={animate} />
      </div>

      <ol class="life-log" aria-live="polite">
        {story.slice(0, shown).map((e, i) => (
          <li key={i} ref={i === shown - 1 ? endRef : undefined} class={e.effects.length ? 'has-effects' : ''}>
            <span class="life-log-age num">{e.age}歳</span>
            <div>
              <p class={e.kind === 'inner' ? 'inner' : ''}>{e.text}</p>
              {e.effects.map((x, k) => (
                <p key={k} class="reason f-upbringing">
                  <strong class="num">
                    {PARAM_LABELS[x.param]} {x.delta > 0 ? `+${x.delta}` : x.delta}
                  </strong>{' '}
                  {x.note}（{SOURCE_LABELS.upbringing}）
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {done ? (
        <>
          <p class="sub">どれも、選んだことではありません。ランダムに決まりました（ひとり親になった理由の割合は統計に基づき、ほかは遊びのための値です）。</p>
          <button type="button" class="btn primary" onClick={() => navigate('play')}>
            16歳へ
          </button>
        </>
      ) : (
        <div class="scene-tools">
          <button type="button" class="tool" onClick={() => setPaused(!paused)}>
            {paused ? '再生する' : '一時停止'}
          </button>
          <button type="button" class="tool" onClick={() => setShown(story.length)}>
            15歳までとばす
          </button>
        </div>
      )}
    </section>
  );
}

function paramsAt(base: Params, entries: { effects: { param: keyof Params; delta: number }[] }[]): Params {
  const out = { ...base };
  for (const e of entries) for (const x of e.effects) out[x.param] += x.delta;
  return out;
}
