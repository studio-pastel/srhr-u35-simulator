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

export const PARAM_LABELS: Record<ParamKey, string> = {
  body: 'からだ',
  safety: '安全',
  psychSafety: '心理的安全',
  options: '選択肢の幅',
  connection: 'つながり',
  autonomy: '自己決定',
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
export type Step = 'chapterTop' | 'scene' | 'chance' | 'statCards' | 'review' | 'finished';

export interface Position {
  age: number;
  eventId: string;
  sceneId: string;
  viewpoint: CharacterId;
  step: Step;
  /** 章の events 配列の中の位置 */
  eventIndex: number;
  /** 視点切替イベントで、各視点のシーン列がどこまで進んだか */
  tracks?: Partial<Record<CharacterId, string>>;
  /** 読み終えた視点 */
  tracksDone?: Partial<Record<CharacterId, boolean>>;
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

export interface AppliedModifier {
  source: Source;
  op: 'set' | 'mul';
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
  /** 主人公以外の視点で解決した（効果は付かない） */
  offTrack?: boolean;
}

export type ReplayChange = 'protagonist' | { condition: string; from: string; to: string };

export interface RunState {
  /** 4：とばしたイベント（skippedEvents）を追加。古い保存データは読み込まない */
  version: 4;
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
  /** 標準ルートの計算用：この選択を canonical より優先する（付録A-19） */
  pinnedChoices?: Record<string, string>;
  skippedChapters: number[];
  /** 「この場面をとばす」を使ったイベント（付録B-17） */
  skippedEvents: string[];
  avatarSalts: Record<CharacterId, number>;
  replayOf?: { runId: string; changed: ReplayChange; sameSeed: boolean };
}
