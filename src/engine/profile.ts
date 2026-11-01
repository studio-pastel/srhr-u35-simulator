// 主人公の属性（付録B-43・B-45）。1周目はランダムに決まり、2周目で変えて比べられる。保存は端末の中だけで、外には送らない。
import type { Params } from './types';
import type { Look, ParamKey } from './schema';
import { uniformFor } from './rng';
import { ATTRACTIONS, BODIES, BODY_RESPECTS, ECONOMIES, FAMILY_STORIES, GENDERS } from './profile-values';
export { ATTRACTIONS, BODIES, BODY_RESPECTS, ECONOMIES, FAMILY_STORIES, GENDERS };

export type Gender = (typeof GENDERS)[number];
export type Body = (typeof BODIES)[number];
export type Attraction = (typeof ATTRACTIONS)[number];
export type Economy = (typeof ECONOMIES)[number];
export type FamilyStory = (typeof FAMILY_STORIES)[number];
export type BodyRespect = (typeof BODY_RESPECTS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  woman: '女性',
  man: '男性',
  transWoman: 'トランスジェンダー女性',
  transMan: 'トランスジェンダー男性',
  nonbinary: 'ノンバイナリー',
};
export const BODY_LABELS: Record<Body, string> = {
  canBePregnant: '月経があり、妊娠する可能性がある',
  cannot: '月経はなく、妊娠する可能性はない',
};
export const ATTRACTION_LABELS: Record<Attraction, string> = {
  men: '男性',
  women: '女性',
  any: '性別を問わない',
  none: '恋愛感情をあまり持たない',
  unsure: 'まだわからない',
};

export interface Profile {
  name: string;
  gender: Gender;
  body: Body;
  attractedTo: Attraction;
  /** 0〜15歳の家族の歩み。「ひとり親」などの属性名ではなく、起きた出来事として持つ（付録B-47） */
  familyStory: FamilyStory;
  /** その出来事が起きた年齢 */
  familyAge: number;
  /** 家で、本人のからだの感覚が尊重されてきたか（付録B-47） */
  bodyRespect: BodyRespect;
  familyCare: boolean;
  look: Look;
}

export const FAMILY_LABELS: Record<FamilyStory, string> = {
  divorceMoved: '両親が離婚し、転居と転職で暮らしが変わった',
  divorceRelief: '家の緊張が続いたのち、両親が離婚した',
  unmarried: '生まれたときから、母と2人で暮らしてきた',
  bereaved: '父を亡くし、母が1人で支えてきた',
  twoStable: '両親と暮らし、家計は安定している',
  twoCold: '両親と暮らし、家の中の空気が冷え切っている',
  twoTense: '両親と暮らし、父が母を怒鳴る夜がある',
  twoHardship: '両親と暮らし、失業や不調で家計が厳しい',
};
export const BODY_RESPECT_LABELS: Record<BodyRespect, string> = {
  dismissed: '痛みや不調は我慢するものとされてきた',
  managed: '体調や進路を、親が先回りして決めてきた',
  respected: '痛みや不調を、そのまま受けとめてもらえた',
};

/** 家族の歩みから決まること。場面の出し分けに使う */
export function economyOf(s: FamilyStory): Economy {
  return s === 'divorceMoved' || s === 'divorceRelief' || s === 'unmarried' || s === 'twoHardship' ? 'hardship' : 'middle';
}
export function singleParentOf(s: FamilyStory): boolean {
  return s === 'divorceMoved' || s === 'divorceRelief' || s === 'unmarried' || s === 'bereaved';
}

/** 条件式の up.〇〇 で読める属性 */
export const PROFILE_KEYS = ['gender', 'body', 'attractedTo', 'economy', 'singleParent', 'familyCare', 'witnessedDV', 'familyStory', 'bodyRespect'] as const;

export function upOf(p: Profile): Record<string, unknown> {
  return {
    gender: p.gender,
    body: p.body,
    attractedTo: p.attractedTo,
    economy: economyOf(p.familyStory),
    singleParent: singleParentOf(p.familyStory),
    familyCare: p.familyCare,
    witnessedDV: p.familyStory === 'twoTense',
    familyStory: p.familyStory,
    bodyRespect: p.bodyRespect,
  };
}

/** 性自認に合わせた、からだの初期値。画面で変えられる */
export function defaultBody(g: Gender): Body {
  return g === 'woman' || g === 'transMan' ? 'canBePregnant' : 'cannot';
}

