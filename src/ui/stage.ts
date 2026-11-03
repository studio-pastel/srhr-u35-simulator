// 場面の舞台と吹き出しを、コンテンツから組み立てる（付録B-1・B-2）。
import type { Content, GameEvent, Scene, Stage } from '../engine/schema';
import type { RunState } from '../engine/types';
import { applicableEvents, contextOf, visibleLines } from '../engine/progression';
import { check } from '../engine/flags';
import type { Actor, Face, Look, Place, SceneSpec } from './pixel/render';

export interface ShownLine {
  relation?: string;
  who: string;
  /** 画面に出す名前（地の文では空） */
  name: string;
  text: string;
  /** action は、選んだ行動（「」も（）もない選択肢）。会話の記録に残す（付録B-54） */
  kind: 'say' | 'inner' | 'message' | 'narration' | 'fade' | 'action';
  face?: Face;
}

/** 舞台がない旧形式の場面は、年齢から場所を決める */
function fallbackPlace(age: number): Place {
  if (age <= 17) return 'classroom';
  if (age <= 21) return 'campus';
  if (age <= 30) return 'office';
  return 'living';
}

export function stageOf(ev: GameEvent | undefined, scene: Scene | undefined): Stage | undefined {
  return scene?.stage ?? ev?.stage;
}

/** 立ち位置が書かれていなければ、人数に合わせて左右に並べる */
function positions(n: number): number[] {
  if (n <= 1) return [34];
  if (n === 2) return [24, 62];
  if (n === 3) return [18, 44, 72];
  return Array.from({ length: n }, (_, i) => 12 + i * Math.floor(76 / (n - 1)));
}

/** self は主人公、partner はこの周回のパートナーを指す（付録B-43） */
export function resolveWho(run: RunState, id: string): string {
  if (id === 'self') return 'me';
  if (id === 'partner') return typeof run.flags.partnerId === 'string' ? run.flags.partnerId : '';
  return id;
}

/** 本文の %partner% を、この周回のパートナーの名前に置きかえる */
export function fillText(content: Content, run: RunState, text: string): string {
  return text.replaceAll('%partner%', nameOf(content, run, resolveWho(run, 'partner')));
}

/** 主人公から見た関係（付録B-48）。付き合い始めたら、パートナーの関係も変わる */
export function relationOf(content: Content, run: RunState, id: string): string | undefined {
  if (id === run.flags.partnerId && run.flags.dating === true && !startedDatingHere(content, run)) return '付き合っている人';
  return content.cast.find((c) => c.id === id)?.relation;
}

/** いまのイベントの中で付き合い始めた（告白の場面）。その場面の吹き出しは、付き合う前の関係のまま出す */
function startedDatingHere(content: Content, run: RunState): boolean {
  const ev = content.chapters.flatMap((c) => c.events).find((e) => e.id === run.position.eventId);
  return !!ev?.scenes.some((sc) => sc.choices?.some((c) => c.setFlags?.dating === true && run.choices[`${ev.id}/${sc.id}`] === c.id));
}

/** 人物の見た目。主人公はプレイヤーが選んだ見た目を使う */
export function lookOf(content: Content, run: RunState, id: string): Look | undefined {
  if (id === 'me') return run.profile.look as Look;
  return content.cast.find((c) => c.id === id)?.look as Look | undefined;
}

export function nameOf(content: Content, run: RunState, id: string): string {
  if (id === 'me') return run.profile.name;
  return content.cast.find((c) => c.id === id)?.name ?? id;
}

export function sceneSpec(content: Content, run: RunState, stage: Stage | undefined, line?: ShownLine): SceneSpec {
  const age = run.position.age;
  if (!stage) {
    return { place: fallbackPlace(age), time: 'day', actors: [{ look: run.profile.look as Look, age, x: 34, face: line?.who === 'me' ? line.face : undefined }] };
  }
  const ctx = contextOf(content, run);
  const cast = stage.cast.filter((c) => check(c.when, ctx));
  const xs = positions(cast.length);
  const actors: Actor[] = cast.flatMap((c, i) => {
    const id = resolveWho(run, c.id);
    const look = lookOf(content, run, id);
    if (!look) return [];
    const isMe = id === 'me';
    const a = isMe ? age : ageOf(content, run, id);
    if (!isMe && a < 0) return [];
    const face = line && line.who === id && line.face ? line.face : c.face;
    return [{ look, age: isMe ? age : Math.max(1, a), x: c.x ?? xs[i]!, face, pose: c.pose }];
  });
  return { place: stage.place, time: stage.time, actors };
}

/** 人物の年齢：主人公は周回の年齢、パートナーは一緒に年をとり、子どもは生まれた年から数える */
export function ageOf(content: Content, run: RunState, id: string): number {
  const age = run.position.age;
  if (id === 'me') return age;
  const m = content.cast.find((c) => c.id === id);
  if (!m) return age;
  if (m.peerOffset !== undefined) return age + m.peerOffset;
  if (m.bornAt !== undefined) return Math.max(1, age - m.bornAt);
  return m.age ?? 30;
}

