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
  safety: '安全',
  psychSafety: '心理的安全',
  options: '選択肢の幅',
  connection: 'つながり',
  autonomy: '自己決定',
  living: 'くらし',
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
  /** 6：主人公1人と属性（profile）に変更。古い保存データは読み込まない */
  version: 6;
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
