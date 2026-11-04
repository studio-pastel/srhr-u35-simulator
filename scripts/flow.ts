// npm run flow：本文（content/chapters）から、セリフのルート図を HTML で書き出す（開発用。付録B-56）。
// 仕様を固めるための資料で、サイトには含めない。図は Mermaid の記法で書き、claude.ai の Artifact で描画する。
// 使い方：npm run flow -- [出力先]（省略時は flow.html。.gitignore 済み）
import { writeFileSync } from 'node:fs';
import { loadRawContent } from './lib/load-content';
import { validateContent } from '../src/engine/validate';
import { PARAM_LABELS, SOURCE_LABELS, TRIGGER_LABELS } from '../src/engine/types';
import type { Choice, Content, GameEvent, Scene } from '../src/engine/schema';

const out = process.argv[2] ?? 'flow.html';
const r = validateContent(loadRawContent(), { production: false, allowUnverified: true });
if (!r.content) {
  console.error('✗ コンテンツの検証に失敗しました。npm run validate で確かめてください');
  process.exit(1);
}
const content: Content = r.content;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Mermaid のラベルの中で使えない文字を置きかえる */
const mm = (s: string) => s.replace(/"/g, '#quot;').replace(/[<>]/g, '').replace(/\n/g, ' ');
const cut = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n).join('') + '…' : s);
const SIZE = { S: 'S', M: 'M', L: 'L' } as Record<string, string>;
const nameOf = (who: string) => (who === 'self' ? '私' : who === 'partner' ? '相手' : who === 'narration' ? '' : (content.cast.find((c) => c.id === who)?.name ?? who));

type Eff = { param: keyof typeof PARAM_LABELS; sign: number; size: string; source?: string; when?: string; note: string };
const effText = (e: Eff) => `${PARAM_LABELS[e.param]}${e.sign > 0 ? '+' : '−'}${SIZE[e.size] ?? e.size}`;
const effLong = (e: Eff) => `${effText(e)}（${e.source ? SOURCE_LABELS[e.source as keyof typeof SOURCE_LABELS] : '偶然'}：${e.note}）${e.when ? `　条件：${e.when}` : ''}`;

/** 条件式を、読みやすい日本語に近づける（完全な翻訳ではない） */
function cond(expr?: string): string {
  if (!expr) return '';
  return expr
    .replace(/flags\.dating == true/g, '付き合っている')
    .replace(/flags\.partnerId == 'sou'/g, '気になる人がソウ')
    .replace(/flags\.partnerId == 'saki'/g, '気になる人がサキ')
    .replace(/flags\.pregnancyPossible == (true|false)/g, (_m, v) => (v === 'true' ? '妊娠の可能性がある' : '妊娠の可能性がない'))
    .replace(/flags\.knowsConsent == (true|false)/g, (_m, v) => (v === 'true' ? '学校で同意を学んだ' : '学校で同意を学ばなかった'))
    .replace(/up\.gender/g, '性自認')
    .replace(/up\.body/g, 'からだ')
    .replace(/up\.attractedTo/g, '好きになる人')
    .replace(/up\.economy/g, '家計')
    .replace(/up\.familyCare/g, 'きょうだいの世話')
    .replace(/up\.bodyRespect/g, 'からだの尊重')
    .replace(/up\.witnessedDV/g, '親のあいだの暴力')
    .replace(/flags\./g, '')
    .replace(/cond\./g, '社会条件.')
    .replace(/'transWoman'/g, 'トランス女性')
    .replace(/'transMan'/g, 'トランス男性')
    .replace(/'nonbinary'/g, 'ノンバイナリー')
    .replace(/'woman'/g, '女性')
    .replace(/'man'/g, '男性')
    .replace(/'canBePregnant'/g, '妊娠し得る')
    .replace(/'cannot'/g, '妊娠しない')
    .replace(/'men'/g, '男性')
    .replace(/'women'/g, '女性')
    .replace(/'any'/g, '性別を問わない')
    .replace(/'none'/g, '恋愛感情をあまり持たない')
    .replace(/'unsure'/g, 'わからない')
    .replace(/'hardship'/g, '苦しい')
    .replace(/'middle'/g, 'ふつう')
    .replace(/ == /g, '＝')
    .replace(/ != /g, '≠')
    .replace(/ && /g, ' かつ ')
    .replace(/ \|\| /g, ' または ');
}

