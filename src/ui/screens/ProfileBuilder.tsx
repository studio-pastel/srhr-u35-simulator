// 2周目で属性を変えるフォーム（付録B-43・B-45）。見本から1クリックで選ぶか、属性を1つずつ選ぶ。
// 名前は個人情報を聞かないよう、自由入力にせず一覧から選ぶ。選んだ内容は端末の外に送らない。
import { useState } from 'preact/hooks';
import { useApp } from '../app';
import type { Look, Preset } from '../../engine/schema';
import {
  ATTRACTION_LABELS,
  ATTRACTIONS,
  BODIES,
  BODY_LABELS,
  BODY_RESPECT_LABELS,
  BODY_RESPECTS,
  CLOTHES,
  defaultBody,
  defaultFamilyAge,
  FAMILY_LABELS,
  FAMILY_STORIES,
  GENDER_LABELS,
  GENDERS,
  HAIRS,
  NAMES,
  SKINS,
  type Profile,
} from '../../engine/profile';
import { PixelStage } from '../components/PixelStage';

const STYLES: { id: Look['hairStyle']; label: string }[] = [
  { id: 'short', label: 'ショート' },
  { id: 'mid', label: 'ミディアム' },
  { id: 'bob', label: 'ボブ' },
  { id: 'long', label: 'ロング' },
  { id: 'tied', label: '結ぶ' },
];
const ITEMS: { id: Look['accessory'] | 'none'; label: string; accent?: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'glasses', label: 'メガネ', accent: '#3a2f45' },
  { id: 'cap', label: 'キャップ', accent: '#d9a23b' },
  { id: 'headphones', label: 'ヘッドホン', accent: '#c0563a' },
  { id: 'beanie', label: 'ニット帽', accent: '#2a7f86' },
];

function Radios<T extends string>(props: { legend: string; note?: string; value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset class="builder-group">
      <legend>{props.legend}</legend>
      {props.note && <p class="sub">{props.note}</p>}
      <div class="builder-options">
        {props.options.map((o) => (
          <label key={o.id} class={`builder-pill${props.value === o.id ? ' on' : ''}`}>
            <input type="radio" name={props.legend} checked={props.value === o.id} onChange={() => props.onChange(o.id)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class={`builder-pill${props.checked ? ' on' : ''}`}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
      {props.label}
    </label>
  );
}

function Colors(props: { legend: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <fieldset class="builder-group">
      <legend>{props.legend}</legend>
      <div class="builder-options">
        {props.colors.map((c, i) => (
          <label key={c} class={`builder-color${props.value === c ? ' on' : ''}`}>
            <input type="radio" name={props.legend} checked={props.value === c} onChange={() => props.onChange(c)} aria-label={`${props.legend} ${i + 1}`} />
            <span style={{ background: c }} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const pick = <T extends string>(o: Record<T, string>, ids: readonly T[]) => ids.map((id) => ({ id, label: o[id] }));

/** 属性を選ぶフォーム。2周目で「属性だけ変える」ときに使う */
export function ProfileBuilder({ initial, startLabel, onStart }: { initial: Profile; startLabel: string; onStart: (p: Profile) => void }) {
  const { content, animate } = useApp();
  const [p, setP] = useState<Profile>(initial);
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const setLook = (patch: Partial<Look>) => set({ look: { ...p.look, ...patch } });

  const usePreset = (x: Preset) => {
    const look = content.cast.find((c) => c.id === x.id)!.look;
    const { id: _id, blurb: _blurb, ...rest } = x;
    setP({ ...rest, look });
  };
  const names = NAMES.includes(p.name) ? NAMES : [p.name, ...NAMES];
  const item = p.look.accessory ?? 'none';

  return (
    <div class="builder">
      <section>
        <h2>見本から選ぶ</h2>
        <div class="builder-presets">
          {content.presets.map((x) => (
            <button key={x.id} type="button" class={`preset${p.name === x.name ? ' on' : ''}`} onClick={() => usePreset(x)}>
              <PixelStage spec={{ place: 'gate', time: 'day', actors: [{ look: content.cast.find((c) => c.id === x.id)!.look, age: 16, x: 48 }] }} label={x.name} animate={false} />
              <strong>{x.name}</strong>
              <span class="sub">{x.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <div class="builder-main">
        <div class="builder-preview">
          <PixelStage spec={{ place: 'classroom', time: 'day', actors: [{ look: p.look, age: 16, x: 48 }] }} label={`${p.name}、16歳`} animate={animate} />
          <p class="builder-name">{p.name}、16歳</p>
          <button type="button" class="btn primary" onClick={() => onStart(p)}>
            {startLabel}
          </button>
        </div>

        <div class="builder-form">
          <h2>自分で組み立てる</h2>
          <Radios legend="性自認" value={p.gender} options={pick(GENDER_LABELS, GENDERS)} onChange={(gender) => set({ gender, body: defaultBody(gender) })} />
          <Radios legend="からだ" note="妊娠や月経の場面に関わります。" value={p.body} options={pick(BODY_LABELS, BODIES)} onChange={(body) => set({ body })} />
          <Radios legend="好きになる人" value={p.attractedTo} options={pick(ATTRACTION_LABELS, ATTRACTIONS)} onChange={(attractedTo) => set({ attractedTo })} />
          <Radios legend="家族の歩み" value={p.familyStory} options={pick(FAMILY_LABELS, FAMILY_STORIES)} onChange={(familyStory) => set({ familyStory, familyAge: defaultFamilyAge(familyStory) })} />
          <Radios legend="からだの感覚は、家で" value={p.bodyRespect} options={pick(BODY_RESPECT_LABELS, BODY_RESPECTS)} onChange={(bodyRespect) => set({ bodyRespect })} />
          <fieldset class="builder-group">
            <legend>きょうだい</legend>
            <div class="builder-options">
              <Check label="きょうだいの世話をしている" checked={p.familyCare} onChange={(familyCare) => set({ familyCare })} />
            </div>
          </fieldset>

          <h2>見た目</h2>
          <Radios legend="名前" value={p.name} options={names.map((n) => ({ id: n, label: n }))} onChange={(name) => set({ name })} />
          <Radios legend="髪型" value={p.look.hairStyle} options={STYLES} onChange={(hairStyle) => setLook({ hairStyle })} />
          <Colors legend="肌の色" value={p.look.skin} colors={SKINS} onChange={(skin) => setLook({ skin })} />
          <Colors legend="髪の色" value={p.look.hair} colors={HAIRS} onChange={(hair) => setLook({ hair })} />
          <Colors legend="服の色" value={p.look.clothes[0]} colors={CLOTHES} onChange={(c) => setLook({ clothes: [c, c, c] })} />
          <Radios
            legend="持ち物"
            value={item as string}
            options={ITEMS.map((i) => ({ id: i.id as string, label: i.label }))}
            onChange={(id) => {
              const it = ITEMS.find((i) => i.id === id)!;
              const { accessory: _a, accent: _b, ...rest } = p.look;
              set({ look: it.id === 'none' ? rest : { ...rest, accessory: it.id as Look['accessory'], accent: it.accent! } });
            }}
          />
          <p class="sub">選んだ内容は、この端末の中だけに保存します。どこにも送りません。</p>
        </div>
      </div>
    </div>
  );
}
