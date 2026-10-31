// 主人公の属性（付録B-43）。プレイヤーが選んで組み立てる。保存は端末の中だけで、外には送らない。
import type { Params } from './types';
import type { Look, ParamKey } from './schema';

import { ATTRACTIONS, BODIES, ECONOMIES, GENDERS } from './profile-values';
export { ATTRACTIONS, BODIES, ECONOMIES, GENDERS };

export type Gender = (typeof GENDERS)[number];
export type Body = (typeof BODIES)[number];
export type Attraction = (typeof ATTRACTIONS)[number];
export type Economy = (typeof ECONOMIES)[number];

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
  look: Look;
}

/** 条件式の up.〇〇 で読める属性 */
export const PROFILE_KEYS = ['gender', 'body', 'attractedTo', 'economy', 'singleParent', 'familyCare', 'witnessedDV', 'talkAboutSex'] as const;

export function upOf(p: Profile): Record<string, unknown> {
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]));
}

/** 性自認に合わせた、からだの初期値。画面で変えられる */
export function defaultBody(g: Gender): Body {
  return g === 'woman' || g === 'transMan' ? 'canBePregnant' : 'cannot';
}

/** 生育条件で、はじめのパラメーターを変える（初期値 ＋ ledger ＝ params の「初期値」にあたる） */
export function initialOf(base: Params, p: Profile): Params {
  const d: Partial<Record<ParamKey, number>> = {};
  const add = (k: ParamKey, v: number) => (d[k] = (d[k] ?? 0) + v);
  if (p.economy === 'hardship') {
    add('living', -20);
    add('options', -15);
  }
  if (p.singleParent) {
    add('living', -5);
    add('options', -5);
  }
  if (p.familyCare) {
    add('options', -5);
    add('connection', -5);
  }
  if (p.witnessedDV) {
    add('safety', -5);
    add('psychSafety', -5);
  }
  if (!p.talkAboutSex) add('autonomy', -5);
  const out = { ...base };
  for (const [k, v] of Object.entries(d)) out[k as ParamKey] += v;
  return out;
}

/** 妊娠の可能性がある組み合わせか（パートナーのソウは男性、サキは女性という設定） */
export function pregnancyPossible(p: Profile, partnerId: unknown): boolean {
  if (partnerId === 'sou') return p.body === 'canBePregnant';
  if (partnerId === 'saki') return p.body === 'cannot' && (p.gender === 'man' || p.gender === 'transWoman' || p.gender === 'nonbinary');
  return false;
}