/** 1つのイベントのルート図（Mermaid） */
function graph(ev: GameEvent): string {
  const id = (s: string) => `${ev.id.replace(/-/g, '_')}_${s}`;
  const lines: string[] = ['flowchart TD'];
  const endUsed = { v: false };
  const target = (next: string) => (next === 'END' ? ((endUsed.v = true), id('END')) : id(next));
  for (const sc of ev.scenes) {
    const ls = sc.lines ?? [];
    const first = ls[0] ? `${nameOf(ls[0].who) ? nameOf(ls[0].who) + '：' : ''}${ls[0].text}` : '';
    const conds = ls.filter((l) => l.when).length;
    const effs = (sc.effects ?? []) as Eff[];
    const label = [`<b>${mm(sc.id)}</b>（${ls.length}行${conds ? `、うち条件つき${conds}` : ''}）`, mm(cut(first, 26)), effs.length ? effs.map(effText).join('、') : ''].filter(Boolean).join('<br/>');
    lines.push(`  ${id(sc.id)}["${label}"]`);
    if (sc.chance) {
      const c = sc.chance;
      lines.push(`  ${id(sc.id + '_chance')}{{"${mm(`偶然：${cut(c.label, 22)}`)}"}}`);
      lines.push(`  ${id(sc.id)} --> ${id(sc.id + '_chance')}`);
      lines.push(`  ${id(sc.id + '_chance')} -->|"${mm('起きた：' + ((c.outcomes.happens.effects ?? []) as Eff[]).map(effText).join('、'))}"| ${target(c.outcomes.happens.next ?? 'END')}`);
      lines.push(`  ${id(sc.id + '_chance')} -->|"起きない"| ${target(c.outcomes.notHappens.next ?? 'END')}`);
      lines.push(`  class ${id(sc.id + '_chance')} chance`);
    }
    for (const c of (sc.choices ?? []) as Choice[]) {
      const eff = ((c.effects ?? []) as Eff[]).map(effText).join('、');
      const label = [mm(`${c.canonical ? '★' : ''}${cut(c.label, 24)}`), c.requires ? mm(`［${cut(cond(c.requires), 26)}］`) : '', eff].filter(Boolean).join('<br/>');
      lines.push(`  ${id(sc.id)} -->|"${label}"| ${target(c.next)}`);
    }
    for (const b of sc.branches ?? []) lines.push(`  ${id(sc.id)} -.->|"${mm('条件：' + cut(cond(b.when), 28))}"| ${target(b.next)}`);
    if (!sc.choices?.length && !sc.chance && sc.next) lines.push(`  ${id(sc.id)} -.-> ${target(sc.next)}`);
  }
  if (endUsed.v) {
    lines.push(`  ${id('END')}(("終わり"))`);
    lines.push(`  class ${id('END')} endnode`);
  }
  lines.push('  classDef chance fill:#f6e2a6,stroke:#8a6a12,color:#1e1f24');
  lines.push('  classDef endnode fill:#e7e5df,stroke:#8b8f99,color:#1e1f24');
  return lines.join('\n');
}

function sceneDetail(ev: GameEvent, sc: Scene): string {
  const rows = (sc.lines ?? [])
    .map((l) => {
      const kind = l.kind === 'inner' ? '心の声' : l.kind === 'message' ? 'メッセージ' : l.who === 'narration' ? '地の文' : 'せりふ';
      return `<tr><td class="who">${esc(nameOf(l.who) || '―')}</td><td class="kind">${kind}</td><td>${esc(l.text)}${l.when ? `<div class="cond">条件：${esc(cond(l.when))}</div>` : ''}</td></tr>`;
    })
    .join('');
  const effs = ((sc.effects ?? []) as Eff[]).map((e) => `<li>場面に入ると：${esc(effLong(e))}</li>`).join('');
  const choices = ((sc.choices ?? []) as Choice[])
    .map((c) => {
      const e = ((c.effects ?? []) as Eff[]).map((x) => esc(effLong(x))).join('<br/>');
      const flags = c.setFlags ? Object.entries(c.setFlags).map(([k, v]) => `${k}=${v}`).join('、') : '';
      return `<li><b>${c.canonical ? '★ ' : ''}${esc(c.label)}</b> → ${esc(c.next)}${c.requires ? `<div class="cond">表示の条件：${esc(cond(c.requires))}</div>` : ''}${e ? `<div class="eff">${e}</div>` : ''}${flags ? `<div class="cond">記録：${esc(flags)}</div>` : ''}</li>`;
    })
    .join('');
  return `<details><summary><code>${esc(sc.id)}</code>　${(sc.lines ?? []).length}行${sc.choices?.length ? `・選択肢${sc.choices.length}` : ''}${sc.chance ? '・偶然' : ''}</summary>
<table><tbody>${rows}</tbody></table>${effs ? `<ul class="effs">${effs}</ul>` : ''}${choices ? `<ul class="choices">${choices}</ul>` : ''}</details>`;
}

