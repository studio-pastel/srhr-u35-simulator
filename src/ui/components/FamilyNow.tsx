// 生い立ちの家族の構成（付録B-54）。年表が進むにつれて、いっしょに暮らす人が変わっていくのを見せる。
// 離婚や死別でいなくなった人は、消さずに薄くして、何歳のときに何があったかを添える。
import { useApp } from '../app';
import { SIBLING_BIRTH_AGES, singleParentOf, type Profile } from '../../engine/profile';
import type { RunState } from '../../engine/types';
import { lookOf } from '../stage';
import { FaceIcon } from './Faces';

interface Member {
  id: string;
  name: string;
  tie: string;
  /** いまの状態。gone はいっしょに暮らしていない */
  note?: string;
  gone?: boolean;
  /** この年齢で変わった */
  changed: boolean;
}

export function familyAt(p: Profile, age: number): Member[] {
  const out: Member[] = [{ id: 'yuMother', name: 'お母さん', tie: '親', changed: false }];
  const s = p.familyStory;
  if (s !== 'unmarried') {
    const leaves = singleParentOf(s) && age >= p.familyAge;
    const note = !leaves ? undefined : s === 'bereaved' ? `${p.familyAge}歳のとき、亡くなった` : `${p.familyAge}歳のとき、離婚。別に暮らす`;
    out.push({ id: 'father', name: 'お父さん', tie: '親', note, gone: leaves, changed: leaves && age === p.familyAge });
  }
  if (p.familyCare) {
    if (age >= SIBLING_BIRTH_AGES.mio) out.push({ id: 'mio', name: 'アサヒ', tie: '妹', changed: age === SIBLING_BIRTH_AGES.mio, note: age === SIBLING_BIRTH_AGES.mio ? '生まれた' : undefined });
    if (age >= SIBLING_BIRTH_AGES.sora) out.push({ id: 'sora', name: 'ソラ', tie: '弟', changed: age === SIBLING_BIRTH_AGES.sora, note: age === SIBLING_BIRTH_AGES.sora ? '生まれた' : undefined });
  }
  return out;
}

export function FamilyNow({ run, age }: { run: RunState; age: number }) {
  const { content } = useApp();
  const members = familyAt(run.profile, age);
  return (
    <section class="family-now" aria-label={`${age}歳の家族`}>
      <h2>
        家族<span class="num">（{age}歳）</span>
      </h2>
      <ul class="plain">
        <li>
          <span class="person-face">
            <FaceIcon look={lookOf(content, run, 'me')!} age={age} />
          </span>
          <span class="family-name">私（{run.profile.name}）</span>
        </li>
        {members.map((m) => {
          const look = lookOf(content, run, m.id);
          return (
            <li key={m.id} class={[m.gone ? 'gone' : '', m.changed ? 'changed' : ''].join(' ').trim() || undefined}>
              <span class="person-face">{look && <FaceIcon look={look} age={Math.max(age + offsetOf(content, m.id), 0)} />}</span>
              <span class="family-name">
                {m.name}
                <span class="family-tie">{m.tie}</span>
              </span>
              {m.note && <span class="family-note">{m.note}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function offsetOf(content: ReturnType<typeof useApp>['content'], id: string): number {
  return content.cast.find((c) => c.id === id)?.peerOffset ?? 0;
}
