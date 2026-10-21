// コンテンツ（content/*.yaml）の zod スキーマ。ビルド時の検証とテストで共有する（§2.2）。
import { z } from 'zod';

import { AGES, CHARACTER_IDS, EFFECT_SIZES, PARAM_KEYS, SOURCES } from './constants';
export { AGES, CHARACTER_IDS, EFFECT_SIZES, PARAM_KEYS, SOURCES };

const ident = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, '英字で始まる英数字と _ だけを使う');
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, '英数字・-・_ だけを使う');
export const statIdSchema = z.string().regex(/^S\d{2}$/, '統計IDは S01 の形式');
const paramKey = z.enum(PARAM_KEYS);
const source = z.enum(SOURCES);
const characterId = z.enum(CHARACTER_IDS);
const flagValue = z.union([z.string(), z.boolean(), z.number()]);
const flagMap = z.record(ident, flagValue);

export const effectSchema = z.strictObject({
  param: paramKey,
  sign: z.union([z.literal(1), z.literal(-1)]),
  size: z.enum(EFFECT_SIZES),
  source,
  when: z.string().optional(),
  note: z.string().min(1),
  statRef: statIdSchema.optional(),
});

/** 確率ノードの結果効果。source は省略可（省略時は chance）。chance 以外は検証で落とす（§6.4-3） */
export const chanceEffectSchema = effectSchema.extend({ source: source.optional() });

export const choiceSchema = z.strictObject({
  id,
  label: z.string().min(1),
  neutral: z.boolean().optional(),
  canonical: z.boolean().optional(),
  requires: z.string().optional(),
  effects: z.array(effectSchema).default([]),
  setFlags: flagMap.optional(),
  next: z.string().min(1),
});

const outcomeSchema = z.strictObject({
  effects: z.array(chanceEffectSchema).default([]),
  setFlags: flagMap.optional(),
  next: z.string().min(1),
});

export const chanceModifierSchema = z.strictObject({
  when: z.string(),
  op: z.enum(['set', 'mul']),
  value: z.number().min(0),
  source: z.enum(['choice', 'upbringing', 'society', 'others']),
  statRef: statIdSchema,
  note: z.string().min(1),
});

export const chanceNodeSchema = z.strictObject({
  id,
  label: z.string().min(1),
  base: z.strictObject({ value: z.number().min(0).max(1), statRef: statIdSchema }),
  modifiers: z.array(chanceModifierSchema).default([]),
  outcomes: z.strictObject({ happens: outcomeSchema, notHappens: outcomeSchema }),
  actorLabel: z.string().optional(),
});

export const FACES = ['normal', 'smile', 'anxious', 'sad', 'relieved'] as const;
export const PLACES = ['classroom', 'nurse', 'hallway', 'bedroom', 'living', 'campus', 'station', 'office', 'clinic', 'home2', 'gate'] as const;
export const TIMES = ['day', 'dusk', 'night'] as const;
// fade は暗転（付録B-30）。画面を暗くして、地の文を1行だけ出す
export const LINE_KINDS = ['say', 'inner', 'message', 'narration', 'fade'] as const;

/** 会話の1行（付録B-2）。who は登場人物のID（cast.yaml）か narration */
export const lineSchema = z.strictObject({
  who: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(LINE_KINDS).optional(),
  face: z.enum(FACES).optional(),
});

/** 場面の舞台（付録B-1）。cast は画面に描く人物（左から順） */
export const stageSchema = z.strictObject({
  place: z.enum(PLACES),
  time: z.enum(TIMES).default('day'),
  cast: z
    .array(
      z.strictObject({
        id: z.string(),
        x: z.number().optional(),
        face: z.enum(FACES).optional(),
        pose: z.enum(['stand', 'phone']).optional(),
        /** この条件を満たすときだけ描く（例：ケイが父親になったときだけ子どもを描く） */
        when: z.string().optional(),
      }),
    )
    .default([]),
});

/** 選択肢のない分岐（付録A-1）。上から順に評価し、最初に当てはまった next に進む */
const branchSchema = z.strictObject({ when: z.string(), next: z.string().min(1) });

