// 7.11 相談窓口
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app';
import { ExternalLink, ResourceList } from '../components/Cards';

export function ResourcesScreen() {
  const { content, run } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);
  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        相談窓口
      </h1>
      <p class="sub">電話番号を押すと、電話をかけられます。番号と受付時間は、各窓口の公式ページで確認してください。</p>
      <ResourceList items={content.resources} />
      <h2>確認元</h2>
      <ul class="sub">
        {[...new Map(content.resources.filter((r) => r.checkedAt).map((r) => [r.checkedAt!.url, r.checkedAt!])).values()].map((c) => (
          <li key={c.url}>
            <ExternalLink href={c.url}>{c.title}</ExternalLink>
          </li>
        ))}
      </ul>
      {run && run.position.step !== 'finished' && (
        <a class="btn primary" href="#/play" style={{ textDecoration: 'none' }}>
          物語にもどる
        </a>
      )}
    </>
  );
}
