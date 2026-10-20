// プレイ画面（付録B）：幕間、会話中心の場面、確率カード、暴力の場面のあとの支援カード、章のふりかえり。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import {
  advanceChance,
  advanceReview,
  advanceScene,
  advanceStatCards,
  beginChapter,
  choose,
  currentEvent,
  currentScene,
  getChapter,
  getCharacter,
  onProtagonistTrack,
  skipEvent,
  sortedChapters,
  switchViewpoint,
  visibleChoices,
} from '../../engine/progression';
import { breakdown, displayValue, paramsFrom } from '../../engine/effects';
import { PARAM_KEYS } from '../../engine/constants';
import type { CharacterId } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS, type LedgerEntry, type RunState } from '../../engine/types';
import { Hud } from '../components/Hud';
import { Modal } from '../components/Modal';
import { FactorChart } from '../components/FactorChart';
import { ProbabilityCard, ResourceList, StatCard } from '../components/Cards';
import { RichText, plainText } from '../components/RichText';
import { PixelStage } from '../components/PixelStage';
import { OverallReview } from './OverallReview';
import { linesOf, sceneSpec, stageOf } from '../stage';

/** 画面が変わったら見出しにフォーカスを移す（§9） */
function useFocusHeading(key: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/** 「◀ 戻る」のための履歴（付録B-16）。選択をまたいで戻れるのは1回だけ */
interface HistEntry {
  state: RunState;
  viaChoice: boolean;
  lineIndex: number;
}

export function Play() {
  const { run, content, setRun } = useApp();
  const [showParams, setShowParams] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [hist, setHist] = useState<HistEntry[]>([]);
  const [crossedChoice, setCrossedChoice] = useState(false);
  const [skipped, setSkipped] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const prevLedger = useRef<{ runId: string; n: number } | null>(null);

  // パラメーターが変わったときだけ、小さな通知を出す（付録B-3）
  useEffect(() => {
    if (!run) return;
    const prev = prevLedger.current;
    prevLedger.current = { runId: run.runId, n: run.ledger.length };
    if (!prev || prev.runId !== run.runId || run.ledger.length <= prev.n) return;
    const fresh: LedgerEntry[] = run.ledger.slice(prev.n).filter((e) => !e.skipped);
    if (fresh.length === 0) return;
    const items = fresh.map((e, i) => ({
      id: Date.now() + i,
      text: `${PARAM_LABELS[e.param]} ${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)} ・ ${SOURCE_LABELS[e.source]}`,
    }));
    setToasts((t) => [...t, ...items]);
    const ids = items.map((x) => x.id);
    const timer = setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 2600);
    return () => clearTimeout(timer);
  }, [run?.ledger.length, run?.runId]);

  if (!run) {
    return (
      <>
        <h1>進行中の周回がありません</h1>
        <button type="button" class="btn primary" onClick={() => navigate('select')}>
          主人公を選ぶ
        </button>
      </>
    );
  }

  const step = run.position.step;

  /** 状態を進める。戻るための履歴を積む（章をまたぐと消す） */
  const go = (next: RunState, viaChoice: boolean) => {
    const sameChapter = next.position.age === run.position.age && next.position.step !== 'review' && next.position.step !== 'chapterTop';
    if (sameChapter) {
      setHist((h) => [...h, { state: run, viaChoice, lineIndex }]);
      if (viaChoice) setCrossedChoice(false);
    } else {
      setHist([]);
      setCrossedChoice(false);
    }
    setLineIndex(0);
    setSkipped(null);
    setRun(next);
  };

  const canBackLine = step === 'scene' && lineIndex > 0;
  const top = hist[hist.length - 1];
  const canBackState = Boolean(top && (!top.viaChoice || !crossedChoice));
  const back = () => {
    if (canBackLine) {
      setLineIndex(lineIndex - 1);
      return;
    }
    if (!top || !canBackState) return;
    setHist(hist.slice(0, -1));
    if (top.viaChoice) setCrossedChoice(true);
    setLineIndex(top.lineIndex);
    setRun(top.state);
  };

  const skip = () => {
    const ev = currentEvent(content, run);
    setHist([]);
    setCrossedChoice(false);
    setLineIndex(0);
    setRun(skipEvent(content, run));
    setSkipped(ev?.summary ?? 'この場面をとばしました。');
  };

  return (
    <>
      {showParams && (
        <Modal title="いまのパラメーター" onClose={() => setShowParams(false)}>
          <Hud params={run.params} onOpen={() => undefined} quiet />
          <FactorChart
            data={breakdown(run.ledger, (e) => e.age === run.position.age)}
            title={`${run.position.age}歳の章の要因分解（途中経過）`}
            hasActor={run.chanceLog.some((c) => c.age === run.position.age && c.actorLabel)}
          />
        </Modal>
      )}
      {skipped && step !== 'statCards' && (
        <p class="skipped-note" role="status">
          とばした場面：{skipped}
        </p>
      )}
      {step === 'chapterTop' && <Interlude run={run} onStart={() => go(beginChapter(content, run, false), false)} />}
      {step === 'scene' && (
        <SceneView
          run={run}
          lineIndex={lineIndex}
          setLineIndex={setLineIndex}
          go={go}
          back={back}
          canBack={canBackLine || canBackState}
          skip={skip}
          toasts={toasts}
          openParams={() => setShowParams(true)}
        />
      )}
      {step === 'chance' && <ChanceView run={run} go={go} back={back} canBack={canBackState} />}
      {step === 'statCards' && <SupportCard run={run} skippedSummary={skipped} onNext={() => go(advanceStatCards(content, run), false)} />}
      {step === 'review' && <ChapterReview run={run} onNext={() => go(advanceReview(content, run), false)} />}
      {step === 'finished' && <OverallReview run={run} onRestart={() => setRun(null)} />}
    </>
  );
}

