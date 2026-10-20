// プレイ画面（付録B）：幕間、会話中心の場面、確率カード、暴力の場面のあとの支援カード、章のふりかえり。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
import { ageOf, linesOf, sceneSpec, stageOf, type ShownLine } from '../stage';
import { FaceIcon } from '../components/Faces';
import { ChangeCard, StatusBar } from '../components/ParamIcons';
import { LifeMap, LifeStrip } from '../components/LifeMap';
import { chapterHighlights, chosenLines, mainStage } from '../review';
import { standardRoutes } from '../../engine/standard';
import { CHARACTER_IDS } from '../../engine/constants';

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
  visited: string[];
}

/** 選んだ直後の変化（付録B-28） */
interface Change {
  entries: LedgerEntry[];
  before: RunState['params'];
}

export function Play() {
  const { run, content, setRun, animate } = useApp();
  const [showParams, setShowParams] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [hist, setHist] = useState<HistEntry[]>([]);
  const [crossedChoice, setCrossedChoice] = useState(false);
  const [skipped, setSkipped] = useState<string | null>(null);
  /** いまのイベントで、すでに読み終えた場面（会話を積み重ねて見せるため。付録B-27） */
  const [visited, setVisited] = useState<string[]>([]);
  const [change, setChange] = useState<Change | null>(null);

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

  /** 状態を進める。戻るための履歴を積み（章をまたぐと消す）、パラメーターが動いたら変化カードを出す */
  const go = (next: RunState, viaChoice: boolean) => {
    const sameChapter = next.position.age === run.position.age && next.position.step !== 'review' && next.position.step !== 'chapterTop';
    if (sameChapter) {
      setHist((h) => [...h, { state: run, viaChoice, lineIndex, visited }]);
      if (viaChoice) setCrossedChoice(false);
    } else {
      setHist([]);
      setCrossedChoice(false);
    }
    const sameEvent = next.position.eventId === run.position.eventId && next.position.viewpoint === run.position.viewpoint;
    setVisited(sameEvent && run.position.step === 'scene' ? [...visited, run.position.sceneId] : []);
    const fresh = next.ledger.slice(run.ledger.length).filter((e) => !e.skipped);
    setChange(fresh.length && next.runId === run.runId ? { entries: fresh, before: run.params } : null);
    setLineIndex(0);
    setSkipped(null);
    setRun(next);
  };

  const canBackLine = step === 'scene' && lineIndex > 0;
  const top = hist[hist.length - 1];
  const canBackState = Boolean(top && (!top.viaChoice || !crossedChoice));
  const back = () => {
    setChange(null);
    if (canBackLine) {
      setLineIndex(lineIndex - 1);
      return;
    }
    if (!top || !canBackState) return;
    setHist(hist.slice(0, -1));
    if (top.viaChoice) setCrossedChoice(true);
    setLineIndex(top.lineIndex);
    setVisited(top.visited);
    setRun(top.state);
  };

  const skip = () => {
    const ev = currentEvent(content, run);
    setHist([]);
    setCrossedChoice(false);
    setLineIndex(0);
    setVisited([]);
    setChange(null);
    setRun(skipEvent(content, run));
    setSkipped(ev?.summary ?? 'この場面をとばしました。');
  };

  return (
    <>
      {showParams && (
        <Modal title="これまでの記録" onClose={() => setShowParams(false)}>
          <h3>いまのパラメーター</h3>
          <Hud params={run.params} onOpen={() => undefined} quiet />
          <h3>人生の地図</h3>
          <LifeMap run={run} />
          <h3>この章の変化の理由</h3>
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
          setLineIndex={(n) => {
            setChange(null);
            setLineIndex(n);
          }}
          visited={visited}
          go={go}
          back={back}
          canBack={canBackLine || canBackState}
          skip={skip}
          change={change}
          closeChange={() => setChange(null)}
          animate={animate}
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
  const spec = sceneSpec(content, run, stage);
  const h = useFocusHeading(`interlude-${ch.age}`);
  return (
    <section class="interlude fade-in">
      <LifeStrip run={run} />
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

// ── 場面（付録B-2・B-27）：会話を積み重ねて見せ、最新の行は文字が流れるように出す ──
function ChatLine({ run, line, typing, typed }: { run: RunState; line: ShownLine; typing: boolean; typed: number }) {
  const { content } = useApp();
  const text = typing ? Array.from(plainText(line.text)).slice(0, typed).join('') : null;
  const body = text !== null ? text : <RichText text={line.text} />;
  if (line.kind === 'narration') return <p class="chat narration">{body}</p>;
  const mine = line.who === run.protagonist;
  const member = content.cast.find((c) => c.id === line.who);
  const age = member ? ageOf(content, run, member.id) : run.position.age;
  return (
    <div class={`chat ${mine ? 'mine' : 'theirs'} kind-${line.kind}`}>
      {member && <FaceIcon look={member.look} age={age} face={line.face} />}
      <div class="chat-body">
        <span class="chat-name">{line.name}</span>
        <span class="chat-text">{body}</span>
      </div>
    </div>
  );
}

function SceneView(props: {
  run: RunState;
  lineIndex: number;
  setLineIndex: (n: number) => void;
  visited: string[];
  go: (s: RunState, viaChoice: boolean) => void;
  back: () => void;
  canBack: boolean;
  skip: () => void;
  change: Change | null;
  closeChange: () => void;
  animate: boolean;
  openParams: () => void;
}) {
  const { run, lineIndex, setLineIndex, go, animate } = props;
  const { content } = useApp();
  const ev = currentEvent(content, run)!;
  const scene = currentScene(content, run)!;
  const pos = run.position;
  const lines = linesOf(content, run, scene);
  const i = Math.min(lineIndex, lines.length - 1);
  const line = lines[i]!;
  const atLast = i >= lines.length - 1;
  const choices = visibleChoices(content, run, scene);
  const spec = sceneSpec(content, run, stageOf(ev, scene), line);
  const h = useFocusHeading(`${pos.eventId}/${pos.viewpoint}`);
  const offTrack = !onProtagonistTrack(content, run);
  const me = getCharacter(content, run.protagonist);
  // これまでに読んだ場面の会話（同じイベントの中だけ）
  const earlier = props.visited.flatMap((id) => {
    const sc = ev.scenes.find((x) => x.id === id);
    return sc ? linesOf(content, run, sc) : [];
  });
  // 最新の行は、文字が流れるように出す（演出を減らす設定では一度に出す）
  const full = Array.from(plainText(line.text)).length;
  const [typed, setTyped] = useState(animate ? 0 : full);
  const lineKey = `${pos.eventId}/${pos.sceneId}/${i}`;
  useEffect(() => {
    if (!animate) {
      setTyped(full);
      return;
    }
    setTyped(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= full) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [lineKey, animate]);
  const typing = typed < full;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: animate ? 'smooth' : 'auto' });
  }, [lineKey, typing]);

  const advance = () => {
    if (typing) {
      setTyped(full);
      return;
    }
    if (!atLast) {
      setLineIndex(i + 1);
      return;
    }
    if (choices.length > 0) return;
    go(advanceScene(content, run), false);
  };
  const changedParams = props.change ? [...new Set(props.change.entries.map((e) => e.param))] : [];

  return (
    <section class="scene" key={`${pos.eventId}/${pos.viewpoint}`}>
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
      <div class="stage-sticky">
        <div class="stage-wrap">
          <PixelStage spec={spec} label={`${me.name}の場面`} animate={animate} />
          {props.change && <ChangeCard entries={props.change.entries} before={props.change.before} animate={animate} onClose={props.closeChange} />}
        </div>
        <StatusBar params={run.params} changed={changedParams} onOpen={props.openParams} />
      </div>
      <div class="chat-log" aria-live="polite">
        {earlier.map((l, k) => (
          <ChatLine key={`e${k}`} run={run} line={l} typing={false} typed={0} />
        ))}
        {lines.slice(0, i + 1).map((l, k) => (
          <ChatLine key={`c${k}`} run={run} line={l} typing={k === i && typing} typed={typed} />
        ))}
        <div ref={endRef} />
      </div>
      {atLast && !typing && choices.length > 0 ? (
        <div role="group" aria-label="選択肢" class="choices">
          {choices.map((c) => (
            <button key={c.id} type="button" class="btn choice" onClick={() => go(choose(content, run, c.id), true)}>
              <RichText text={c.label} />
            </button>
          ))}
          {choices.some((c) => c.neutral) && <p class="sub">どれを選んでも、正解・不正解はありません。</p>}
        </div>
      ) : (
        <button type="button" class="next-tap" onClick={advance}>
          {typing ? '▼' : atLast ? (scene.chance ? 'どうなるかを見る ▼' : '次へ ▼') : '▼ 次へ'}
        </button>
      )}
      <div class="scene-tools">
        <button type="button" class="tool" onClick={props.back} disabled={!props.canBack} aria-label="ひとつ前に戻る">
          ◀ 戻る
        </button>
        <button type="button" class="tool" onClick={props.openParams}>
          記録
        </button>
        <button type="button" class="tool" onClick={props.skip}>
          この場面をとばす
        </button>
      </div>
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
  const { content, animate } = useApp();
  const age = run.position.age;
  const h = useFocusHeading(`review-${age}`);
  const chapter = getChapter(content, age);
  const me = getCharacter(content, run.protagonist);
  const played = chapter.events.filter((e) => run.completedEvents.includes(e.id));
  const skippedHere = played.filter((e) => run.skippedEvents.includes(e.id));
  const statIds = [...new Set(played.flatMap((e) => e.statCard ?? []))];
  const stats = statIds.flatMap((id) => content.stats.filter((s) => s.id === id));
  const isLast = sortedChapters(content).at(-1)?.age === age;
  const said = chosenLines(content, run, age);
  const highlights = chapterHighlights(run, age);
  const psych = run.ledger.filter((e) => e.age === age && e.param === 'psychSafety').reduce((a, e) => a + e.delta, 0);
  const face = psych < 0 ? ('sad' as const) : psych > 0 ? ('relieved' as const) : ('normal' as const);
  const stage = mainStage(content, run.protagonist, age);
  const spec = sceneSpec(content, run, stage ? { ...stage, cast: stage.cast.map((c) => (c.id === run.protagonist || c.id === 'self' ? { ...c, face } : c)) } : undefined);
  // そのころ、ほかの3人は（標準ルート。付録A-19）
  const routes = useMemo(() => standardRoutes(content, run), [run.runId, age]);
  return (
    <section class="fade-in review">
      <LifeStrip run={run} />
      <h1 tabIndex={-1} ref={h}>
        <span class="num">{age}歳</span>のふりかえり
      </h1>
      <PixelStage spec={spec} label={`${me.name}、${age}歳`} animate={animate} />
      <p class="sub" style={{ textAlign: 'center' }}>
        {chapter.season}
      </p>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>あなたが選んだこと</h2>
        {said.length === 0 && <p class="sub">この章では、選ぶ場面はありませんでした。</p>}
        {said.map((t, i) => (
          <p key={i} class="review-said">
            <RichText text={t} />
          </p>
        ))}
        {skippedHere.length > 0 && <p class="skipped-note">とばした場面：{skippedHere.map((e) => e.summary ?? e.domains.join('・')).join('／')}</p>}
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>変わったこと</h2>
        {highlights.length === 0 && <p class="sub">この章では、パラメーターは変わりませんでした。</p>}
        <ul class="plain">
          {highlights.map(([param, v]) => (
            <li key={param} class="review-change">
              <p class="review-change-head num">
                {PARAM_LABELS[param as keyof typeof PARAM_LABELS]} <strong>{v.delta > 0 ? `+${v.delta}` : v.delta === 0 ? '±0' : v.delta}</strong>
              </p>
              <p class="review-reasons">
                {v.reasons.map((r, i) => (
                  <span key={i} class={`reason f-${r.source}`}>
                    {r.note}（{SOURCE_LABELS[r.source as keyof typeof SOURCE_LABELS]} {r.delta > 0 ? `+${r.delta}` : r.delta}）
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <details>
          <summary>グラフと表で見る</summary>
          <ParamChanges run={run} age={age} />
          <FactorChart data={breakdown(run.ledger, (e) => e.age === age)} title={`${age}歳の章の要因分解`} hasActor={run.chanceLog.some((c) => c.age === age && c.actorLabel)} />
        </details>
      </div>

      <div class="panel">
        <h2 style={{ marginTop: 0 }}>そのころ、ほかの3人は</h2>
        <ul class="plain">
          {CHARACTER_IDS.filter((id) => id !== run.protagonist).map((id) => {
            const r = routes[id];
            const quote = r ? chosenLines(content, r, age)[0] : undefined;
            return (
              <li key={id} class="review-other">
                <p class="review-other-name">{getCharacter(content, id).name}</p>
                <p style={{ margin: 0 }}>
                  <RichText text={chapter.intro[id] ?? ''} />
                </p>
                {quote && (
                  <p class="review-said small">
                    <RichText text={quote} />
                  </p>
                )}
              </li>
            );
          })}
        </ul>
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
        {isLast ? '20年をふりかえる' : '次の章へ'}
      </button>
    </section>
  );
}
