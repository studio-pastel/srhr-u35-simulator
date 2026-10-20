// §9：コントラスト比。本文は 4.5:1 以上（WCAG 1.4.3）、図やボタンの輪郭は 3:1 以上（1.4.11）。
// src/ui/styles/tokens.css のライト・ダーク両方の値を読んで検査する。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(import.meta.dirname, '../../src/ui/styles/tokens.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const darkBlock = css.slice(darkStart, css.indexOf('}', css.indexOf(':root {', darkStart)));
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
export function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** [前景, 背景, 必要な比, 用途] */
const TEXT: [string, string, number, string][] = [
  ['text', 'bg', 4.5, '本文'],
  ['text', 'surface', 4.5, 'パネルの本文'],
  ['text', 'caution-bg', 4.5, 'トリガー注意の本文'],
  ['text-sub', 'bg', 4.5, '補足'],
  ['text-sub', 'surface', 4.5, 'パネルの補足'],
  ['text-sub', 'caution-bg', 4.5, '注意画面の補足'],
  ['accent', 'surface', 4.5, 'リンク・選択肢の文字'],
  ['accent', 'bg', 4.5, 'リンク'],
  ['surface', 'accent', 4.5, '主ボタンの文字'],
  ['exit-text', 'exit', 4.5, '「すぐに閉じる」'],
  ['exit', 'surface', 4.5, '「暫定値」ラベル'],
];
const GRAPHICS: [string, string, number, string][] = [
  ['accent', 'surface', 3, '選択肢の枠・フォーカス'],
  ['accent', 'track', 3, 'ゲージ'],
  ['text', 'surface', 3, '要因分解の棒の輪郭'],
  ...(['body', 'safety', 'psychSafety', 'options', 'connection', 'autonomy'] as const).map(
    (p) => [`p-${p}`, 'surface', 3, `折れ線（${p}）`] as [string, string, number, string],
  ),
];

describe.each([
  ['ライト', light],
  ['ダーク', dark],
])('%sモードのコントラスト（§9）', (_, t) => {
  it.each([...TEXT, ...GRAPHICS])('%s / %s ≥ %s（%s）', (fg, bg, min) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
  });
});
