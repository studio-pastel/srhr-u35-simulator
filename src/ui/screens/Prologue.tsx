// 生まれてから15歳まで（付録B-45）。自分で決められなかったことを、短い場面でたどって、この人を知る。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import { check } from '../../engine/flags';
import { contextOf } from '../../engine/progression';
import { ATTRACTION_LABELS, GENDER_LABELS, initialReasons, type Profile } from '../../engine/profile';
import { PARAM_LABELS, SOURCE_LABELS } from '../../engine/types';
import { Hud } from '../components/Hud';
import { PixelStage } from '../components/PixelStage';
import { sceneSpec, type ShownLine } from '../stage';
import { ChatLine } from './Play';

function homeWords(p: Profile): string[] {
  return [
    p.economy === 'hardship' ? '家計が苦しい' : '家計はふつう',
    ...(p.singleParent ? ['ひとり親の家庭'] : []),
    ...(p.familyCare ? ['きょうだいの世話をしている'] : []),
    ...(p.witnessedDV ? ['親のあいだの暴力を見て育った'] : []),
    p.talkAboutSex ? '家で性やからだの話ができる' : '家で性やからだの話ができない',
  ];
}

export function Prologue() {
  const { run, content, setRun, animate } = useApp();
  const [pageIndex, setPageIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), [pageIndex]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end', behavior: animate ? 'smooth' : 'auto' }), [lineIndex]);

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

  const pages = content.prologue.pages;
  const page = pages[pageIndex];
  const p = run.profile;

  if (!page) {
    const reasons = initialReasons(p);
    return (
      <section class="fade-in prologue">
        <h1 tabIndex={-1} ref={h}>
          私（{p.name}）、15歳
        </h1>
        <div class="review-grid">
          <div class="panel">
            <h2 style={{ marginTop: 0 }}>ここまでの私</h2>
            <dl class="prologue-facts">
              <dt>性自認</dt>
              <dd>{GENDER_LABELS[p.gender]}</dd>
              <dt>好きになる人</dt>
              <dd>{ATTRACTION_LABELS[p.attractedTo]}</dd>
              <dt>からだ</dt>
              <dd>{p.body === 'canBePregnant' ? '月経がある' : '月経はない'}</dd>
              <dt>家庭</dt>
              <dd>{homeWords(p).join('、')}</dd>
            </dl>
            <p class="sub" style={{ marginBottom: 0 }}>
              どれも、選んだことではありません。ランダムに決まりました（確率は遊びのための値で、現実の割合ではありません）。
            </p>
          </div>
          <div class="panel">
            <h2 style={{ marginTop: 0 }}>はじまりのパラメーター</h2>
            <Hud params={run.params} onOpen={() => undefined} quiet />
            {reasons.length > 0 && (
              <ul class="plain prologue-reasons">
                {reasons.map((r, i) => (
                  <li key={i} class="reason f-upbringing">
                    <strong class="num">
                      {PARAM_LABELS[r.param]} {r.delta}
                    </strong>{' '}
                    {r.note}（{SOURCE_LABELS.upbringing}）
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button type="button" class="btn primary" onClick={() => navigate('play')}>
          16歳へ
        </button>
      </section>
    );
  }

  // 舞台と人物の年齢は、そのページの年齢で描く
  const at = { ...run, position: { ...run.position, age: page.age } };
  const ctx = contextOf(content, at);
  const lines: ShownLine[] = page.lines
    .filter((l) => check(l.when, ctx))
    .map((l) => ({
      who: l.kind === 'inner' ? 'me' : 'narration',
      name: l.kind === 'inner' ? `${p.name}（心の声）` : '',
      kind: l.kind,
      text: l.text.replace('%name%', p.name),
    }));
  const i = Math.min(lineIndex, lines.length - 1);
  const atLast = i >= lines.length - 1;
  const nextPage = () => {
    setLineIndex(0);
    setPageIndex(pageIndex + 1);
  };

  return (
    <section class="scene prologue" key={page.id}>
      <p class="interlude-elapsed num">{page.age === 0 ? '0歳' : `${page.age}歳`}</p>
      <h1 tabIndex={-1} ref={h} class="interlude-title">
        {page.title}
      </h1>
      <div class="stage-sticky">
        <div class="stage-wrap">
          <PixelStage spec={sceneSpec(content, at, page.stage)} label={`${p.name}、${page.age}歳`} animate={animate} />
        </div>
      </div>
      <div class="chat-log" aria-live="polite">
        {lines.slice(0, i + 1).map((l, k) => (
          <ChatLine key={k} run={at} line={l} typing={false} typed={0} />
        ))}
        <div ref={endRef} />
      </div>
      {atLast && page.likes ? (
        <div role="group" aria-label="選択肢" class="choices">
          {page.likes.map((c) => (
            <button
              key={c.id}
              type="button"
              class="btn choice"
              onClick={() => {
                setRun({ ...run, profile: { ...p, likes: c.id } });
                nextPage();
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" class="next-tap" onClick={() => (atLast ? nextPage() : setLineIndex(i + 1))}>
          ▼ 次へ
        </button>
      )}
      <div class="scene-tools">
        <button type="button" class="tool" onClick={() => setPageIndex(pages.length)}>
          15歳までとばす
        </button>
      </div>
    </section>
  );
}
