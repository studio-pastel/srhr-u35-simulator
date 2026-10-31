// 主人公の属性（付録B-43・B-45）。1周目はランダムに決まり、2周目で変えて比べられる。保存は端末の中だけで、外には送らない。
import type { Params } from './types';
import type { Look, ParamKey } from './schema';
import { uniformFor } from './rng';
import { ATTRACTIONS, BODIES, ECONOMIES, GENDERS, LIKES } from './profile-values';
export { ATTRACTIONS, BODIES, ECONOMIES, GENDERS, LIKES };

export type Gender = (typeof GENDERS)[number];
export type Body = (typeof BODIES)[number];
export type Attraction = (typeof ATTRACTIONS)[number];
export type Economy = (typeof ECONOMIES)[number];
export type Like = (typeof LIKES)[number];

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
  economy: Economy;
  singleParent: boolean;
  familyCare: boolean;
  witnessedDV: boolean;
  talkAboutSex: boolean;
  /** 8歳のころに夢中になったもの。プロローグで選ぶ。パラメーターには関わらない */
  likes?: Like;
  look: Look;
}

/** 条件式の up.〇〇 で読める属性 */
export const PROFILE_KEYS = ['gender', 'body', 'attractedTo', 'economy', 'singleParent', 'familyCare', 'witnessedDV', 'talkAboutSex', 'likes'] as const;

export function upOf(p: Profile): Record<string, unknown> {
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]));
}

/** 性自認に合わせた、からだの初期値。画面で変えられる */
export function defaultBody(g: Gender): Body {
  return g === 'woman' || g === 'transMan' ? 'canBePregnant' : 'cannot';
}

/** 生育条件による、はじめのパラメーターの差と、その理由（P2） */
export function initialReasons(p: Profile): { param: ParamKey; delta: number; note: string }[] {
  const out: { param: ParamKey; delta: number; note: string }[] = [];
  const add = (param: ParamKey, delta: number, note: string) => out.push({ param, delta, note });
  if (p.economy === 'hardship') {
    add('living', -20, '家計が苦しい');
    add('options', -15, '家計が苦しい');
  }
  if (p.singleParent) {
    add('living', -5, 'ひとり親の家庭');
    add('options', -5, 'ひとり親の家庭');
  }
  if (p.familyCare) {
    add('options', -5, 'きょうだいの世話');
    add('connection', -5, 'きょうだいの世話');
  }
  if (p.witnessedDV) {
    add('safety', -5, '親のあいだの暴力を見て育った');
    add('psychSafety', -5, '親のあいだの暴力を見て育った');
  }
  if (!p.talkAboutSex) add('autonomy', -5, '家で性やからだの話ができない');
  return out;
}

/** 生育条件で、はじめのパラメーターを変える（初期値 ＋ ledger ＝ params の「初期値」にあたる） */
export function initialOf(base: Params, p: Profile): Params {
  const out = { ...base };
  for (const r of initialReasons(p)) out[r.param] += r.delta;
  return out;
}

export const NAMES = ['アオ', 'リン', 'カナタ', 'ヒカル', 'ナギ', 'マコト'];
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
  const singleParent = yes('singleParent', 0.25);
  const clothes = pick('clothes', CLOTHES);
  const item = yes('hasItem', 0.5) ? pick('item', ACCESSORIES) : undefined;
  return {
    name: pick('name', NAMES),
    gender,
    body,
    attractedTo: pick('attractedTo', ATTRACTIONS),
    economy: yes('hardship', 0.25) ? 'hardship' : 'middle',
    singleParent,
    familyCare: yes('familyCare', 0.25),
    // 暴力の場面は同居する父親を描くため、ひとり親の家庭とは重ねない
    witnessedDV: !singleParent && yes('witnessedDV', 0.25),
    talkAboutSex: yes('talkAboutSex', 0.5),
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