// ── 幕間（付録B-8）：時間が流れる。最初の章では「はじまり」 ──
function Interlude({ run, onStart }: { run: RunState; onStart: () => void }) {
  const { content, animate } = useApp();
  const ch = getChapter(content, run.position.age);
  const chapters = sortedChapters(content);
  const idx = chapters.findIndex((c) => c.age === ch.age);
  const prev = idx > 0 ? chapters[idx - 1] : undefined;
  const firstEvent = ch.events.find((e) => e.characters.includes(run.protagonist) && e.id.includes(run.protagonist.toUpperCase()) && e.stage)
    ?? ch.events.find((e) => e.characters.includes(run.protagonist) && e.stage);
  const stage = firstEvent?.stage;
  const spec = sceneSpec(content, run, stage ? { ...stage, cast: [{ id: run.protagonist }] } : undefined);
  const h = useFocusHeading(`interlude-${ch.age}`);
  return (
    <section class="interlude fade-in">
      <p class="interlude-elapsed num">{prev ? `${ch.age - prev.age}年後` : 'はじまり'}</p>
      <h1 tabIndex={-1} ref={h} class="interlude-title">
        <span class="num">{ch.age}歳</span>　{ch.season}
      </h1>
      <PixelStage spec={spec} label={`${getCharacter(content, run.protagonist).name}、${ch.age}歳`} animate={animate} />
      <p class="interlude-news">
        <RichText text={ch.intro[run.protagonist] ?? ''} />
      </p>
      <button type="button" class="btn primary" onClick={onStart}>
        はじめる
      </button>
    </section>
  );
}

