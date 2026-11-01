// 0〜15歳の生い立ちの年表（付録B-47）。起きた順に並べ、パラメーターの変化を出来事に結びつける。
import { check } from './flags';
import { historyOf, type HistoryEffect } from './profile';
import { contextOf } from './progression';
import type { Content } from './schema';
import type { RunState } from './types';

export interface LifeEntry {
  age: number;
  text: string;
  kind: 'narration' | 'inner';
  effects: HistoryEffect[];
}

export function lifeStory(content: Content, run: RunState): LifeEntry[] {
  const ctx = contextOf(content, run);
  const pro = content.prologue;
  const name = (t: string) => t.replace('%name%', run.profile.name);
  const out: LifeEntry[] = pro.entries
    .filter((l) => check(l.when, ctx))
    .map((l) => ({ age: l.age, text: name(l.text), kind: l.kind, effects: [] }));
  for (const h of historyOf(run.profile)) {
    const text =
      h.kind === 'family' ? pro.family[h.id] : h.kind === 'care' ? pro.care : (pro.bodyRespect[h.id].find((l) => check(l.when, ctx))?.text ?? '');
    out.push({ age: h.age, text: name(text), kind: 'narration', effects: h.effects });
  }
  // 同じ年齢の中では、最後の行（「春が来れば」など）を動かさないよう、変化のある出来事を先に置く
  return out.map((e, i) => ({ e, i })).sort((a, b) => a.e.age - b.e.age || b.e.effects.length - a.e.effects.length || a.i - b.i).map((x) => x.e);
}
