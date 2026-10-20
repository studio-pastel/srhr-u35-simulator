// 場面の舞台と吹き出しを、コンテンツから組み立てる（付録B-1・B-2）。
import type { Content, GameEvent, Scene, Stage } from '../engine/schema';
import type { RunState } from '../engine/types';
import { getCharacter } from '../engine/progression';
import type { Actor, Face, Place, SceneSpec } from './pixel/render';

export interface ShownLine {
  who: string;
  /** 画面に出す名前（地の文では空） */
  name: string;
  text: string;
  kind: 'say' | 'inner' | 'message' | 'narration';
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

export function sceneSpec(content: Content, run: RunState, stage: Stage | undefined, line?: ShownLine): SceneSpec {
  const age = run.position.age;
  if (!stage) {
    const look = content.cast.find((c) => c.id === run.protagonist)!.look;
    return { place: fallbackPlace(age), time: 'day', actors: [{ look, age, x: 34, face: line?.who === run.protagonist ? line.face : undefined }] };
  }
  const xs = positions(stage.cast.length);
  const actors: Actor[] = stage.cast.flatMap((c, i) => {
    const id = c.id === 'self' ? run.protagonist : c.id;
    const member = content.cast.find((m) => m.id === id);
    if (!member) return [];
    const isMain = ['minami', 'haruto', 'yu', 'kei'].includes(member.id);
    const lineWho = line?.who === 'self' ? run.protagonist : line?.who;
    const face = line && lineWho === id && line.face ? line.face : c.face;
    return [{ look: member.look, age: isMain ? age : (member.age ?? 30), x: c.x ?? xs[i]!, face, pose: c.pose }];
  });
  return { place: stage.place, time: stage.time, actors };
}

/** 新形式は lines をそのまま、旧形式は地の文を「。」で区切って吹き出しにする */
export function linesOf(content: Content, run: RunState, scene: Scene): ShownLine[] {
  if (scene.lines?.length) {
    return scene.lines.map((l) => {
      const who = l.who === 'self' ? run.protagonist : l.who;
      const member = content.cast.find((c) => c.id === who);
      const kind = l.kind ?? (l.who === 'narration' ? 'narration' : 'say');
      const base = l.who === 'narration' ? '' : (member?.name ?? l.who);
      const name = kind === 'inner' ? `${base}（心の声）` : kind === 'message' ? `${base}（メッセージ）` : base;
      return { who, name, text: l.text, kind, face: l.face };
    });
  }
  const who = scene.viewpoint ?? run.protagonist;
  const name = scene.speaker ?? getCharacter(content, who).name;
  const parts = (scene.text ?? '').split(/(?<=。|」)/).map((t) => t.trim()).filter(Boolean);
  return parts.map((text) => ({ who, name, text, kind: 'narration' as const }));
}
