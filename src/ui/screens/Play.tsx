// プレイ中の画面：7.3 章トップ、7.4 シーン、7.5 確率カード、7.6 統計カード、7.7 章のふりかえり。
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate, useApp } from '../app';
import {
  advanceChance,
  advanceReview,
  advanceScene,
  advanceStatCards,
  beginChapter,
  chapterResourceTags,
  chapterWarnings,
  choose,
  currentEvent,
  currentScene,
  getChapter,
  getCharacter,
  onProtagonistTrack,
  sortedChapters,
  switchViewpoint,
  visibleChoices,
} from '../../engine/progression';
import { breakdown, displayValue, paramsFrom } from '../../engine/effects';
import { PARAM_KEYS } from '../../engine/constants';
import type { CharacterId } from '../../engine/schema';
import { PARAM_LABELS, SOURCE_LABELS, type RunState } from '../../engine/types';
import { Hud } from '../components/Hud';
import { Modal } from '../components/Modal';
import { FactorChart } from '../components/FactorChart';
import { ProbabilityCard, ResourceList, StatCard } from '../components/Cards';
import { RichText } from '../components/RichText';
import { Avatar } from '../components/Avatar';

/** 画面が変わったら見出しにフォーカスを移す（§9） */
function useFocusHeading(key: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [key]);
  return ref;
}

function ReadingTools() {
  const { settings, setSettings } = useApp();
  return (
    <div class="toolbar" role="group" aria-label="表示の切り替え">
      <span>文字</span>
      <button type="button" class="toggle" aria-pressed={settings.fontSize === 'normal'} onClick={() => setSettings({ ...settings, fontSize: 'normal' })}>
        標準
      </button>
      <button type="button" class="toggle" aria-pressed={settings.fontSize === 'large'} onClick={() => setSettings({ ...settings, fontSize: 'large' })}>
        大
      </button>
      <span>ルビ</span>
      <button type="button" class="toggle" aria-pressed={settings.ruby} onClick={() => setSettings({ ...settings, ruby: true })}>
        あり
      </button>
      <button type="button" class="toggle" aria-pressed={!settings.ruby} onClick={() => setSettings({ ...settings, ruby: false })}>
        なし
      </button>
    </div>
  );
}

export function Play() {
  const { run, content, setRun } = useApp();
  const [interim, setInterim] = useState(false);
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
  const ev = currentEvent(content, run);
  const quiet = step === 'scene' && Boolean(ev?.triggerWarning);

  return (
    <>
      {step !== 'finished' && <Hud params={run.params} onOpen={() => setInterim(true)} quiet={quiet} />}
      {interim && (
        <Modal title={`${run.position.age}歳の章の途中経過`} onClose={() => setInterim(false)}>
          <ParamChanges run={run} age={run.position.age} />
          <FactorChart
            data={breakdown(run.ledger, (e) => e.age === run.position.age)}
            title={`${run.position.age}歳の章の要因分解（途中経過）`}
            hasActor={run.chanceLog.some((c) => c.age === run.position.age && c.actorLabel)}
          />
        </Modal>
      )}
      {step === 'chapterTop' && <ChapterTop run={run} />}
      {step === 'scene' && <SceneView run={run} />}
      {step === 'chance' && <ChanceView run={run} />}
      {step === 'statCards' && <StatCardsView run={run} />}
      {step === 'review' && <ChapterReview run={run} />}
      {step === 'finished' && <Finished run={run} onRestart={() => setRun(null)} />}
    </>
  );
}

// ── 7.3 章トップ ──
function ChapterTop({ run }: { run: RunState }) {
  const { content, setRun } = useApp();
  const ch = getChapter(content, run.position.age);
  const me = getCharacter(content, run.protagonist);
  const warnings = chapterWarnings(content, run, run.position.age);
  const h = useFocusHeading(`top-${run.position.age}`);
  return (
    <section class="fade-in">
      <h1 tabIndex={-1} ref={h}>
        <span class="num">{ch.age}歳</span>　{ch.season}
      </h1>
      <div class="panel">
        <p class="sub" style={{ margin: 0 }}>
          {me.name}
        </p>
        <p style={{ margin: 0 }}>
          <RichText text={ch.intro[run.protagonist] ?? ''} />
        </p>
      </div>
      {warnings.length > 0 ? (
        <div class="panel caution" role="region" aria-label="この章についての注意">
          <h2 style={{ marginTop: 0 }}>この章を読む前に</h2>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <p class="sub">読まずに進んだ場合、この章の選択は自動で決まり、ふりかえりに「読まずに進んだ章」と表示されます。</p>
          <button type="button" class="btn primary" onClick={() => setRun(beginChapter(content, run, false))}>
            読む
          </button>
          <button type="button" class="btn" onClick={() => setRun(beginChapter(content, run, true))}>
            この章を読まずに進む
          </button>
          <button type="button" class="btn" onClick={() => navigate('resources')}>
            相談窓口を見る
          </button>
        </div>
      ) : (
        <button type="button" class="btn primary" onClick={() => setRun(beginChapter(content, run, false))}>
          はじめる
        </button>
      )}
    </section>
  );
}