// ── 場面（付録B-2）：吹き出しを1つずつ出し、最後の吹き出しで選択肢を出す ──
function SceneView(props: {
  run: RunState;
  lineIndex: number;
  setLineIndex: (n: number) => void;
  go: (s: RunState, viaChoice: boolean) => void;
  back: () => void;
  canBack: boolean;
  skip: () => void;
  toasts: { id: number; text: string }[];
  openParams: () => void;
}) {
  const { run, lineIndex, setLineIndex, go } = props;
  const { content, animate } = useApp();
  const ev = currentEvent(content, run)!;
  const scene = currentScene(content, run)!;
  const pos = run.position;
  const lines = linesOf(content, run, scene);
  const i = Math.min(lineIndex, lines.length - 1);
  const line = lines[i]!;
  const atLast = i >= lines.length - 1;
  const choices = visibleChoices(content, run, scene);
  const spec = sceneSpec(content, run, stageOf(ev, scene), line);
  const h = useFocusHeading(`${pos.eventId}/${pos.sceneId}/${pos.viewpoint}`);
  const offTrack = !onProtagonistTrack(content, run);
  const me = getCharacter(content, run.protagonist);

  const advance = () => {
    if (!atLast) {
      setLineIndex(i + 1);
      return;
    }
    if (choices.length > 0) return;
    go(advanceScene(content, run), false);
  };

  return (
    <section class="scene" key={`${pos.eventId}/${pos.sceneId}/${pos.viewpoint}`}>
      <h2 class="sr-only" tabIndex={-1} ref={h}>
        場面
      </h2>
      {ev.viewpointSwitch && pos.tracks && (
        <>
          <div class="tabs" role="group" aria-label="視点の切り替え">
            {(Object.keys(pos.tracks) as CharacterId[]).map((id) => {
              const done = Boolean(pos.tracksDone?.[id]);
              const selected = id === pos.viewpoint;
              return (
                <button
                  key={id}
                  type="button"
                  class="tab"
                  aria-pressed={selected}
                  disabled={done && !selected}
                  onClick={() => !selected && go(switchViewpoint(content, run, id), false)}
                >
                  {getCharacter(content, id).name}の視点{done ? '（読んだ）' : ''}
                </button>
              );
            })}
          </div>
          {offTrack && <p class="sub">この視点での選択では、{me.name}のパラメーターは動きません。</p>}
        </>
      )}
      <div class="stage-wrap">
        <PixelStage spec={spec} label={`${me.name}の場面`} animate={animate} />
        <div class="toasts" aria-live="polite">
          {props.toasts.map((t) => (
            <p key={t.id} class="toast num">
              {t.text}
            </p>
          ))}
        </div>
      </div>
      <div class="scene-tools">
        <button type="button" class="tool" onClick={props.back} disabled={!props.canBack} aria-label="ひとつ前に戻る">
          ◀ 戻る
        </button>
        <button type="button" class="tool" onClick={props.openParams}>
          パラメーター
        </button>
        <button type="button" class="tool" onClick={props.skip}>
          この場面をとばす
        </button>
      </div>
      <button type="button" class={`bubble kind-${line.kind}`} onClick={advance} aria-label={`${line.name ? line.name + '：' : ''}${plainText(line.text)}`}>
        {line.name && <span class="bubble-name">{line.name}</span>}
        <span class="bubble-text">
          <RichText text={line.text} />
        </span>
        {!(atLast && choices.length > 0) && <span class="bubble-next">{atLast ? (scene.chance ? 'どうなるかを見る ▼' : '次へ ▼') : '▼'}</span>}
      </button>
      {atLast && choices.length > 0 && (
        <div role="group" aria-label="選択肢" class="choices">
          {choices.map((c) => (
            <button key={c.id} type="button" class="btn choice" onClick={() => go(choose(content, run, c.id), true)}>
              <RichText text={c.label} />
            </button>
          ))}
          {choices.some((c) => c.neutral) && <p class="sub">どれを選んでも、正解・不正解はありません。</p>}
        </div>
      )}
    </section>
  );
}

// ── 確率カード（§7.5） ──
function ChanceView({ run, go, back, canBack }: { run: RunState; go: (s: RunState, v: boolean) => void; back: () => void; canBack: boolean }) {
  const { content, animate } = useApp();
  const entry = run.chanceLog[run.chanceLog.length - 1]!;
  const h = useFocusHeading(`chance-${entry.nodeId}`);
  return (
    <section class="fade-in">
      <h1 class="sr-only" tabIndex={-1} ref={h}>
        確率カード
      </h1>
      <ProbabilityCard entry={entry} content={content} animate={animate} />
      {entry.offTrack && <p class="sub">この結果は、主人公のパラメーターを動かしません。</p>}
      <div class="scene-tools">
        <button type="button" class="tool" onClick={back} disabled={!canBack}>
          ◀ 戻る
        </button>
      </div>
      <button type="button" class="btn primary" onClick={() => go(advanceChance(content, run), false)}>
        次へ
      </button>
    </section>
  );
}

// ── 暴力の場面のあとの支援カード（付録B-20） ──
function SupportCard({ run, skippedSummary, onNext }: { run: RunState; skippedSummary: string | null; onNext: () => void }) {
  const { content } = useApp();
  const ev = currentEvent(content, run)!;
  const h = useFocusHeading(`support-${ev.id}`);
  const picked = ev.support?.length
    ? ev.support.flatMap((id) => content.resources.filter((r) => r.id === id))
    : content.resources.filter((r) => r.tags.some((t) => (ev.resources ?? []).includes(t))).slice(0, 2);
  return (
    <section class="fade-in">
      {skippedSummary && <p class="skipped-note">とばした場面：{skippedSummary}</p>}
      <div class="panel support-card">
        <h1 tabIndex={-1} ref={h} style={{ marginTop: 0, fontSize: 20 }}>
          話せる場所があります
        </h1>
        <p>ひとりで抱えなくて大丈夫です。気になることがあったら、話を聞いてくれる窓口があります。</p>
        <ResourceList items={picked} />
        <p style={{ margin: 0 }}>
          <a href="#/support">ほかの相談先を見る ›</a>
        </p>
      </div>
      <button type="button" class="btn primary" onClick={onNext}>
        物語にもどる
      </button>
    </section>
  );
}

