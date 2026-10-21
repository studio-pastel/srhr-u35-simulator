// 人生の地図（付録B-7・B-23）：16歳から35歳までの流れを俯瞰する。
// 過ぎた章は、その年齢の姿・場所・自分が言ったことを見せ、まだ来ていない章は伏せる。
import { useApp } from '../app';
import type { RunState } from '../../engine/types';
import { getCharacter, sortedChapters } from '../../engine/progression';
import { sceneSpec } from '../stage';
import { chosenLines, mainStage } from '../review';
import { PixelStage } from './PixelStage';
import { RichText } from './RichText';
import { BondRow } from './Bonds';

type Status = 'done' | 'current' | 'future';

function statusOf(run: RunState, age: number): Status {
  if (run.position.step === 'finished') return 'done';
  if (age < run.position.age) return 'done';
  if (age === run.position.age) return run.position.step === 'review' ? 'done' : 'current';
  return 'future';
}

/** 横一列の小さな地図（幕間・章のふりかえりで使う） */
export function LifeStrip({ run }: { run: RunState }) {
  const { content } = useApp();
  return (
    <ol class="life-strip" aria-label="人生の地図">
      {sortedChapters(content).map((ch) => {
        const st = statusOf(run, ch.age);
        return (
          <li key={ch.age} class={`life-dot ${st}`} aria-current={st === 'current' ? 'step' : undefined}>
            <span class="num">{ch.age}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 縦に並べた地図。各章の姿と、自分が言ったこと */
export function LifeMap({ run }: { run: RunState }) {
  const { content, animate } = useApp();
  const me = getCharacter(content, run.protagonist);
  return (
    <ol class="life-map" aria-label={`${me.name}の人生の地図`}>
      {sortedChapters(content).map((ch) => {
        const st = statusOf(run, ch.age);
        const said = st === 'future' ? [] : chosenLines(content, run, ch.age);
        const skipped = ch.events.filter((e) => run.skippedEvents.includes(e.id));
        const ageRun = { ...run, position: { ...run.position, age: ch.age } };
        const spec = sceneSpec(content, ageRun, mainStage(content, run.protagonist, ch.age));
        return (
          <li key={ch.age} class={`life-node ${st}`}>
            <div class="life-age num">{ch.age}歳</div>
            <div class="life-body">
              {st === 'future' ? (
                <div class="life-thumb future" aria-hidden="true">
                  ？
                </div>
              ) : (
                <div class="life-thumb">
                  <PixelStage spec={spec} label={`${me.name}、${ch.age}歳`} animate={animate && st === 'current'} />
                </div>
              )}
              <p class="life-stage">{st === 'future' ? 'まだ来ていない' : ch.season}</p>
              {st !== 'future' && (
                <p class="life-news">
                  <RichText text={ch.intro[run.protagonist] ?? ''} />
                </p>
              )}
              {said.map((s, i) => (
                <p key={i} class="life-said">
                  <RichText text={s} />
                </p>
              ))}
              {st !== 'future' && <BondRow run={run} age={ch.age} />}
              {skipped.length > 0 && <p class="sub">とばした場面：{skipped.map((e) => e.summary ?? '').join('／')}</p>}
              {st === 'current' && <p class="life-here">いま、ここ</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
