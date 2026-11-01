// 統計カード（§7.6）、選べない出来事の結果（§7.5）、相談窓口の一覧（§7.11）。
import { useEffect, useState } from 'preact/hooks';
import type { Content, Resource, Stat } from '../../engine/schema';
import type { ChanceLogEntry } from '../../engine/types';
import { SOURCE_LABELS } from '../../engine/types';
import { RichText } from './RichText';

export const pct = (p: number) => `${(Math.round(p * 1000) / 10).toString()}%`;

export function ExternalLink({ href, children }: { href: string; children: preact.ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function StatLabels({ stat }: { stat: Stat }) {
  return (
    <>
      {!stat.jpData && <span class="label foreign">米国のデータ</span>}
      {!stat.verified && <span class="label provisional">暫定値</span>}
    </>
  );
}

export function StatSource({ stat }: { stat: Stat }) {
  return (
    <p class="sub">
      出典：<ExternalLink href={stat.source.url}>{stat.source.title}</ExternalLink>
      {stat.source.additional?.map((a) => (
        <span key={a.url}>
          、<ExternalLink href={a.url}>{a.title}</ExternalLink>
        </span>
      ))}
      （{stat.source.year}）
    </p>
  );
}

/** 文型「日本では、〜（S01、2023年度）」（§11-7）。文は stats.yaml の cardText */
export function StatCard({ stat }: { stat: Stat }) {
  return (
    <article class="panel" aria-labelledby={`stat-${stat.id}`}>
      <p>
        <StatLabels stat={stat} />
      </p>
      <h3 id={`stat-${stat.id}`}>{stat.label}</h3>
      <p>
        <RichText text={stat.cardText} />（{stat.id}、{stat.source.year}）
      </p>
      {stat.definition && <p class="sub">注：{stat.definition}</p>}
      <StatSource stat={stat} />
    </article>
  );
}

export function ResourceItem({ r }: { r: Resource }) {
  return (
    <li class="panel">
      <h3 style={{ marginTop: 0 }}>{r.url ? <ExternalLink href={r.url}>{r.name}</ExternalLink> : r.name}</h3>
      <p style={{ margin: '4px 0' }}>
        {r.tel ? (
          <a href={`tel:${encodeURIComponent(r.tel)}`} class="num">
            {r.contact}
          </a>
        ) : (
          r.contact
        )}
      </p>
      <p class="sub" style={{ margin: 0 }}>
        対象：{r.target}
      </p>
    </li>
  );
}

export function ResourceList({ items }: { items: Resource[] }) {
  return (
    <ul class="plain">
      {items.map((r) => (
        <ResourceItem key={r.id} r={r} />
      ))}
    </ul>
  );
}

/** 割合を「100人に◯人」で言う。1%未満は「1000人に◯人」（付録B-50） */
export function peopleOf(p: number): { denom: number; count: number; text: string } {
  const denom = p > 0 && p < 0.01 ? 1000 : 100;
  const exact = Math.round(p * denom * 10) / 10;
  const count = Math.round(exact);
  return { denom, count, text: `${denom}人に${count}人${exact === count ? '' : 'くらい'}` };
}

/**
 * 自分では選べない出来事の結果（§7.5、付録B-50）。可能性を人数で見せ、結果を文で言う。数字の根拠は開いて読む。
 * 結果は短い間のあとに出す（§16.6、800ms）。演出オフのときは即時に出す。
 */
export function ProbabilityCard({ entry, content, animate }: { entry: ChanceLogEntry; content: Content; animate: boolean }) {
  const [phase, setPhase] = useState<'start' | 'fill' | 'done'>(animate ? 'start' : 'done');
  useEffect(() => {
    if (!animate) return;
    const a = requestAnimationFrame(() => setPhase('fill'));
    const t = setTimeout(() => setPhase('done'), 800);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(t);
    };
  }, [entry.nodeId, animate]);

  const baseStat = content.stats.find((s) => s.id === entry.baseStatRef);
  const kind = entry.actorLabel ? `${entry.actorLabel}（統計にもとづく）` : '自分では選べない出来事';
  const people = peopleOf(entry.finalP);
  const lit = phase === 'start' ? 0 : Math.max(people.count, entry.finalP > 0 ? 1 : 0);

  return (
    <article class="panel chance-card" aria-labelledby="prob-title">
      <p class="sub" style={{ margin: 0 }}>
        {kind}
      </p>
      <h2 id="prob-title" style={{ marginTop: 4 }}>
        {entry.label}
      </h2>
      <p class="chance-people num">{people.text}</p>
      <div class={`people-dots d${people.denom}`} aria-hidden="true">
        {Array.from({ length: people.denom }, (_, i) => (
          <span key={i} class={i < lit ? 'lit' : ''} />
        ))}
      </div>
      <div aria-live="polite">
        {phase === 'done' && <p class="result">{entry.resultText ?? (entry.happened ? '起きました。' : '起きませんでした。')}</p>}
      </div>
      <details>
        <summary>数字の根拠を見る</summary>
        <dl style={{ margin: 0 }}>
          <dt class="sub">もとになる割合</dt>
          <dd class="num" style={{ margin: '0 0 8px' }}>
            {pct(entry.base)}（{entry.baseStatRef}
            {baseStat ? `　${baseStat.label}` : ''}）{baseStat && <StatLabels stat={baseStat} />}
          </dd>
          <dt class="sub">割合を変えた要因</dt>
          <dd style={{ margin: '0 0 8px' }}>
            {entry.modifiersApplied.length === 0 ? (
              'なし'
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {entry.modifiersApplied.map((m, i) => (
                  <li key={i} class="num">
                    {SOURCE_LABELS[m.source]}：{m.note}　{pct(m.from)} → {pct(m.to)}（{m.op === 'odds' ? `オッズ比${m.value}、` : ''}{m.statRef}）
                  </li>
                ))}
              </ul>
            )}
          </dd>
          <dt class="sub">この人の場合</dt>
          <dd class="num" style={{ margin: 0, fontWeight: 700 }}>
            {pct(entry.finalP)}
          </dd>
        </dl>
        {baseStat?.definition && <p class="sub">注：{baseStat.definition}</p>}
        {baseStat && <StatSource stat={baseStat} />}
      </details>
    </article>
  );
}
