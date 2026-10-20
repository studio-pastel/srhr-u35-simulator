// ルビ記法 {漢字|かんじ} を <ruby> に変換して表示する（§9）。
import type { JSX } from 'preact';

export function RichText({ text }: { text: string }): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  const re = /\{([^|{}]+)\|([^{}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <ruby key={i++}>
        {m[1]}
        <rp>(</rp>
        <rt>{m[2]}</rt>
        <rp>)</rp>
      </ruby>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** ルビを外した文字列（aria-label などに使う） */
export function plainText(text: string): string {
  return text.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
}