// ── 7.4 シーン ──
function SceneView({ run }: { run: RunState }) {
  const { content, setRun, avatars } = useApp();
  const ev = currentEvent(content, run)!;
  const scene = currentScene(content, run)!;
  const pos = run.position;
  const h = useFocusHeading(`${pos.eventId}/${pos.sceneId}/${pos.viewpoint}`);
  const choices = visibleChoices(content, run, scene);
  const vp = scene.viewpoint ?? run.protagonist;
  const vpChar = getCharacter(content, vp);
  const offTrack = !onProtagonistTrack(content, run);
  const me = getCharacter(content, run.protagonist);
  const neutral = choices.some((c) => c.neutral);

  return (
    <section class={`panel fade-in${ev.triggerWarning ? ' caution' : ''}`} key={`${pos.eventId}/${pos.sceneId}/${pos.viewpoint}`}>
      {ev.viewpointSwitch && pos.tracks && (
        <>
          <div class="tabs" role="tablist" aria-label="視点の切り替え">
            {(Object.keys(pos.tracks) as CharacterId[]).map((id) => {
              const done = Boolean(pos.tracksDone?.[id]);
              const selected = id === pos.viewpoint;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  class="tab"
                  aria-selected={selected}
                  disabled={done && !selected}
                  onClick={() => !selected && setRun(switchViewpoint(content, run, id))}
                >
                  {getCharacter(content, id).name}の視点{done ? '（読んだ）' : ''}
                </button>
              );
            })}
          </div>
          {offTrack && <p class="sub">この視点での選択では、{me.name}のパラメーターは動きません。</p>}
        </>
      )}
      <h2 class="sr-only" tabIndex={-1} ref={h}>
        {scene.speaker ? '会話' : '場面'}（{vpChar.name}）
      </h2>
      <div class="speaker">
        {scene.speaker ? (
          <span>
            <RichText text={scene.speaker} />
          </span>
        ) : (
          <>
            <Avatar spec={avatars[vp]} size={32} />
            <span>{vpChar.name}</span>
          </>
        )}
      </div>
      <p class="scene-text">
        <RichText text={scene.text} />
      </p>
      <div style={{ marginTop: 16 }}>
        {choices.length > 0 ? (
          <>
            {choices.map((c) => (
              <button key={c.id} type="button" class="btn" onClick={() => setRun(choose(content, run, c.id))}>
                <RichText text={c.label} />
              </button>
            ))}
            {neutral && <p class="sub">どれを選んでも、正解・不正解はありません。</p>}
          </>
        ) : (
          <button type="button" class="btn primary" onClick={() => setRun(advanceScene(content, run))}>
            {scene.chance ? 'どうなるかを見る' : '次へ'}
          </button>
        )}
      </div>
      <ReadingTools />
    </section>
  );
}

// ── 7.5 確率カード ──
function ChanceView({ run }: { run: RunState }) {
  const { content, setRun, animate } = useApp();
  const entry = run.chanceLog[run.chanceLog.length - 1]!;
  const h = useFocusHeading(`chance-${entry.nodeId}`);
  return (
    <section class="fade-in">
      <h1 class="sr-only" tabIndex={-1} ref={h}>
        確率カード
      </h1>
      <ProbabilityCard entry={entry} content={content} animate={animate} />
      {entry.offTrack && <p class="sub">この結果は、主人公のパラメーターを動かしません。</p>}
      <button type="button" class="btn primary" onClick={() => setRun(advanceChance(content, run))}>
        次へ
      </button>
    </section>
  );
}