export interface HistoryEffect {
  param: ParamKey;
  delta: number;
  note: string;
}
export type HistoryEvent = { age: number } & ({ kind: 'family'; id: FamilyStory } | { kind: 'bodyRespect'; id: BodyRespect } | { kind: 'care' }) & { effects: HistoryEffect[] };

const FAMILY_EFFECTS: Record<FamilyStory, HistoryEffect[]> = {
  divorceMoved: [
    { param: 'living', delta: -5, note: '転居と転職で、家計のやりくりが厳しくなった' },
    { param: 'autonomy', delta: -3, note: 'お金の事情で、選べることが減った' },
  ],
  divorceRelief: [
    { param: 'living', delta: -5, note: '離婚で、暮らしが苦しくなった' },
    { param: 'connection', delta: 2, note: '家の中の張り詰めた空気がなくなった' },
  ],
  unmarried: [
    { param: 'living', delta: -5, note: '母が1人で働きながら、子育てを担っている' },
    { param: 'autonomy', delta: -3, note: '日々の暮らしや時間に、余裕があまりない' },
  ],
  bereaved: [
    { param: 'living', delta: -3, note: '母が1人で家計と家事を担うことになった' },
    { param: 'connection', delta: -2, note: '大切な人を亡くした' },
  ],
  twoStable: [{ param: 'living', delta: 5, note: '経済的に安定した家で育った' }],
  twoCold: [{ param: 'connection', delta: -5, note: '家の中で、安心していられない' }],
  twoTense: [
    { param: 'living', delta: -5, note: '家の中で、安心して暮らせない' },
    { param: 'connection', delta: -5, note: '家で怒鳴り声が続いた' },
  ],
  twoHardship: [{ param: 'living', delta: -5, note: '親の失業や体調不良が重なった' }],
};
const BODY_RESPECT_EFFECTS: Record<BodyRespect, HistoryEffect[]> = {
  dismissed: [
    { param: 'autonomy', delta: -3, note: 'しんどさを口にしなくなった' },
    { param: 'body', delta: -2, note: '不調を我慢するようになった' },
  ],
  managed: [{ param: 'autonomy', delta: -5, note: '自分の感覚や意志で選ぶ機会が少なかった' }],
  respected: [
    { param: 'autonomy', delta: 3, note: 'からだの感覚を、そのまま尊重されてきた' },
    { param: 'body', delta: 2, note: '必要なときに病院に行けた' },
  ],
};
const BODY_RESPECT_AGES: Record<BodyRespect, number> = { dismissed: 13, managed: 12, respected: 13 };
const CARE_EFFECTS: HistoryEffect[] = [
  { param: 'autonomy', delta: -5, note: 'きょうだいの世話で、時間が埋まった' },
  { param: 'connection', delta: -5, note: '放課後に、友だちと過ごしにくくなった' },
];
const CARE_AGE = 11;

/** 属性への減点ではなく、0〜15歳に起きた出来事として、はじめのパラメーターの差を出す（P2、付録B-47） */
export function historyOf(p: Profile): HistoryEvent[] {
  return [
    { kind: 'family', id: p.familyStory, age: p.familyAge, effects: FAMILY_EFFECTS[p.familyStory] },
    { kind: 'bodyRespect', id: p.bodyRespect, age: BODY_RESPECT_AGES[p.bodyRespect], effects: BODY_RESPECT_EFFECTS[p.bodyRespect] },
    ...(p.familyCare ? [{ kind: 'care' as const, age: CARE_AGE, effects: CARE_EFFECTS }] : []),
  ];
}

/** 生い立ちで、はじめのパラメーターを変える（初期値 ＋ ledger ＝ params の「初期値」にあたる） */
export function initialOf(base: Params, p: Profile): Params {
  const out = { ...base };
  for (const h of historyOf(p)) for (const e of h.effects) out[e.param] += e.delta;
  return out;
}

/** 家族の歩みの年齢の範囲（付録B-47）。ふたり親の家庭は特定の出来事ではないので、物心がつくころに置く */
const FAMILY_AGE_RANGE: Record<FamilyStory, readonly [number, number]> = {
  divorceMoved: [3, 14],
  divorceRelief: [3, 14],
  unmarried: [0, 0],
  bereaved: [5, 14],
  twoStable: [8, 8],
  twoCold: [8, 8],
  twoTense: [8, 8],
  twoHardship: [8, 8],
};
/** 家族の歩みを画面で選び直したときの年齢 */
export function defaultFamilyAge(s: FamilyStory): number {
  const [lo, hi] = FAMILY_AGE_RANGE[s];
  return Math.floor((lo + hi) / 2);
}

