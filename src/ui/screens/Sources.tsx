// 7.12 出典：§10.5 の全統計の一覧
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app';
import { StatLabels, StatSource } from '../components/Cards';

export function SourcesScreen() {
  const { content } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);
  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        出典
      </h1>
      <p class="sub">
        このサイトで使う数字の一覧です。「暫定値」は、二次資料などのため原典で確認できていない数字です。「米国のデータ」は、日本の公的な統計がないため代わりに使っている数字です。
      </p>
      {content.stats.map((s) => (
        <article class="panel" key={s.id} aria-labelledby={`src-${s.id}`}>
          <p style={{ margin: 0 }}>
            <span class="num sub">{s.id}</span> <StatLabels stat={s} />
          </p>
          <h2 id={`src-${s.id}`} style={{ margin: '4px 0', fontSize: 17 }}>
            {s.label}
          </h2>
          <p style={{ margin: '4px 0' }}>{s.value}</p>
          {s.definition && <p class="sub" style={{ margin: '4px 0' }}>注：{s.definition}</p>}
          <StatSource stat={s} />
        </article>
      ))}
    </>
  );
}
