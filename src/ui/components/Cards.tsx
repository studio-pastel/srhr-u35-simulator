// 統計カード（§7.6）、確率カード（§7.5）、相談窓口の一覧（§7.11）。
import { useEffect, useState } from 'preact/hooks';
import type { Content, Resource, Stat } from '../../engine/schema';
import type { ChanceLogEntry } from '../../engine/types';
import { SOURCE_LABELS } from '../../engine/types';

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

/** 文型「日本では、〜（S01、2023年度）」（§11-7）。数値は stats.yaml の value をそのまま使う */
export function StatCard({ stat }: { stat: Stat }) {
  const where = stat.jpData ? '日本では' : '米国では';
  return (
    <article class="panel" aria-labelledby={`stat-${stat.id}`}>
      <p>
        <StatLabels stat={stat} />
      </p>
      <h3 id={`stat-${stat.id}`}>{stat.label}</h3>
      <p>
        {where}、{stat.value}（{stat.id}、{stat.source.year}）
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

/**
 * 確率カード。ゲージが最終確率まで伸び、針が u の位置で止まって結果を出す（§16.6、800ms）。
 * 演出オフのときは結果を即時に出す。
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

  const stat = (id: string) => content.stats.find((s) => s.id === id);
  const baseStat = stat(entry.baseStatRef);
  const kind = entry.actorLabel ? `${entry.actorLabel}（統計にもとづく）` : '偶然';
  const shown = phase !== 'start';

  return (
    <article class="panel" aria-labelledby="prob-title">
      <p class="sub" style={{ margin: 0 }}>
        確率カード：{kind}
      </p>
      <h2 id="prob-title" style={{ marginTop: 4 }}>
        {entry.label}
      </h2>
      <dl style={{ margin: 0 }}>
        <dt class="sub">基本の確率</dt>
        <dd class="num" style={{ margin: '0 0 8px' }}>
          {pct(entry.base)}（根拠：{entry.baseStatRef}
          {baseStat ? `　${baseStat.label}` : ''}）{baseStat && <StatLabels stat={baseStat} />}
        </dd>
        <dt class="sub">確率を変えた要因</dt>
        <dd style={{ margin: '0 0 8px' }}>
          {entry.modifiersApplied.length === 0 ? (
            'なし'
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              {entry.modifiersApplied.map((m, i) => (
                <li key={i} class="num">
                  {SOURCE_LABELS[m.source]}：{m.note}　{pct(m.from)} → {pct(m.to)}（{m.statRef}）
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt class="sub">最終の確率</dt>
        <dd class="num" style={{ margin: 0, fontWeight: 700 }}>
          {pct(entry.finalP)}
        </dd>
      </dl>
      <div class="prob-gauge" aria-hidden="true">
        <div class="prob-fill" style={{ width: shown ? pct(entry.finalP) : '0%' }} />
        <div class="prob-needle" style={{ left: shown ? `calc(${(entry.u * 100).toFixed(2)}% - 1px)` : '0%' }}>
          <span>出た値</span>
        </div>
      </div>
      <div aria-live="polite">
        {phase === 'done' && (
          <p class="result">
            結果：{entry.happened ? '起きた' : '起きなかった'}
            <span class="sub num" style={{ display: 'block', fontWeight: 400, fontSize: 13 }}>
              出た値 {entry.u.toFixed(3)} が {pct(entry.finalP)} の範囲{entry.happened ? 'に入った' : 'の外だった'}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