/**
 * ひとり親になった理由の比。S58（母子世帯）の値で、content/stats.yaml の numbers と一致することをテストで確かめる。
 * 物語の中で一緒に暮らす親は母なので、母子世帯の値を使う。
 */
export const SINGLE_PARENT_REASONS = { divorce: 0.795, unmarried: 0.108, bereaved: 0.053 } as const;

/** 家族の歩みを抽選する。ひとり親の家庭の割合とふたり親の内訳は設計値で、ひとり親になった理由だけが統計（S58） */
function pickFamilyStory(u: (key: string) => number): FamilyStory {
  if (u('singleParent') < 0.25) {
    const { divorce, unmarried, bereaved } = SINGLE_PARENT_REASONS;
    const r = u('singleReason') * (divorce + unmarried + bereaved);
    if (r < unmarried) return 'unmarried';
    if (r < unmarried + bereaved) return 'bereaved';
    return u('divorceKind') < 0.5 ? 'divorceMoved' : 'divorceRelief';
  }
  const r = u('twoParents');
  if (r < 0.4) return 'twoStable';
  if (r < 0.6) return 'twoCold';
  if (r < 0.8) return 'twoTense';
  return 'twoHardship';
}

export const NAMES = ['ヒカル', 'マコト', 'チヒロ', 'カオル', 'ミズキ', 'ツカサ'];
export const SKINS = ['#f2c9a8', '#e8b896', '#d9a27f', '#b98258'];
export const HAIRS = ['#1f1f24', '#3a2a22', '#6a4632', '#9c6644'];
export const CLOTHES = ['#4f86c6', '#6b8e4e', '#d9a23b', '#c0563a', '#6b5b95', '#4a5a6a'];
export const HAIR_STYLES = ['short', 'mid', 'bob', 'long', 'tied'] as const;
export const ACCESSORIES = [
  { id: 'glasses', accent: '#3a2f45' },
  { id: 'cap', accent: '#d9a23b' },
  { id: 'headphones', accent: '#c0563a' },
  { id: 'beanie', accent: '#2a7f86' },
] as const;

/**
 * 1周目の主人公を、シードからランダムに決める（付録B-45）。どの家に、どんな自分で生まれるかは選べない。
 * 性自認と好きになる人は、偏りが出ないよう同じ確率にする。家庭の条件の確率も設計値で、現実の割合ではない（画面にもそう書く）。
 */
export function randomProfile(seed: string): Profile {
  const u = (key: string) => uniformFor(`${seed}:profile:${key}`);
  const pick = <T>(key: string, list: readonly T[]): T => list[Math.floor(u(key) * list.length)]!;
  const yes = (key: string, rate: number) => u(key) < rate;
  const gender = pick('gender', GENDERS);
  const body: Body = gender === 'nonbinary' ? pick('body', BODIES) : defaultBody(gender);
  const familyStory = pickFamilyStory(u);
  const [lo, hi] = FAMILY_AGE_RANGE[familyStory];
  const clothes = pick('clothes', CLOTHES);
  const item = yes('hasItem', 0.5) ? pick('item', ACCESSORIES) : undefined;
  return {
    name: pick('name', NAMES),
    gender,
    body,
    attractedTo: pick('attractedTo', ATTRACTIONS),
    familyStory,
    familyAge: lo + Math.floor(u('familyAge') * (hi - lo + 1)),
    bodyRespect: pick('bodyRespect', BODY_RESPECTS),
    familyCare: yes('familyCare', 0.25),
    look: {
      skin: pick('skin', SKINS),
      hair: pick('hair', HAIRS),
      hairStyle: pick('hairStyle', HAIR_STYLES),
      clothes: [clothes, clothes, clothes],
      pants: '#2f3b52',
      ...(item ? { accessory: item.id, accent: item.accent } : {}),
    },
  };
}

/** 妊娠の可能性がある組み合わせか（パートナーのソウは男性、サキは女性という設定） */
export function pregnancyPossible(p: Profile, partnerId: unknown): boolean {
  if (partnerId === 'sou') return p.body === 'canBePregnant';
  if (partnerId === 'saki') return p.body === 'cannot' && (p.gender === 'man' || p.gender === 'transWoman' || p.gender === 'nonbinary');
  return false;
}