// ── 7.6 統計カード（＋相談窓口） ──
function StatCardsView({ run }: { run: RunState }) {
  const { content, setRun } = useApp();
  const ev = currentEvent(content, run)!;
  const h = useFocusHeading(`stats-${ev.id}`);
  const stats = (ev.statCard ?? []).map((id) => content.stats.find((s) => s.id === id)!).filter(Boolean);
  return (
    <section class="fade-in">
      <h1 tabIndex={-1} ref={h}>
        データで見る
      </h1>
      {stats.map((s) => (
        <StatCard key={s.id} stat={s} />
      ))}
      <SupportResources tags={ev.resources ?? []} />
      <button type="button" class="btn primary" onClick={() => setRun(advanceStatCards(content, run))}>
        次へ
      </button>
    </section>
  );
}

/** 相談窓口への案内（前向きな言葉で。付録A-11） */
function SupportResources({ tags, lead }: { tags: string[]; lead?: string }) {
  const { content } = useApp();
  const items = content.resources.filter((r) => r.tags.some((t) => tags.includes(t)));
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="support-title">
      <h2 id="support-title">話を聞いてくれるところ</h2>
      {lead && <p>{lead}</p>}
      <p>ひとりで抱えなくて大丈夫です。気になることがあったら、話を聞いてくれる窓口があります。</p>
      <p class="sub">{tags.map((t) => content.config.resourceTags[t]).join('、')}</p>
      <ResourceList items={items} />
      <p class="sub">
        ほかの窓口は<a href="#/resources">相談窓口</a>のページにあります。
      </p>
    </section>
  );
}

// ── 7.7 章のふりかえり ──
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

function ChapterReview({ run }: { run: RunState }) {
  const { content, setRun } = useApp();
  const age = run.position.age;
  const h = useFocusHeading(`review-${age}`);
  const skipped = run.skippedChapters.includes(age);
  const entries = run.ledger.filter((e) => e.age === age);
  const isLast = sortedChapters(content).at(-1)?.age === age;
  return (
    <section class="fade-in">
      <h1 tabIndex={-1} ref={h}>
        <span class="num">{age}歳</span>のふりかえり
      </h1>
      {skipped && (
        <p class="panel caution" style={{ margin: '8px 0' }}>
          読まずに進んだ章：この章の選択は自動で決まりました。読むかどうかは、自分で決めてかまいません。
        </p>
      )}
      <div class="panel">
        <h2 style={{ marginTop: 0 }}>パラメーターの変化</h2>
        <ParamChanges run={run} age={age} />
      </div>
      <div class="panel">
        <h2 style={{ marginTop: 0 }}>変化の理由（要因分解）</h2>
        <p class="sub">変化を、選択・生育条件・社会条件・他者の行為・偶然の5つに分けて示します。中心線より右が増えた分、左が減った分です。</p>
        <FactorChart
          data={breakdown(run.ledger, (e) => e.age === age)}
          title={`${age}歳の章の要因分解`}
          hasActor={run.chanceLog.some((c) => c.age === age && c.actorLabel)}
        />
        {entries.length > 0 && (
          <details>
            <summary>ひとつずつ見る（{entries.length}件）</summary>
            <ul style={{ paddingLeft: '1.2em', fontSize: 14 }}>
              {entries.map((e, i) => (
                <li key={i} class="num">
                  {PARAM_LABELS[e.param]} {e.delta > 0 ? `+${e.delta}` : e.delta}：{e.note}（{SOURCE_LABELS[e.source]}
                  {e.statRef ? `、${e.statRef}` : ''}）{e.skipped ? '［自動］' : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
        {entries.length === 0 && <p class="sub">この章では、パラメーターは変化しませんでした。</p>}
      </div>
      {skipped && <SupportResources tags={chapterResourceTags(content, run, age)} />}
      <button type="button" class="btn primary" onClick={() => setRun(advanceReview(content, run))}>
        {isLast ? '次へ' : '次の章へ'}
      </button>
    </section>
  );
}

// ── フェーズ1の範囲の終わり ──
function Finished({ run, onRestart }: { run: RunState; onRestart: () => void }) {
  const { content } = useApp();
  const h = useFocusHeading('finished');
  const last = sortedChapters(content).at(-1)?.age;
  return (
    <section>
      <h1 tabIndex={-1} ref={h}>
        ここまでの章を読み終えました
      </h1>
      <div class="panel">
        <p style={{ margin: 0 }}>
          {getCharacter(content, run.protagonist).name}の{last}歳までの章は、ここまでです。この先の章は準備中です。
        </p>
      </div>
      <button
        type="button"
        class="btn primary"
        onClick={() => {
          onRestart();
          navigate('select');
        }}
      >
        主人公を選びなおす
      </button>
    </section>
  );
}
