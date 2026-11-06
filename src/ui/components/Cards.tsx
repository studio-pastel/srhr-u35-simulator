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
 * 自分では選べない出来事の結果（§7.5、付録B-50・B-52）。可能性を人数で見せ、結果を文で言う。数字の根拠は開いて読む。
 * 演出：カードが入ってくる → 可能性の人数だけ点が灯る → 印が点のあいだを動き、「あなた」の位置で止まる → 結果。
 * 暴力の場面（quiet）は印を動かさない（§16.6）。演出オフのときは、はじめから全部を見せる。押すと最後まで進む。
 */
type Phase = 'enter' | 'fill' | 'draw' | 'done';
const HOPS = 9;

/** 「あなた」の点。起きたときは灯った点の中、起きなかったときは灯っていない点の中から、乱数 u で決める */
export function youIndex(e: ChanceLogEntry, denom: number, lit: number): number {
  const p = e.finalP;
  if (e.happened && lit > 0) return Math.min(lit - 1, Math.floor((e.u / Math.max(p, 1e-9)) * lit));
  const rest = denom - lit;
  if (rest <= 0) return denom - 1;
  return lit + Math.min(rest - 1, Math.floor(((e.u - p) / Math.max(1 - p, 1e-9)) * rest));
}

export function ProbabilityCard({ entry, content, animate, quiet = false }: { entry: ChanceLogEntry; content: Content; animate: boolean; quiet?: boolean }) {
  const [phase, setPhase] = useState<Phase>(animate ? 'enter' : 'done');
  const [hop, setHop] = useState(0);
  useEffect(() => {
    if (!animate) return;
    setPhase('enter');
    setHop(0);
    const ts = [setTimeout(() => setPhase('fill'), 450)];
    const drawAt = 1500;
    if (quiet) ts.push(setTimeout(() => setPhase('done'), drawAt));
    else {
      ts.push(setTimeout(() => setPhase('draw'), drawAt));
      // だんだん遅くなりながら、点から点へ動く
      let t = drawAt;
      for (let i = 1; i <= HOPS; i++) {
        t += 70 + i * 22;
        ts.push(setTimeout(() => setHop(i), t));
      }
      ts.push(setTimeout(() => setPhase('done'), t + 350));
    }
    return () => ts.forEach(clearTimeout);
  }, [entry.nodeId, animate, quiet]);

  const baseStat = content.stats.find((s) => s.id === entry.baseStatRef);
  const kind = entry.actorLabel ? `${entry.actorLabel}（統計にもとづく）` : '自分では選べない出来事';
  const people = peopleOf(entry.finalP);
  const litCount = Math.max(people.count, entry.happened && entry.finalP > 0 ? 1 : 0);
  const lit = phase === 'enter' ? 0 : litCount;
  const you = youIndex(entry, people.denom, litCount);
  // 動いているあいだの印の位置。最後の1歩で「あなた」の点に止まる
  const marker = quiet ? -1 : phase === 'done' ? you : phase === 'draw' ? (hop >= HOPS ? you : (you + 7 * (hop + 1) * 13 + hop * hop) % people.denom) : -1;
  const finish = () => phase !== 'done' && setPhase('done');

  return (
    <article class={`panel chance-card${animate ? ' chance-enter' : ''}`} aria-labelledby="prob-title" onClick={finish}>
      <p class="chance-kind">{kind}</p>
      <h2 id="prob-title" style={{ marginTop: 4 }}>
        {entry.label}
      </h2>
      <p class="chance-people num">{people.text}</p>
      <div class={`people-dots d${people.denom}${animate ? ' staged' : ''}`} aria-hidden="true">
        {Array.from({ length: people.denom }, (_, i) => (
          <span
            key={i}
            class={[i < lit ? 'lit' : '', i === marker ? (phase === 'done' ? 'you' : 'pick') : ''].join(' ').trim() || undefined}
            style={animate && i < litCount ? { transitionDelay: `${Math.round((i / Math.max(litCount, 1)) * 700)}ms` } : undefined}
          />
        ))}
      </div>
      {!quiet && <p class="sub chance-you">{phase === 'done' ? '枠のついた点が、この人生です。' : phase === 'draw' ? 'この人生は、どこに入る？' : ' '}</p>}
      <div aria-live="polite">
        {phase === 'done' && <p class="result result-in">{entry.resultText ?? (entry.happened ? '起きました。' : '起きませんでした。')}</p>}
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
          <dd class="num" style={{ margin: 0, fontWeight: 500 }}>
            {pct(entry.finalP)}
          </dd>
        </dl>
        {baseStat?.definition && <p class="sub">注：{baseStat.definition}</p>}
        {baseStat && <StatSource stat={baseStat} />}
      </details>
    </article>
  );
}
