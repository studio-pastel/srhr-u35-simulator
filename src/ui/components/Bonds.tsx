// 人との距離（付録B-9）。主人公から見た、近しい人との近さ（0〜3）を、顔と点で見せる。
// 6つのパラメーターとは別のもの。数字は出さず、点の数だけで見せる。関係が終わった人は、点を消して「別れた」などと書く。
import { useApp } from '../app';
import { check } from '../../engine/flags';
import { contextOf, getCharacter } from '../../engine/progression';
import type { BondEntry, RunState } from '../../engine/types';
import { ageOf, lookOf } from '../stage';
import { FaceIcon } from './Faces';

export interface BondView {
  id: string;
  name: string;
  level: number;
  ended: boolean;
  /** その年齢の章で関係が終わった */
  endedHere: boolean;
  note?: string;
}

/** ある年齢の章の終わりの、近しい人との距離 */
export function bondsAt(content: ReturnType<typeof useApp>['content'], run: RunState, age: number): BondView[] {
  const me = getCharacter(content, 'me');
  const ctx = contextOf(content, run);
  const out: BondView[] = [];
  for (const b of me.bonds) {
    if (b.from > age || !check(b.when, ctx)) continue;
    let level = b.initial;
    let ended = false;
    let endedHere = false;
    let note: string | undefined;
    for (const e of run.bondLog) {
      if (e.who !== b.id || e.age > age) continue;
      level = e.to;
      if (e.ended) {
        ended = true;
        endedHere = e.age === age;
        note = e.note;
      }
    }
    const name = content.cast.find((c) => c.id === b.id)?.name ?? b.id;
    out.push({ id: b.id, name, level, ended, endedHere, note });
  }
  return out;
}

export function BondDots({ level }: { level: number }) {
  return (
    <span class="bond-dots" aria-label={`近さ ${level}（4段階）`}>
      {[0, 1, 2].map((i) => (
        <span key={i} class={i < level ? 'on' : ''} />
      ))}
    </span>
  );
}

function Face({ run, id, small }: { run: RunState; id: string; small?: boolean }) {
  const { content } = useApp();
  const look = lookOf(content, run, id);
  if (!look) return null;
  return (
    <span class={small ? 'bond-face small' : 'bond-face'}>
      <FaceIcon look={look} age={ageOf(content, run, id)} />
    </span>
  );
}

const changeWord = (e: BondEntry) => (e.ended ? e.note : e.to > e.from ? '近くなった' : '遠くなった');

/** 選んだ直後の、距離の変化（変化カードの下に出す） */
export function BondNotes({ run, entries }: { run: RunState; entries: BondEntry[] }) {
  const { content } = useApp();
  if (entries.length === 0) return null;
  return (
    <ul class="bond-notes" role="status" aria-live="polite">
      {entries.map((e, i) => {
        const name = content.cast.find((c) => c.id === e.who)?.name ?? e.who;
        return (
          <li key={i}>
            <Face run={run} id={e.who} small />
            <span class="bond-name">{name}との距離</span>
            {!e.ended && <BondDots level={e.to} />}
            <span class="bond-word">{changeWord(e)}</span>
            {!e.ended && <span class="bond-why">（{e.note}）</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** 人生の地図の各章に出す、顔と点の列 */
export function BondRow({ run, age }: { run: RunState; age: number }) {
  const { content } = useApp();
  const list = bondsAt(content, run, age).filter((b) => !b.ended || b.endedHere);
  if (list.length === 0) return null;
  return (
    <ul class="bond-row" aria-label="人との距離">
      {list.map((b) => (
        <li key={b.id}>
          <Face run={run} id={b.id} small />
          <span class="bond-name">{b.name}</span>
          {b.ended ? <span class="bond-word">{b.note}</span> : <BondDots level={b.level} />}
        </li>
      ))}
    </ul>
  );
}

/** 章のふりかえりの「人との距離」：その章で変わった人と理由 */
export function ChapterBondChanges({ run, age }: { run: RunState; age: number }) {
  const { content } = useApp();
  const entries = run.bondLog.filter((e) => e.age === age);
  if (entries.length === 0) return null;
  return (
    <div class="panel">
      <h2 style={{ marginTop: 0 }}>人との距離</h2>
      <ul class="plain bond-changes">
        {entries.map((e, i) => (
          <li key={i}>
            <Face run={run} id={e.who} small />
            <span class="bond-name">{content.cast.find((c) => c.id === e.who)?.name ?? e.who}</span>
            {!e.ended && <BondDots level={e.to} />}
            <span class="bond-word">{changeWord(e)}</span>
            {!e.ended && <span class="bond-why">{e.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 全体のふりかえり：自分を中心にした同心円。内側ほど近い */
export function BondRings({ run }: { run: RunState }) {
  const { content } = useApp();
  const me = { name: run.profile.name };
  const all = bondsAt(content, run, run.position.age);
  const active = all.filter((b) => !b.ended);
  const ended = all.filter((b) => b.ended);
  const radius = (level: number) => [46, 46, 32, 18][level]!; // 近さ 0・1 は外側の円、2 は中、3 は内側（％）
  // 同じ円の人は、角度をずらして並べる
  const byLevel = new Map<number, BondView[]>();
  for (const b of active) byLevel.set(b.level, [...(byLevel.get(b.level) ?? []), b]);
  return (
    <div>
      <div class="bond-rings" role="img" aria-label={`${me.name}のまわりの人。${active.map((b) => `${b.name}：近さ${b.level}`).join('、')}`}>
        <span class="ring r3" />
        <span class="ring r2" />
        <span class="ring r1" />
        <span class="bond-center">
          <Face run={run} id="me" />
        </span>
        {[...byLevel.entries()].flatMap(([level, list]) =>
          list.map((b, i) => {
            const a = -Math.PI / 2 + (2 * Math.PI * (i + level * 0.37)) / Math.max(list.length, 1);
            const r = radius(level);
            return (
              <span key={b.id} class="bond-pin" style={{ left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` }}>
                <Face run={run} id={b.id} small />
                <span class="bond-pin-name">{b.name}</span>
              </span>
            );
          }),
        )}
      </div>
      <p class="sub" style={{ marginBottom: 0 }}>内側の円ほど、近い人です。</p>
      {ended.length > 0 && (
        <p class="sub" style={{ margin: '4px 0 0' }}>
          関係が終わった人：{ended.map((b) => `${b.name}（${b.note}）`).join('、')}
        </p>
      )}
    </div>
  );
}
