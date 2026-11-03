// 人物の一覧（付録B-52）。その年の章に出てくる人を、主人公を中心に、家族・交友関係・その他に分けて見せる。
// 名前だけ先に出てくる人（心の声の中の名前）も、ここで先に紹介する。
// PeopleList は、場面の横に常に出す関係図（付録B-53・B-54）。同じ3つに分け、顔、名前、関係を並べ、関係が変わると更新する。
import { useApp } from '../app';
import type { RunState } from '../../engine/types';
import { ageOf, chapterPeople, knownPeople, lookOf, relationOf, tieOf } from '../stage';
import { FaceIcon } from './Faces';

const CIRCLES = [
  { id: 'family', label: '家族' },
  { id: 'friends', label: '交友関係' },
  { id: 'other', label: 'その他' },
] as const;

/** 付き合っている人は、もとの分け方にかかわらず交友関係に入れる */
function circleOf(content: ReturnType<typeof useApp>['content'], run: RunState, id: string): string | undefined {
  if (tieOf(content, run, id) === '恋人' || tieOf(content, run, id) === '元恋人') return 'friends';
  return content.cast.find((c) => c.id === id)?.circle;
}

function Face({ run, id, age }: { run: RunState; id: string; age?: number }) {
  const { content } = useApp();
  const look = lookOf(content, run, id);
  return <span class="person-face">{look && <FaceIcon look={look} age={age ?? ageOf(content, run, id)} />}</span>;
}

function Person({ run, id }: { run: RunState; id: string }) {
  const { content } = useApp();
  const c = content.cast.find((x) => x.id === id)!;
  const relation = relationOf(content, run, id);
  return (
    <li class="person">
      <Face run={run} id={id} />
      <span>
        <strong>{c.name}</strong>
        {relation && <span class="chat-relation">{relation}</span>}
        <span class="person-about">{c.about}</span>
      </span>
    </li>
  );
}

export function PeopleMap({ run, age }: { run: RunState; age: number }) {
  const { content } = useApp();
  const ids = chapterPeople(content, run, age);
  if (ids.length === 0) return null;
  return (
    <div class="people-map">
      <p class="people-center">
        <Face run={run} id="me" age={age} />
        <strong>私（{run.profile.name}）</strong>
      </p>
      <div class="people-circles">
        {CIRCLES.map((g) => {
          const list = ids.filter((id) => circleOf(content, run, id) === g.id);
          if (list.length === 0) return null;
          return (
            <section key={g.id} class="people-circle">
              <h3>{g.label}</h3>
              <ul class="plain">
                {list.map((id) => (
                  <Person key={id} run={run} id={id} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 場面の横に常に出す、まわりの人の一覧 */
export function PeopleList({ run }: { run: RunState }) {
  const { content } = useApp();
  const ids = knownPeople(content, run);
  if (ids.length === 0) return null;
  return (
    <div class="people-list" aria-label="まわりの人">
      {CIRCLES.map((g) => {
        const list = ids.filter((id) => circleOf(content, run, id) === g.id);
        if (list.length === 0) return null;
        return (
          <section key={g.id}>
            <h3>{g.label}</h3>
            <ul class="plain">
              {list.map((id) => {
                const tie = tieOf(content, run, id);
                return (
                  <li key={id} class={tie === '恋人' ? 'is-partner' : undefined}>
                    <Face run={run} id={id} />
                    <span class="people-list-name">{content.cast.find((c) => c.id === id)?.name}</span>
                    {tie && <span class="people-list-tie">{tie}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