// ── 章のふりかえり（§7.7、付録B-4：統計カードは必ずここで出す） ──
function ParamChanges({ run, age }: { run: RunState; age: number }) {
  const { content } = useApp();
  const initial = getCharacter(content, run.protagonist).initial;
  const before = paramsFrom(initial, run.ledger, (e) => e.age < age);
  const after = paramsFrom(initial, run.ledger, (e) => e.age <= age);
  return (
    <table class="data num">
      <caption class="sr-only">{age}歳の章の前と後のパラメーター</caption>
      <thead>
        <tr>
          <th scope="col">パラメーター</th>
          <th scope="col">章のはじめ</th>
          <th scope="col">いま</th>
          <th scope="col">変化</th>
        </tr>
      </thead>
      <tbody>
        {PARAM_KEYS.map((k) => {
          const a = displayValue(before[k]);
          const b = displayValue(after[k]);
          const d = after[k] - before[k];
          return (
            <tr key={k}>
              <th scope="row">{PARAM_LABELS[k]}</th>
              <td>{a.value}</td>
              <td>
                {b.value}
                {b.clamped && <span class="sub">（{b.clamped === 'upper' ? '上限' : '下限'}に達しています）</span>}
              </td>
              <td>{d > 0 ? `+${d}` : d}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChapterReview({ run, onNext }: { run: RunState; onNext: () => void }) {
  const { content } = useApp();
  const age = run.position.age;
  const h = useFocusHeading(`review-${age}`);
  const chapter = getChapter(content, age);
  const played = chapter.events.filter((e) => run.completedEvents.includes(e.id));
  const skippedHere = played.filter((e) => run.skippedEvents.includes(e.id));
  const statIds = [...new Set(played.flatMap((e) => e.statCard ?? []))];
  const stats = statIds.flatMap((id) => content.stats.filter((s) => s.id === id));
  const entries = run.ledger.filter((e) => e.age === age);
  const isLast = sortedChapters(content).at(-1)?.age === age;
  return (
    <section class="fade-in">
      <h1 tabIndex={-1} ref={h}>
        <span class="num">{age}歳</span>のふりかえり
      </h1>
      {skippedHere.length > 0 && <p class="skipped-note">とばした場面：{skippedHere.map((e) => e.summary ?? e.domains.join('・')).join('／')}</p>}
      <div class="panel">
        <h2 style={{ marginTop: 0 }}>パラメーターの変化</h2>
        <ParamChanges run={run} age={age} />
      </div>
      <div class="panel">
        <h2 style={{ marginTop: 0 }}>変化の理由</h2>
        <p class="sub">変化を、選択・生育条件・社会条件・他者の行為・偶然の5つに分けて示します。中心線より右が増えた分、左が減った分です。</p>
        <FactorChart data={breakdown(run.ledger, (e) => e.age === age)} title={`${age}歳の章の要因分解`} hasActor={run.chanceLog.some((c) => c.age === age && c.actorLabel)} />
        {entries.length > 0 && (
          <details>
            <summary>ひとつずつ見る（{entries.length}件）</summary>
            <ul style={{ paddingLeft: '1.2em', fontSize: 14 }}>
              {entries.map((e, i) => (
                <li key={i} class="num">
                  {PARAM_LABELS[e.param]} {e.delta > 0 ? `+${e.delta}` : e.delta}：{e.note}（{SOURCE_LABELS[e.source]}
                  {e.statRef ? `、${e.statRef}` : ''}）{e.skipped ? '［とばした場面］' : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {stats.length > 0 && (
        <>
          <h2>この章に関係するデータ</h2>
          {stats.map((s) => (
            <StatCard key={s.id} stat={s} />
          ))}
        </>
      )}
      <button type="button" class="btn primary" onClick={onNext}>
        {isLast ? '次へ' : '次の章へ'}
      </button>
    </section>
  );
}