/** 属性や状況に合う吹き出しを、名前を付けて返す */
export function linesOf(content: Content, run: RunState, scene: Scene): ShownLine[] {
  return visibleLines(content, run, scene).map((l) => {
    const who = resolveWho(run, l.who);
    const kind = l.kind ?? (l.who === 'narration' ? 'narration' : 'say');
    const base = l.who === 'narration' ? '' : nameOf(content, run, who);
    const name = kind === 'inner' ? `${base}（心の声）` : kind === 'message' ? `${base}（メッセージ）` : base;
    return { who, name, relation: relationOf(content, run, who), text: fillText(content, run, l.text), kind, face: l.face };
  });
}

/**
 * 人物の一覧（付録B-52）に出す、その年の章に出てくる人（舞台にいる人、話す人、本文で名前が出る人）。about がある人だけ。
 * 選択肢の名前は見ない（前の選択でしか出ない選択肢があり、出ない人まで紹介してしまうため）
 */
export function chapterPeople(content: Content, run: RunState, age: number): string[] {
  const ctx = contextOf(content, run);
  const listed = content.cast.filter((c) => c.about);
  const found = new Set<string>();
  const add = (who: string) => found.add(resolveWho(run, who));
  const mention = (text: string) => {
    if (text.includes('%partner%')) add('partner');
    for (const c of listed) if (text.includes(c.name)) found.add(c.id);
  };
  for (const ev of applicableEvents(content, run, age)) {
    ev.stage?.cast.forEach((c) => add(c.id));
    for (const sc of ev.scenes) {
      sc.stage?.cast.forEach((c) => add(c.id));
      for (const l of sc.lines ?? []) {
        if (!check(l.when, ctx)) continue;
        add(l.who);
        mention(l.text);
      }
    }
  }
  return listed.filter((c) => found.has(c.id)).map((c) => c.id);
}

/** 常に出す小さな関係図（付録B-53）での関係。付き合うと恋人、別れると元恋人 */
export function tieOf(content: Content, run: RunState, id: string): string | undefined {
  if (id === run.flags.partnerId) {
    if (run.bonds[id]?.ended) return '元恋人';
    if (run.flags.dating === true) return '恋人';
  }
  return content.cast.find((c) => c.id === id)?.tie;
}

/** これまでの章と、いまの章で出てくる人。付き合っている人は、必ず入れる */
export function knownPeople(content: Content, run: RunState): string[] {
  const ids = new Set<string>();
  for (const ch of content.chapters) if (ch.age <= run.position.age) chapterPeople(content, run, ch.age).forEach((id) => ids.add(id));
  const partner = run.flags.dating === true && typeof run.flags.partnerId === 'string' ? run.flags.partnerId : undefined;
  if (partner) ids.add(partner);
  // 付き合っている人を先頭に置く
  return content.cast.filter((c) => ids.has(c.id)).map((c) => c.id).sort((a, b) => Number(b === partner) - Number(a === partner));
}

/** その年の章の、選べない出来事（付録B-53）。いま起きているもの、終わったもの、これからのもの */
export function chanceDeck(content: Content, run: RunState): { id: string; state: 'done' | 'active' | 'pending' }[] {
  return applicableEvents(content, run, run.position.age)
    .filter((e) => e.kind === 'chance')
    .map((e) => ({
      id: e.id,
      state: run.completedEvents.includes(e.id) ? 'done' : run.position.eventId === e.id && run.position.step !== 'chapterTop' ? 'active' : 'pending',
    }));
}

/**
 * その場面で選んだ選択肢を、会話の1行として返す（付録B-54）。選んだせりふが記録に残らないと、
 * 何も言っていないのに相手が反応したように見えるため。「」は口に出した言葉、（）は心の声、記号なしは行動。
 * 直前の行がメッセージなら、口に出した言葉もメッセージとして出す。
 */
export function chosenLine(content: Content, run: RunState, ev: GameEvent, scene: Scene): ShownLine | undefined {
  const id = run.choices[`${ev.id}/${scene.id}`];
  const choice = scene.choices?.find((c) => c.id === id);
  if (!choice) return undefined;
  const label = fillText(content, run, choice.label);
  const name = nameOf(content, run, 'me');
  const spoken = label.match(/^「(.*)」$/s);
  if (spoken) {
    const message = linesOf(content, run, scene).at(-1)?.kind === 'message';
    return { who: 'me', name: message ? `${name}（メッセージ）` : name, text: spoken[1]!, kind: message ? 'message' : 'say' };
  }
  if (label.startsWith('（')) return { who: 'me', name: `${name}（心の声）`, text: label, kind: 'inner' };
  return { who: 'me', name, text: label, kind: 'action' };
}
