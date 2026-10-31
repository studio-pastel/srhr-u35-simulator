// ふりかえりと人生の地図のための集計（付録B-7・B-23）。
import type { Content, Stage } from '../engine/schema';
import type { RunState } from '../engine/types';
import { getChapter } from '../engine/progression';

/** その章で、主人公が選んだセリフや行動（選択肢のラベル） */
export function chosenLines(content: Content, run: RunState, age: number): string[] {
  const ch = getChapter(content, age);
  const out: string[] = [];
  for (const ev of ch.events) {
    if (!run.completedEvents.includes(ev.id) || run.skippedEvents.includes(ev.id)) continue;
    for (const sc of ev.scenes) {
      if (!sc.choices?.length) continue;
      const picked = run.choices[`${ev.id}/${sc.id}`];
      const c = sc.choices.find((x) => x.id === picked);
      if (c) out.push(c.label);
    }
  }
  return out;
}

/** その章で主人公がいる場所（その周回で起きたイベントの舞台を優先） */
export function mainStage(content: Content, run: RunState, age: number): Stage | undefined {
  const ch = content.chapters.find((c) => c.age === age);
  if (!ch) return undefined;
  const done = ch.events.find((e) => run.completedEvents.includes(e.id) && e.stage);
  return (done ?? ch.events.find((e) => e.stage))?.stage;
}

/** その章で、パラメーターの増減の大きいもの（理由つき） */
export function chapterHighlights(run: RunState, age: number) {
  const entries = run.ledger.filter((e) => e.age === age);
  const byParam = new Map<string, { delta: number; reasons: { note: string; source: string; delta: number }[] }>();
  for (const e of entries) {
    const m = byParam.get(e.param) ?? { delta: 0, reasons: [] };
    m.delta += e.delta;
    m.reasons.push({ note: e.note, source: e.source, delta: e.delta });
    byParam.set(e.param, m);
  }
  return [...byParam.entries()].sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta) || b[1].reasons.length - a[1].reasons.length);
}