export const sceneSchema = z.strictObject({
  id,
  viewpoint: characterId.optional(),
  speaker: z.string().optional(),
  /** 旧形式の地の文。新形式では lines を使う（どちらか一方は必須。検証で確認） */
  text: z.string().min(1).optional(),
  /** 会話の吹き出し（付録B-2） */
  lines: z.array(lineSchema).optional(),
  /** この場面の舞台。省略時はイベントの stage */
  stage: stageSchema.optional(),
  choices: z.array(choiceSchema).optional(),
  chance: chanceNodeSchema.optional(),
  branches: z.array(branchSchema).optional(),
  /** シーンに入ったときに適用する効果（付録A-15）。選択と関係なく起きる変化に使う。source に choice は使えない */
  effects: z.array(effectSchema).optional(),
  next: z.string().optional(),
});

export const eventSchema = z.strictObject({
  id: z.string().regex(/^E\d{2}-[A-Z0-9-]+$/, 'イベントIDは E16-ALL-SEXED の形式'),
  age: z.number().refine((a) => (AGES as readonly number[]).includes(a), '年齢は 16/17/19/21/24/27/30/35 のどれか'),
  characters: z.array(characterId).min(1),
  kind: z.enum(['fixed', 'chance', 'branch']),
  domains: z.array(z.string()),
  requires: z.string().optional(),
  triggerWarning: z.string().optional(),
  /** 視点切替（付録A-2）。entry は各視点のシーン列の入口 */
  viewpointSwitch: z
    .strictObject({ from: characterId, to: characterId, entry: z.partialRecord(characterId, z.string()) })
    .optional(),
  statCard: z.array(statIdSchema).optional(),
  /** イベント後に出す相談窓口のタグ（§10.6、付録A-8）。violence があると、場面のあとに支援カードを出す（付録B-20） */
  resources: z.array(z.string()).optional(),
  /** 支援カードに出す窓口の ID（2つほど）。省略時は resources のタグに当たる最初の2つ */
  support: z.array(z.string()).optional(),
  /** イベント開始時に、社会条件の選択肢の setFlags を反映する（付録A-5） */
  applyConditionFlags: z.array(z.string()).optional(),
  /** イベントの舞台（付録B-1） */
  stage: stageSchema.optional(),
  /** 「この場面をとばす」を使ったときに出す、起きたことの1行（付録B-17） */
  summary: z.string().optional(),
  scenes: z.array(sceneSchema).min(1),
  status: z.enum(['draft', 'reviewed']),
});

export const chapterSchema = z.strictObject({
  age: z.number().int(),
  title: z.string().min(1),
  season: z.string().min(1),
  status: z.enum(['draft', 'reviewed']),
  /** 章トップに出す主人公ごとの状況 */
  intro: z.partialRecord(characterId, z.string()),
  events: z.array(eventSchema),
});

const paramRecord = z.strictObject({
  body: z.number(),
  safety: z.number(),
  psychSafety: z.number(),
  options: z.number(),
  connection: z.number(),
  autonomy: z.number(),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** 登場人物の見た目（付録B-1・B-5）。主人公4人と脇役。色や髪型はパステルが選ぶ */
export const castSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  name: z.string().min(1),
  role: z.string().optional(),
  /** 脇役の年齢（見た目の計算に使う）。主人公は周回の年齢を使う */
  age: z.number().optional(),
  /** 主人公と同じ年ごろの人物（パートナーなど）。周回の年齢＋この差で描く */
  peerOffset: z.number().optional(),
  /** 主人公が何歳のときに生まれた子どもか。周回の年齢から計算して描く */
  bornAt: z.number().optional(),
  look: z.strictObject({
    skin: hex,
    hair: hex,
    hairStyle: z.enum(['short', 'mid', 'bob', 'long', 'tied']),
    clothes: z.tuple([hex, hex, hex]),
    pants: hex,
  }),
});

