// プレイ画面（付録B）：幕間、会話中心の場面、確率カード、暴力の場面のあとの支援カード、章のふりかえり。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import {
  advanceChance,
  advancePeek,
  advanceReview,
  advanceScene,
  beginChapter,
  choose,
  currentEvent,
  currentScene,
  getChapter,
  getCharacter,
  skipEvent,
  sortedChapters,
  visibleChoices,
} from '../../engine/progression';
import { breakdown, displayValue, paramsFrom } from '../../engine/effects';
import { PARAM_KEYS } from '../../engine/constants';
import { PARAM_LABELS, SOURCE_LABELS, type BondEntry, type LedgerEntry, type RunState } from '../../engine/types';
import { BondNotes, ChapterBondChanges } from '../components/Bonds';
import { Hud } from '../components/Hud';
import { Modal } from '../components/Modal';
import { FactorChart } from '../components/FactorChart';
import { ProbabilityCard, StatCard } from '../components/Cards';
import { RichText, plainText } from '../components/RichText';
import { PixelStage } from '../components/PixelStage';
import { OverallReview } from './OverallReview';
import { ageOf, linesOf, sceneSpec, stageOf, type ShownLine } from '../stage';
import { FaceIcon } from '../components/Faces';
import { ChangeNotes, StatusBar } from '../components/ParamIcons';
import { LifeMap, LifeStrip } from '../components/LifeMap';
import { chapterHighlights, chosenLines, mainStage } from '../review';

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
  /** 人との距離の変化（付録B-9） */
  bonds: BondEntry[];
  /** 同じ増減が続いても、アニメーションを出し直すための番号 */
  stamp: number;
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
    const freshBonds = next.bondLog.slice(run.bondLog.length).filter((e) => !e.skipped);
    setChange((fresh.length || freshBonds.length) && next.runId === run.runId ? { entries: fresh, before: run.params, bonds: freshBonds, stamp: next.ledger.length + next.bondLog.length } : null);
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
      {skipped && (
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
      {step === 'peek' && <PeekView run={run} onNext={() => go(advancePeek(content, run), false)} />}
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
function ChatLine({ run, line, typing, typed, self }: { run: RunState; line: ShownLine; typing: boolean; typed: number; self?: string }) {
  const { content } = useApp();
  const text = typing ? Array.from(plainText(line.text)).slice(0, typed).join('') : null;
  const body = text !== null ? text : <RichText text={line.text} />;
  if (line.kind === 'narration') return <p class="chat narration">{body}</p>;
  // 暗転（付録B-30）：行為は描かず、時間が過ぎたことだけを伝える
  if (line.kind === 'fade') return <p class="chat fade-line">{body}</p>;
  const mine = line.who === (self ?? run.protagonist);
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
  // パラメーターが動いた瞬間に、絵にも反応を出す（下がると揺れ、上がると光る）
  const net = props.change ? props.change.entries.reduce((a, e) => a + e.delta, 0) : 0;
  const impact = net < 0 ? 'down' : net > 0 ? 'up' : null;

  return (
    <section class="scene" key={`${pos.eventId}/${pos.viewpoint}`}>
      <h2 class="sr-only" tabIndex={-1} ref={h}>
        場面
      </h2>
      <div class="stage-sticky">
        <div class={`stage-wrap${line.kind === 'fade' ? ' faded' : ''}${impact ? ` hit-${impact}` : ''}`} key={impact ? props.change!.stamp : 'still'}>
          <PixelStage spec={spec} label={`${me.name}の場面`} animate={animate} />
        </div>
        <StatusBar params={run.params} change={props.change} animate={animate} onOpen={props.openParams} />
        {props.change && <ChangeNotes entries={props.change.entries} />}
        {props.change && <BondNotes run={run} entries={props.change.bonds} />}
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

// ── 「そのころ、〇〇は……」（付録B-11）：主人公の場面のあと、のぞいたときだけ相手の視点を読む。選択肢はない ──
function PeekView({ run, onNext }: { run: RunState; onNext: () => void }) {
  const { content, animate } = useApp();
  const ev = currentEvent(content, run)!;
  const tracks = (run.position.peek ?? []).filter((t) => t.scenes.length > 0);
  const [open, setOpen] = useState<string | null>(null);
  const h = useFocusHeading(`peek-${ev.id}-${open ?? ''}`);
  const track = tracks.find((t) => t.viewpoint === open);
  const names = tracks.map((t) => getCharacter(content, t.viewpoint).name);
  if (!track) {
    return (
      <section class="peek fade-in">
        <h1 tabIndex={-1} ref={h} class="peek-title">
          そのころ、{names.join('と')}は……
        </h1>
        <p class="sub">相手の側で起きていたことを、のぞいてみることができます。読まずに先へ進んでもかまいません。</p>
        {tracks.map((t) => (
          <button key={t.viewpoint} type="button" class="btn primary" onClick={() => setOpen(t.viewpoint)}>
            {getCharacter(content, t.viewpoint).name}の側を、のぞいてみる
          </button>
        ))}
        <button type="button" class="btn" onClick={onNext}>
          先へ進む
        </button>
      </section>
    );
  }
  const who = track.viewpoint;
  const name = getCharacter(content, who).name;
  // 相手の視点の会話。選ばれた選択肢は、その人のセリフや行動として並べる
  const lines: ShownLine[] = track.scenes.flatMap(({ sceneId, choiceId }) => {
    const sc = ev.scenes.find((x) => x.id === sceneId);
    if (!sc) return [];
    const out = linesOf(content, run, sc);
    const c = choiceId ? sc.choices?.find((x) => x.id === choiceId) : undefined;
    if (c) out.push({ who, name: `${name}が選んだこと`, text: c.label, kind: 'say' });
    return out;
  });
  const firstScene = ev.scenes.find((x) => x.id === track.scenes[0]?.sceneId);
  const spec = sceneSpec(content, run, stageOf(ev, firstScene));
  return (
    <section class="peek fade-in">
      <h1 tabIndex={-1} ref={h} class="peek-title">
        そのころ、{name}は……
      </h1>
      <div class="stage-wrap">
        <PixelStage spec={spec} label={`${name}の側の場面`} animate={animate} />
      </div>
      <p class="sub">{name}の選択は、{name}で遊ぶときに選べます。ここでは、パラメーターは動きません。</p>
      <div class="chat-log">
        {lines.map((l, k) => (
          <ChatLine key={k} run={run} line={l} typing={false} typed={0} self={who} />
        ))}
      </div>
      {tracks.length > 1 && (
        <button type="button" class="btn" onClick={() => setOpen(null)}>
          ほかの人の側も見る
        </button>
      )}
      <button type="button" class="btn primary" onClick={onNext}>
        先へ進む
      </button>
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

      <div class="review-grid">
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

      <ChapterBondChanges run={run} age={age} />
      </div>

      {stats.length > 0 && (
        <>
          <h2>この章に関係するデータ</h2>
          <div class="review-grid">
            {stats.map((s) => (
              <StatCard key={s.id} stat={s} />
            ))}
          </div>
        </>
      )}
      <button type="button" class="btn primary" onClick={onNext}>
        {isLast ? '20年をふりかえる' : '次の章へ'}
      </button>
    </section>
  );
}
