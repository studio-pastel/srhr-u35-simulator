// ドメインモデルの型（§5、§6.1）。コンテンツの型は schema.ts から導出する。
export type {
  ParamKey,
  Source,
  CharacterId,
  StatId,
  FlagValue,
  Effect,
  Choice,
  ChanceNode,
  ChanceModifier,
  Scene,
  GameEvent,
  Chapter,
  Character,
  SocialCondition,
  Stat,
  Resource,
  Config,
  Content,
} from './schema';
import type { CharacterId, ParamKey, Source, StatId } from './schema';
import type { Profile } from './profile';

export const PARAM_LABELS: Record<ParamKey, string> = {
  body: 'からだ',
  autonomy: '自己決定',
  connection: 'つながり',
  living: 'くらし',
};

/** 4軸の意味（付録B-47） */
export const PARAM_HINTS: Record<ParamKey, string> = {
  body: '体調はどうか。からだの変化に気づけるか。病院に行きやすいか。',
  autonomy: '知りたいことを知れるか。いくつかの道から、自分で選べるか。',
  connection: '困ったときに話せる人や、いていい場所があるか。',
  living: 'お金と住まいは安定しているか。安心して過ごせるか。時間にゆとりはあるか。',
};

/** ステータスに常に出す、ひとことの意味（付録B-48） */
export const PARAM_SHORT: Record<ParamKey, string> = {
  body: '健康と受診',
  autonomy: '自分で選べる',
  connection: '頼れる人と場',
  living: 'お金と安心',
};

/** 場面が起きた理由の見出し（付録B-48） */
export const TRIGGER_LABELS: Record<'story' | 'profile' | 'choice' | 'chance', string> = {
  story: '物語の決まり',
  profile: 'ランダムな属性',
  choice: 'あなたの選択',
  chance: '偶然',
};

export const SOURCE_LABELS: Record<Source, string> = {
  choice: '選択',
  upbringing: '生育条件',
  society: '社会条件',
  others: '他者の行為',
  chance: '偶然',
};

export type Params = Record<ParamKey, number>;

/** 進行の段階。UI はこれを見て画面を切り替える */
export type Step = 'chapterTop' | 'scene' | 'chance' | 'review' | 'finished';

export interface Position {
  age: number;
  eventId: string;
  sceneId: string;
  step: Step;
  /** 章の events 配列の中の位置 */
  eventIndex: number;
  /** 確率カードの後に進むシーン */
  pendingNext?: string;
  /** 「この章を読まずに進む」または「この場面をとばす」で自動進行している */
  skipping?: boolean;
  /** 「この場面をとばす」で自動進行している（付録B-17） */
  skippingEvent?: boolean;
}

export interface LedgerEntry {
  age: number;
  eventId: string;
  sceneId: string;
  param: ParamKey;
  delta: number;
  source: Source;
  note: string;
  statRef?: StatId;
  /** 読まずに進んだ章で自動選択された効果（付録A-4） */
  skipped?: boolean;
}

/** 人との距離の変化（付録B-9） */
export interface BondEntry {
  age: number;
  eventId: string;
  who: string;
  from: number;
  to: number;
  ended?: boolean;
  note: string;
  skipped?: boolean;
}

export interface AppliedModifier {
  source: Source;
  op: 'set' | 'mul' | 'odds';
  value: number;
  statRef: StatId;
  note: string;
  /** この補正の前後の確率（確率カードで「何%から何%に」を出す） */
  from: number;
  to: number;
}

export interface ChanceLogEntry {
  nodeId: string;
  label: string;
  age: number;
  eventId: string;
  base: number;
  baseStatRef: StatId;
  modifiersApplied: AppliedModifier[];
  finalP: number;
  u: number;
  happened: boolean;
  actorLabel?: string;
}

export type ReplayChange = 'profile' | { condition: string; from: string; to: string };

export interface RunState {
  /** 7：パラメーターの4軸統合と生い立ち（付録B-47）。古い保存データは読み込まない */
  version: 7;
  runId: string;
  seed: string;
  protagonist: CharacterId;
  conditions: Record<string, string>;
  flags: Record<string, unknown>;
  /** 内部値。0〜100 に丸めない（§6.3） */
  params: Params;
  ledger: LedgerEntry[];
  chanceLog: ChanceLogEntry[];
  position: Position;
  completedEvents: string[];
  /** 選んだ選択肢（`イベントID/シーンID` → 選択肢ID）。主人公以外の視点や自動選択も含む */
  choices: Record<string, string>;
  skippedChapters: number[];
  /** 「この場面をとばす」を使ったイベント（付録B-17） */
  skippedEvents: string[];
  /** 主人公の属性（付録B-43） */
  profile: Profile;
  /** はじめのパラメーター（属性で変わる） */
  initial: Params;
  /** 人との距離（付録B-9）。いまの近さ（0〜3）と、関係が終わったか */
  bonds: Record<string, { level: number; ended?: boolean }>;
  bondLog: BondEntry[];
  replayOf?: { runId: string; changed: ReplayChange; sameSeed: boolean };
}