const chapters = [...content.chapters].sort((a, b) => a.age - b.age);
const toc = chapters.map((ch) => `<li><a href="#age-${ch.age}">${ch.age}歳</a>：${ch.events.map((e) => `<a href="#${e.id}">${e.id}</a>`).join('　')}</li>`).join('');
const body = chapters
  .map((ch) => {
    const evs = ch.events
      .map((ev) => {
        const t = ev.trigger ? `${TRIGGER_LABELS[ev.trigger.kind]}：${ev.trigger.text}` : '';
        return `<section class="event" id="${ev.id}">
<header><h3>${esc(ev.id)}</h3><p class="summary">${esc(ev.summary ?? '')}</p></header>
<dl class="meta">
<div><dt>きっかけ</dt><dd>${esc(t)}</dd></div>
<div><dt>発生の条件</dt><dd>${ev.requires ? esc(cond(ev.requires)) : '誰にでも'}</dd></div>
${ev.statCard?.length ? `<div><dt>統計カード</dt><dd>${esc(ev.statCard.join('、'))}</dd></div>` : ''}
<div><dt>状態</dt><dd>${esc(ev.status ?? '')}</dd></div>
</dl>
<div class="graph"><pre class="mermaid">
${esc(graph(ev))}
</pre></div>
<div class="scenes">${ev.scenes.map((sc) => sceneDetail(ev, sc)).join('')}</div>
</section>`;
      })
      .join('\n');
    return `<section class="chapter" id="age-${ch.age}"><h2>${ch.age}歳　${esc(ch.season ?? '')}</h2>${evs}</section>`;
  })
  .join('\n');

const html = `<title>セリフのルート図</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 仕様を詰めるための作業図。紙の台本に赤を入れる感覚で、図と台本を上下に並べる */
:root {
  --bg: #f6f6f3; --surface: #ffffff; --fg: #1e1f24; --sub: #5b5e66; --line: #d9d7d0;
  --accent: #3d5a80; --chance: #8a6a12; --cond: #2a7f86;
  --font: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  --mono: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #16171b; --surface: #202228; --fg: #e9e8e4; --sub: #a3a6ad; --line: #3a3d45; --accent: #8fb0d8; --chance: #e3c065; --cond: #6cc4c9; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #16171b; --surface: #202228; --fg: #e9e8e4; --sub: #a3a6ad; --line: #3a3d45; --accent: #8fb0d8; --chance: #e3c065; --cond: #6cc4c9; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: var(--font); font-size: 15px; line-height: 1.7; }
.wrap { max-width: 1100px; margin: 0 auto; padding-block: 24px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font-size: 26px; margin: 0 0 4px; text-wrap: balance; }
.lead { color: var(--sub); margin: 0 0 16px; max-width: 65ch; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font-size: 13px; margin-bottom: 16px; }
.toc { font-size: 14px; margin: 0 0 24px; padding-left: 1.2em; }
.toc a { color: var(--accent); }
h2 { font-size: 20px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--fg); }
.event { margin: 0 0 28px; padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.event header h3 { margin: 0; font-family: var(--mono); font-size: 16px; }
.summary { margin: 2px 0 8px; color: var(--sub); }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 4px 16px; margin: 0 0 12px; font-size: 13px; }
.meta div { min-width: 0; }
.meta dt { color: var(--sub); font-size: 12px; }
.meta dd { margin: 0; }
.graph { overflow-x: auto; padding: 8px 0; border-block: 1px dashed var(--line); }
.graph pre { margin: 0; background: none; }
.scenes { margin-top: 10px; display: grid; gap: 4px; }
details { border-left: 3px solid var(--line); padding: 2px 0 2px 10px; }
details[open] { border-left-color: var(--accent); }
summary { cursor: pointer; font-size: 14px; }
summary code { font-family: var(--mono); font-weight: 700; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 14px; }
td { border-top: 1px solid var(--line); padding: 4px 6px; vertical-align: top; }
td.who { white-space: nowrap; font-weight: 700; width: 6em; }
td.kind { white-space: nowrap; color: var(--sub); font-size: 12px; width: 5.5em; }
.cond { color: var(--cond); font-size: 12px; }
.eff { color: var(--sub); font-size: 12px; }
ul.effs, ul.choices { margin: 4px 0 8px; padding-left: 1.2em; font-size: 14px; }
.table-wrap { overflow-x: auto; }
@media (max-width: 600px) { td.kind { display: none; } }
</style>
<div class="wrap">
<h1>セリフのルート図</h1>
<p class="lead">本文（content/chapters）から自動で作った開発用の図です。イベントごとに、場面のつながりと選択肢、条件、パラメーターの変化を示します。図の下の場面名を開くと、セリフをすべて読めます。生成日：${new Date().toISOString().slice(0, 10)}</p>
<div class="legend">
<span>実線の矢印：選択肢</span><span>点線の矢印：自動で次へ／条件で分かれる</span><span>★：とばしたときに選ばれる選択肢</span><span>［ ］：選択肢が出る条件</span><span>六角形：偶然（確率）</span><span>S・M・L：変化の大きさ</span>
</div>
<ol class="toc">${toc}</ol>
${body}
</div>
`;
writeFileSync(out, html);
console.log(`✓ ${out} を書き出しました（${chapters.reduce((n, c) => n + c.events.length, 0)}イベント）`);