export const characterSchema = z.strictObject({
  id: characterId,
  name: z.string().min(1),
  profile: z.string().min(1),
  upbringingSummary: z.string().min(1),
  upbringing: z.record(ident, z.union([z.string(), z.boolean()])),
  initial: paramRecord,
  statRefs: z.array(statIdSchema),
  canonical: z.boolean(),
});

export const conditionSchema = z.strictObject({
  id: ident,
  label: z.string().min(1),
  description: z.string().optional(),
  options: z
    .array(
      z.strictObject({
        id: ident,
        label: z.string().min(1),
        statRefs: z.array(statIdSchema),
        verified: z.boolean(),
        setFlags: flagMap.optional(),
      }),
    )
    .min(2),
  /** null は既定値が TBD（§15）。その条件は未設定として扱う */
  defaultOption: z.string().nullable(),
  affects: z.array(characterId),
});

export const statSchema = z.strictObject({
  id: statIdSchema,
  label: z.string().min(1),
  value: z.string().min(1),
  /** 統計カードに出す文（§11-7、付録A-10）。数字は value・definition・label にあるものだけ */
  cardText: z.string().min(1),
  numbers: z.record(z.string(), z.number()).optional(),
  definition: z.string(),
  source: z.strictObject({
    title: z.string().min(1),
    url: z.url(),
    year: z.string().min(1),
    additional: z.array(z.strictObject({ title: z.string().min(1), url: z.url() })).optional(),
  }),
  verified: z.boolean(),
  jpData: z.boolean(),
});

export const RESOURCE_CATEGORIES = ['body', 'pregnancy', 'testing', 'identity', 'relationship', 'harm', 'mind', 'family'] as const;

export const resourceSchema = z.strictObject({
  id,
  name: z.string().min(1),
  contact: z.string().min(1),
  /** tel: リンクに使う番号（ハイフンなし。# を含めてよい） */
  tel: z.string().regex(/^[0-9#]+$/).optional(),
  /** null は TBD（§15 T11）。リンクなしで名称だけ表示する */
  url: z.url().nullable(),
  target: z.string().min(1),
  checkedAt: z.strictObject({ title: z.string(), url: z.url() }).nullable(),
  tags: z.array(z.string()),
  /** 「話せる場所」のカテゴリ（付録B-19）。複数に載せてよい */
  categories: z.array(z.enum(RESOURCE_CATEGORIES)).min(1),
  /** 対象が限られる場合のラベル（例：「対象：女性」「18歳まで」） */
  audience: z.string().optional(),
  /** 地域ごとの窓口（例：「東京都」） */
  region: z.string().optional(),
  /** 公式ページで確認済みか（付録B-21） */
  verified: z.boolean(),
});

export const configSchema = z.strictObject({
  siteName: z.string().min(1),
  publisher: z.string().min(1),
  exitUrl: z.url(),
  effectSize: z.strictObject({ S: z.number(), M: z.number(), L: z.number() }),
  /** 相談窓口のタグの表示名 */
  resourceTags: z.record(z.string(), z.string()),
});

export const contentSchema = z.strictObject({
  config: configSchema,
  characters: z.array(characterSchema),
  conditions: z.array(conditionSchema),
  stats: z.array(statSchema),
  resources: z.array(resourceSchema),
  cast: z.array(castSchema),
  chapters: z.array(chapterSchema),
});

export type ParamKey = (typeof PARAM_KEYS)[number];
export type Source = (typeof SOURCES)[number];
export type CharacterId = (typeof CHARACTER_IDS)[number];
export type StatId = string;
export type FlagValue = z.infer<typeof flagValue>;
export type Effect = z.infer<typeof effectSchema>;
export type ChanceEffect = z.infer<typeof chanceEffectSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type ChanceNode = z.infer<typeof chanceNodeSchema>;
export type ChanceModifier = z.infer<typeof chanceModifierSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type GameEvent = z.infer<typeof eventSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type Character = z.infer<typeof characterSchema>;
export type SocialCondition = z.infer<typeof conditionSchema>;
export type Stat = z.infer<typeof statSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Config = z.infer<typeof configSchema>;
export type Content = z.infer<typeof contentSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type CastMember = z.infer<typeof castSchema>;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
