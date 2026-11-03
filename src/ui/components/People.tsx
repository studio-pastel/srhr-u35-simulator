// 人物の一覧（付録B-52）。その年の章に出てくる人を、主人公を中心に、家族と学校に分けて見せる。
// 名前だけ先に出てくる人（心の声や選択肢の中の名前）も、ここで先に紹介する。
import { useApp } from '../app';
import type { RunState } from '../../engine/types';
import { ageOf, chapterPeople, lookOf, relationOf } from '../stage';
import { FaceIcon } from './Faces';

const CIRCLES = [
  { id: 'family', label: '家族' },
  { id: 'school', label: '学校' },
] as const;

function Person({ run, id }: { run: RunState; id: string }) {
  const { content } = useApp();
  const c = content.cast.find((x) => x.id === id)!;
  const look = lookOf(content, run, id);
  const relation = relationOf(content, run, id);
  return (
    <li class="person">
      <span class="person-face">{look && <FaceIcon look={look} age={ageOf(content, run, id)} />}</span>
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
  const circleOf = (id: string) => content.cast.find((c) => c.id === id)?.circle;
  return (
    <div class="people-map">
      <p class="people-center">
        <span class="person-face">
          <FaceIcon look={lookOf(content, run, 'me')!} age={age} />
        </span>
        <strong>私（{run.profile.name}）</strong>
      </p>
      <div class="people-circles">
        {CIRCLES.map((g) => {
          const list = ids.filter((id) => circleOf(id) === g.id);
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
