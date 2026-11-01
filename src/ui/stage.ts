// 場面の舞台と吹き出しを、コンテンツから組み立てる（付録B-1・B-2）。
import type { Content, GameEvent, Scene, Stage } from '../engine/schema';
import type { RunState } from '../engine/types';
import { contextOf, visibleLines } from '../engine/progression';
import { check } from '../engine/flags';
import type { Actor, Face, Look, Place, SceneSpec } from './pixel/render';

export interface ShownLine {
  relation?: string;
  who: string;
  /** 画面に出す名前（地の文では空） */
  name: string;
  text: string;
  kind: 'say' | 'inner' | 'message' | 'narration' | 'fade';
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
  if (id === run.flags.partnerId && run.flags.dating === true) return '付き合っている人';
  return content.cast.find((c) => c.id === id)?.relation;
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
