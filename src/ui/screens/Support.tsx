// 「話せる場所」（付録B-19）。ゲームの画面とは分けて、カテゴリごとのアコーディオンで相談先を見せる。
// 開いた直前には強い言葉を出さない（窓口の正式名は、カテゴリを開いたときに初めて出す。P5）。
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app';
import type { Resource, ResourceCategory } from '../../engine/schema';
import { ExternalLink } from '../components/Cards';

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  body: 'からだのこと',
  pregnancy: '妊娠かもしれない',
  testing: '検査を受けたい',
  identity: '好きになる人や、自分の性のこと',
  relationship: '付き合っている人や、家族との関係',
  harm: '嫌なことをされた・されそうになった',
  mind: 'こころがしんどい・話を聞いてほしい',
  family: '妊娠・不妊・これからの家族',
};

function SupportItem({ r }: { r: Resource }) {
  return (
    <li class="support-item">
      <p class="support-name">{r.url ? <ExternalLink href={r.url}>{r.name}</ExternalLink> : r.name}</p>
      <p class="support-contact">
        {r.tel ? (
          <a href={`tel:${encodeURIComponent(r.tel)}`} class="num">
            {r.contact}
          </a>
        ) : (
          r.contact
        )}
      </p>
      {(r.audience || r.region) && (
        <p class="support-labels">
          {r.region && <span class="label foreign">地域：{r.region}</span>}
          {r.audience && <span class="label foreign">{r.audience}</span>}
        </p>
      )}
    </li>
  );
}

export function SupportScreen() {
  const { content, run } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);
  const cats = Object.keys(CATEGORY_LABELS) as ResourceCategory[];
  return (
    <section class="support-page">
      <h1 tabIndex={-1} ref={h}>
        話せる場所
      </h1>
      <p class="sub">気になることに近いものを開いてください。名前を言わずに相談できるところもあります。</p>
      {cats.map((c) => {
        const items = content.resources.filter((r) => r.categories.includes(c));
        // 全国で使えるものを先に、地域の例をあとに
        items.sort((a, b) => Number(Boolean(a.region)) - Number(Boolean(b.region)));
        if (items.length === 0) return null;
        return (
          <details key={c} class="support-cat">
            <summary>{CATEGORY_LABELS[c]}</summary>
            <ul class="plain">
              {items.map((r) => (
                <SupportItem key={r.id} r={r} />
              ))}
            </ul>
          </details>
        );
      })}
      <p class="sub">番号や受付時間は変わることがあります。かける前に、それぞれの公式ページで確かめてください。</p>
      {run && run.position.step !== 'finished' && (
        <a class="btn primary" href="#/play" style={{ textDecoration: 'none' }}>
          物語にもどる
        </a>
      )}
    </section>
  );
}
