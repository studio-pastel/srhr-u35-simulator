# SRHR教育シミュレーション 実装仕様書 v1.0

対象読者：Claude Code（実装担当）
作成日：2026-10-20
発注：一般社団法人SRHR Japan
設計書：「SRHR教育シミュレーション シナリオ設計書 v0.1」（本仕様書と食い違う場合は本仕様書を優先する）

---

## 0. この仕様書の使い方

- この仕様書はリポジトリ直下に `SPEC.md` として置く。`CLAUDE.md` から参照すること。
- **「TBD」と書かれた値は推測で埋めない。** config の定数か、content の `verified: false` で仮置きし、§15 の一覧に残す。
- 統計値は §10.5 の表にあるものだけを使う。表にない数値を本文・確率・統計カードに書かない。
- シナリオ本文は §11 の執筆ルールに従う。Claude Code が書いた本文はすべて `status: draft` とする。
- 作業は §14 のフェーズ順に進める。各フェーズの完了条件を満たしてから次へ進む。

---

## 1. 概要

16歳から35歳までの人生を、同じ高校の同級生4人の群像劇として体験する、ストーリー型の教育シミュレーション。
WHO「Preconception care」介入パッケージ（2013）と、UNESCO他「国際セクシュアリティ教育ガイダンス（ITGSE）」改訂版（2018）に準拠する。

プレイヤーは4人から1人を選び、8つの章（16／17／19／21／24／27／30／35歳）で選択を重ねる。
選択の結果は5つのパラメーターに反映され、その変化を **選択・生育条件・社会条件・偶然** の4つの要因に分解して表示する。

2周目では、別の主人公を選ぶか、同じ主人公で社会条件を1つだけ切り替えられる。
社会条件を切り替える場合は同じ乱数シードを使い、偶然を固定したうえで、条件の違いだけを比べられるようにする。

### 1.1 設計原則（実装上の制約として扱う）

| # | 原則 | 実装上の意味 |
| --- | --- | --- |
| P1 | 到達点を設けない | 総合スコア・ランク・ゲームオーバー・「良いエンディング」の判定を実装しない。妊娠・出産をプラスの結末として扱わない |
| P2 | 自己責任論にしない | すべてのパラメーター変化に要因（source）を付ける。要因のない変化は検証で落とす |
| P3 | 統計で決める | 確率は §10.5 の統計IDに紐づける。統計IDのない確率はビルドで落とす |
| P4 | 被害を描くが再現しない | 暴力の行為そのものを描写しない。該当章の前にトリガー注意を出し、章をスキップできるようにする |
| P5 | 見られても安全 | クイック退出、個人データ非収集、既定では進行状況をタブを閉じると消える領域に保存する |
| P6 | 多様性を前提にする | どの属性も「問題」として描かない。「どちらも正解」の選択肢には負の効果を付けない |
| P7 | 被害者の選択で加害が止まる設計にしない | ミナミ側の選択は、ハルトの行動（止まる／続く）に影響させない |

---

## 2. 確定事項と既定値

### 2.1 確定事項（発注者が決定済み）

| 項目 | 内容 |
| --- | --- |
| 公開主体 | 一般社団法人SRHR Japan。教育用の無料サイト |
| 公開先 | `srhr.jp` のサブドメイン（名称はTBD） |
| サーバー | さくらインターネット（`srhr.jp` と同じレンタルサーバー）。静的ファイルのみ（サーバーサイド処理なし）。2026-10-20 にエックスサーバーから変更（付録A-9） |
| 対象 | 高校生以上 |
| 言語 | 日本語のみ |
| 主人公 | 4人の群像劇。ミナミとハルトはDVの章（17歳・19歳）で視点を切り替えられる |
| 章 | 16／17／19／21／24／27／30／35歳の8章 |
| パラメーター | からだ／自己決定／つながり／くらし（0〜100）。2026-11-01 に4軸へ統合（付録B-47） |
| 要因分解 | 選択／生育条件／社会条件／他者の行為／偶然の5要因。偶然は明示的に表示する。他者の行為は 2026-10-20 に追加（付録A-14） |
| 比較 | タイムライン＋パラメーターは必須。リプレイ比較と要因分解を組み合わせる |
| 監修 | 当面なし。公開前に医療・DV支援の監修を入れる |
| 教員向け指導案 | 作らない |

### 2.2 既定値（仕様書作成時に置いたもの。発注者の確認で変わり得る）

| 項目 | 既定値 | 理由 |
| --- | --- | --- |
| 技術スタック | Vite + TypeScript（strict）+ Preact | 静的出力、軽量、型でコンテンツを検証できる |
| ルーティング | ハッシュルーティング（`#/...`） | サーバーで rewrite 設定が不要 |
| コンテンツ形式 | YAML（ビルド時にJSON化） | 編集担当が直接書ける |
| スキーマ検証 | zod | ビルド時とテストで同じスキーマを使う |
| テスト | Vitest（単体・コンテンツ検証）、Playwright（E2E、フェーズ3） | |
| CSS | プレーンCSS＋カスタムプロパティ | 外部依存を増やさない |
| フォント | システムフォントのみ | 実行時に外部へ通信しない（P5） |
| 進行状況の保存 | 既定は `sessionStorage`。利用者が選んだ場合だけ `localStorage` | 端末を他人に見られるリスクを下げる（P5） |
| パラメーター変動幅 | S=5、M=10、L=20 | 監修で調整する前提の暫定値 |

---

## 3. 技術要件

- Node.js LTS、パッケージマネージャは npm。
- `npm run build` で `dist/` に静的ファイル一式を出力する。`dist/` をサーバーの公開ディレクトリにそのまま置けば動くこと。
- 実行時の外部通信はゼロ。CDN、Webフォント、解析タグ、エラートラッキングを入れない。
- Cookie を使わない。
- ブラウザ対応：iOS Safari・Android Chrome・デスクトップの Chrome／Edge／Safari／Firefox の、それぞれ直近2メジャーバージョン。
- モバイル優先。幅 360px で横スクロールが出ないこと。
- `prefers-color-scheme`（ダークモード）と `prefers-reduced-motion` に対応する。
- ストレージへの読み書きはすべて try/catch で包み、使えない環境でも最後まで遊べること。

---

## 4. ディレクトリ構成

```
/
├─ SPEC.md
├─ CLAUDE.md
├─ index.html
├─ public/
│  └─ .htaccess              # §13.2
├─ content/                  # 編集担当が触る領域
│  ├─ config.yaml            # 変動幅、退出先URLなど
│  ├─ characters.yaml
│  ├─ conditions.yaml        # 社会条件
│  ├─ stats.yaml             # 統計 S01〜S27
│  ├─ resources.yaml         # 相談窓口
│  └─ chapters/
│     ├─ 16.yaml
│     ├─ 17.yaml
│     ├─ 19.yaml
│     ├─ 21.yaml
│     ├─ 24.yaml
│     ├─ 27.yaml
│     ├─ 30.yaml
│     └─ 35.yaml
├─ src/
│  ├─ engine/                # UI非依存の純粋ロジック
│  │  ├─ types.ts
│  │  ├─ schema.ts           # zod スキーマ（content と共有）
│  │  ├─ rng.ts              # シード付き乱数
│  │  ├─ flags.ts            # 条件式の評価
│  │  ├─ effects.ts          # 効果の適用と要因分解
│  │  ├─ chance.ts           # 確率イベント
│  │  ├─ progression.ts      # 章・イベント・シーンの進行
│  │  ├─ replay.ts           # 2周目・比較
│  │  └─ storage.ts
│  ├─ ui/
│  │  ├─ screens/            # §7 の各画面
│  │  ├─ components/
│  │  └─ styles/
│  └─ main.tsx
├─ scripts/
│  └─ validate-content.ts    # §12.1
└─ tests/
   ├─ engine/
   ├─ content/
   └─ e2e/
```

---

## 5. ドメインモデル

以下は型の仕様である。実装時は `src/engine/types.ts` と `schema.ts` に落とすこと。

```ts
type ParamKey = 'body' | 'safety' | 'options' | 'connection' | 'autonomy';
// 表示名：からだ／安全／選択肢の幅／つながり／自己決定

type Source = 'choice' | 'upbringing' | 'society' | 'chance';
// 表示名：選択／生育条件／社会条件／偶然

type EffectSize = 'S' | 'M' | 'L';   // config.yaml で数値に変換

type CharacterId = 'minami' | 'haruto' | 'yu' | 'kei';

interface Effect {
  param: ParamKey;
  sign: 1 | -1;
  size: EffectSize;
  source: Source;
  when?: FlagExpr;        // 条件付き効果（生育条件・社会条件の補正に使う）
  note: string;           // 要因分解の画面に出す短い理由（20字以内）
  statRef?: StatId;       // 生育・社会の補正に根拠がある場合
}

interface Character {
  id: CharacterId;
  name: string;
  profile: string;                         // 性別・性のあり方を本人の言葉で
  upbringing: Record<string, string | boolean>;   // 例 { economy: 'hardship', familyCare: true }
  initial: Record<ParamKey, number>;
  statRefs: StatId[];
  canonical: boolean;   // 他の主人公のプレイ中に、この人物の標準ルートを使うか
}

interface SocialCondition {
  id: string;                      // 例 'sexEducation'
  label: string;
  options: { id: string; label: string; statRefs: StatId[]; verified: boolean }[];
  defaultOption: string;
  affects: CharacterId[];          // 2周目でこの条件を切り替えられる主人公
}

interface GameEvent {
  id: string;                      // 例 'E19-KS-CONTRACEPTION'
  age: 16 | 17 | 19 | 21 | 24 | 27 | 30 | 35;
  characters: CharacterId[];       // このイベントをプレイできる主人公
  kind: 'fixed' | 'chance' | 'branch';
  domains: string[];               // WHO/ITGSE の領域名
  requires?: FlagExpr;             // 発生条件（ルート分岐）
  triggerWarning?: string;         // 指定時は章の前に注意を表示
  viewpointSwitch?: { from: CharacterId; to: CharacterId };
  statCard?: StatId[];             // イベント後に出す統計カード
  scenes: Scene[];
  status: 'draft' | 'reviewed';
}

interface Scene {
  id: string;
  viewpoint?: CharacterId;
  speaker?: string;
  text: string;                    // ルビ記法 {漢字|かんじ} を使える
  choices?: Choice[];
  chance?: ChanceNode;
  next?: string;                   // 選択肢がない場合の次シーン。'END' でイベント終了
}

interface Choice {
  id: string;
  label: string;
  neutral?: boolean;               // 「どちらも正解」。true なら負の効果を禁止（§12.1）
  canonical?: boolean;             // NPC として進むときに使う選択
  requires?: FlagExpr;             // 表示条件
  effects: Effect[];
  setFlags?: Record<string, string | boolean | number>;
  next: string;
}

interface ChanceNode {
  id: string;                      // 乱数の固定に使う。全体で一意
  label: string;                   // 画面表示用：何が起きるかの確率か
  base: { value: number; statRef: StatId };
  modifiers: ChanceModifier[];
  outcomes: {
    happens: { effects: Effect[]; setFlags?: Record<string, unknown>; next: string };
    notHappens: { effects: Effect[]; setFlags?: Record<string, unknown>; next: string };
  };
  actorLabel?: string;             // 他者の決定を統計で表す場合の表記。例「サキの決定」
}

interface ChanceModifier {
  when: FlagExpr;
  op: 'set' | 'mul';
  value: number;
  source: Exclude<Source, 'chance'>;   // 確率を変えた要因
  statRef: StatId;                      // 統計のない補正は禁止
  note: string;
}

interface Stat {
  id: StatId;                      // 'S01'〜
  label: string;
  value: string;                   // 表示用の文
  numbers?: Record<string, number>;// 確率計算に使う値
  definition: string;
  source: { title: string; url: string; year: string };
  verified: boolean;               // false = 二次資料など、原典で未確認
  jpData: boolean;                 // false = 日本以外のデータ
}

type FlagExpr = string;            // §6.6 の式
type StatId = `S${string}`;
```

---

## 6. エンジン仕様

### 6.1 状態

```ts
interface RunState {
  runId: string;
  seed: string;                    // 32文字の16進
  protagonist: CharacterId;
  conditions: Record<string, string>;      // 社会条件の選択値
  flags: Record<string, unknown>;
  params: Record<ParamKey, number>;        // 内部値。0〜100 に丸めない
  ledger: LedgerEntry[];                   // 全効果の記録（要因分解の元データ）
  chanceLog: ChanceLogEntry[];
  position: { age: number; eventId: string; sceneId: string; viewpoint: CharacterId };
  completedEvents: string[];
  avatarSalts: Record<CharacterId, number>;   // §16.3。初期値はすべて0
  replayOf?: { runId: string; changed: 'protagonist' | { condition: string; from: string; to: string }; sameSeed: boolean };
}

interface LedgerEntry {
  age: number; eventId: string; sceneId: string;
  param: ParamKey; delta: number; source: Source; note: string; statRef?: StatId;
}

interface ChanceLogEntry {
  nodeId: string; age: number;
  base: number; modifiersApplied: { source: Source; op: string; value: number; statRef: StatId; note: string }[];
  finalP: number; u: number; happened: boolean; actorLabel?: string;
}
```

### 6.2 進行

1. 主人公を選ぶと、その人物の `initial` を `params` に入れる。初期値は要因分解の対象外（ゼロ点）とする。
2. 章は年齢順に進む。各章で、`characters` に主人公を含み、かつ `requires` を満たすイベントを、YAMLに書かれた順に実行する。
3. 章の開始時、その章に `triggerWarning` を持つイベントがあれば注意画面を出す。「この章を読まずに進む」を選んだ場合は、各選択で `canonical: true` の選択肢を自動で選んだものとして処理する。このとき、要因は `choice` ではなく本来の要因のまま記録し、画面に「読まずに進んだ章」と表示する。
4. 章の最後に「ふりかえり」画面（§7.7）を出す。
5. 35歳の章が終わったら、全体のふりかえり（§7.8）に進む。

### 6.3 効果の適用と要因分解

- `delta = sign × config.effectSize[size]`。
- 効果を適用するたびに、`ledger` に1行追加する。`when` を満たさない効果は記録しない。
- 内部値 `params` は上下限なしで加算する。表示する値だけ 0〜100 に丸め、丸めが起きたパラメーターには「上限／下限に達しています」と表示する。
- **不変条件：** どの時点でも、各パラメーターについて「初期値 ＋ ledger の delta の合計 ＝ params の内部値」が成り立つこと。テストで保証する。
- 要因分解は、ledger を `source` ごとに合計して求める。章単位と全体の両方で出す。

### 6.4 確率イベント（偶然の明示）

1. 確率は `base.value` から始め、`modifiers` を順に適用する。`set` は値を置き換え、`mul` は掛け算する。結果は 0〜1 に丸める。
2. 乱数 `u` は §6.5 の方法で `ChanceNode.id` ごとに決める。`u < finalP` なら `happens`、そうでなければ `notHappens`。
3. `happens` と `notHappens` の効果は、YAML の記述に関係なく **source を `chance` として記録する**（スキーマで強制する）。
4. 確率を変えた要因（生育・社会・選択）は、`chanceLog.modifiersApplied` に記録し、確率カード（§7.5）に表示する。
5. `actorLabel` があるノードは、他の登場人物の決定を統計で表したものとして扱う。確率カードでは「偶然」ではなく「〇〇の決定（統計にもとづく）」と表示する。要因分解では `chance` に含め、凡例に注記を出す。

### 6.5 乱数とリプレイ

- 周回の開始時に `crypto.getRandomValues` で `seed` を作る。
- 各確率ノードの `u` は、`hash(seed + ':' + nodeId)` を [0,1) の一様乱数に変換して求める。ハッシュは決定的なものを使う（例：cyrb128 + mulberry32）。
- この方式のため、前の章の選択を変えても後の章の `u` はずれない。同じシードで社会条件だけを変えると、`finalP` が変わった確率ノードだけで結果が変わり得る。
- 2周目の開始時に、次のどちらかを選ばせる。
  - 「同じ偶然で、条件だけ変える」→ `seed` を引き継ぐ（`sameSeed: true`）
  - 「偶然も変える」→ 新しい `seed` を作る

### 6.6 条件式（FlagExpr）

- 使える要素：`flags.<名前>`、`cond.<社会条件id>`、`up.<生育条件キー>`、`char` = 主人公ID、`==`、`!=`、`&&`、`||`、`!`、括弧、文字列・真偽値・数値のリテラル。
- 例：`cond.sexEducation == 'taught' || flags.searchedWithdrawal == true`
- `eval` や `Function` は使わない。小さな構文解析器を自作する。ビルド時にすべての式を構文検査する。

### 6.7 視点切替（E17-MH-CONTROL、E19-MH-ESCALATE）

- これらのイベントでは、画面上部に「ミナミの視点／ハルトの視点」の切替を出す。
- ミナミを主人公にした場合、ハルトの視点のシーンは読めるが、パラメーターはミナミのものだけが動く。ハルトの選択は `flags.harutoRoute`（`'stopped'` か `'continued'`）を決める。
- ハルトを主人公にした場合は逆になる。ミナミの視点のシーンは読めるが、パラメーターはハルトのものだけが動く。
- **P7：** `flags.harutoRoute` を決めるのは、ハルトの視点での選択だけとする。ミナミの視点の選択からこのフラグを書き換えることをスキーマで禁止する。ミナミのプレイで視点を切り替えなかった場合は、ハルトの `canonical` の選択を使う。

### 6.8 他の主人公の扱い（群像劇）

- 主人公以外の3人は、`canonical: true` の選択肢で進む標準ルートを持つ。確率ノードは、プレイ中の周回と同じ `seed` で解決する。
- 全体のふりかえり（§7.8）では、主人公の軌跡と、他の3人の標準ルートの軌跡を並べて表示する。
- 標準ルートの計算は、プレイ開始時に裏で一括して実行する。この計算は乱数を消費しない（§6.5 の方式のため）。

### 6.9 保存

- 既定：`sessionStorage`（タブを閉じると消える）。
- 設定画面で「この端末に保存して、あとで続きから遊ぶ」をオンにした場合だけ `localStorage` に保存する。オンにするときは、端末を他の人が見る可能性について一文で注意を出す。
- 「保存したデータを消す」ボタンを設定画面に置く。
- 保存するのは `RunState` と完了した周回の要約だけとする。氏名・年齢などの個人情報は入力させない。

---

## 7. 画面仕様

すべての画面に共通の要素を置く。
- 右上に「すぐに閉じる」ボタンを常に固定表示する（§8.1）。
- フッターに「相談窓口」へのリンクを置く。
- 本文には文字サイズ切替（標準／大）とルビ切替（あり／なし）を付ける。

| # | 画面 | 主な内容 |
| --- | --- | --- |
| 7.1 | はじめに | サイトの目的、扱う内容（性・妊娠・暴力を含む）、保存の方法、「すぐに閉じる」の使い方、出典方針。「はじめる」ボタン |
| 7.2 | 主人公を選ぶ | 4人のカード（アバター、名前、ひとことプロフィール、生育条件の要約）。各カードに任意の「見た目を変える」ボタン（§16.3）。特定の属性を強調する見出しは付けない |
| 7.3 | 章トップ | 年齢、季節、主人公の状況。トリガー注意が必要な章は、ここで注意画面を出す（「読む」「この章を読まずに進む」「相談窓口を見る」） |
| 7.4 | シーン | 本文、話者、選択肢。視点切替のあるイベントでは切替タブを出す。選択肢は2〜3個。「どちらも正解」の場面では、その旨を選択肢の下に小さく表示する |
| 7.5 | 確率カード | 何が起きるかの確率か、基本の確率（根拠ID）、確率を変えた要因（生育・社会・選択のどれが、何%から何%に変えたか）、最終の確率、結果。演出は短くし、`prefers-reduced-motion` のときは演出なしで結果だけを出す |
| 7.6 | 統計カード | 「日本では〜」の一文、数値、出典名・年度・リンク、`jpData: false` なら「米国のデータ」、`verified: false` なら「暫定値」のラベル |
| 7.7 | 章のふりかえり | 5パラメーターの前章からの変化。各パラメーターについて、4要因（選択・生育条件・社会条件・偶然）の積み上げ横棒を表示する。正負は中心線で分ける。凡例を必ず付ける |
| 7.8 | 全体のふりかえり（35歳） | 16〜35歳の5パラメーターの折れ線（主人公）。他の3人の標準ルートの軌跡を切り替えて重ねられる。全期間の要因分解。読まずに進んだ章を明示する。スコアや評価の言葉は出さない |
| 7.9 | 2周目を選ぶ | 「別の主人公で遊ぶ」か「同じ主人公で社会条件を1つ変える」かを選ぶ。後者では、その主人公に効く社会条件だけを一覧に出し、「同じ偶然で」「偶然も変える」を選ばせる |
| 7.10 | 比較 | 2つの周回の5パラメーターの軌跡を重ねて表示する。差が開いた章をハイライトし、その章で差を生んだ要因（変えた社会条件、それによって変わった確率など）を一覧にする |
| 7.11 | 相談窓口 | §10.6 の一覧。電話番号は `tel:` リンクにする |
| 7.12 | 出典 | §10.5 の全統計の一覧。暫定値・海外データのラベル付き |
| 7.13 | このサイトについて | 発行者、準拠ガイダンス、設計原則（P1〜P7を利用者向けの言葉で）、監修体制（TBD）、更新日 |
| 7.14 | 設定 | 保存方法の切替、保存データの削除、文字サイズ、ルビ、演出のオン／オフ |

グラフはライブラリを使わず、SVGを手で組む。色だけで要因を区別せず、模様かラベルも併用する（§9）。

---

## 8. 安全・プライバシー要件

### 8.1 クイック退出

- （付録B-46 でボタンは廃止し、右上は「ホーム」にした）`Esc` キーで退出する（モーダルを開いているときは、まずモーダルを閉じる）。
- 動作：`sessionStorage` の進行状況を消し、`location.replace(config.exitUrl)` で移動する。`replace` を使うので、ブラウザの「戻る」で戻れない。
- `config.exitUrl` の既定値：`https://www.google.co.jp/search?q=%E5%A4%A9%E6%B0%97`（「天気」の検索結果）。
- 「はじめに」画面で、このボタンの存在と、閲覧履歴そのものは消えないことを説明する。

### 8.2 その他

- ページの `<title>` は内容を推測されにくいものにする（例：「SRHR Japan 学習コンテンツ」。最終名はTBD）。
- 個人を特定する入力欄を作らない。
- 解析・広告・外部埋め込みを入れない。
- `Referrer-Policy: no-referrer` を設定する（§13.2）。外部リンクには `rel="noopener noreferrer"` を付ける。

---

## 9. アクセシビリティ

- WCAG 2.2 AA を目標にする。
- すべての操作をキーボードで行えること。フォーカスを見える状態に保つこと。
- 選択肢は `button` 要素で実装する。シーンが変わったら、本文の見出しにフォーカスを移す。
- グラフには、同じ内容を表す表または文章を `aria` で添える。要因を色だけで区別しない。
- ルビは `<ruby>` 要素で出力する。ルビ切替は CSS で `rt` を隠す方式にする。
- コントラスト比は、本文で 4.5:1 以上。

---

## 10. コンテンツ仕様

### 10.1 登場人物（`content/characters.yaml`）

初期値は設計値。監修で調整する。

| id | 名前 | 性別・性のあり方 | 生育条件（upbringing） | 初期値 body/safety/options/connection/autonomy | 根拠 |
| --- | --- | --- | --- | --- | --- |
| minami | ミナミ | 女性・異性愛 | `economy: middle`、`talkAboutSex: false` | 60/60/65/45/50 | S01, S14 |
| haruto | ハルト | 男性・異性愛 | `economy: stable`、`witnessedDV: true`（父が母を支配する家庭） | 70/55/70/40/60 | S04 |
| yu | ユウ | 女性・同性に惹かれる。自認の言葉は物語の中で本人が選ぶ | `economy: middle`、`comingOutAnxiety: true` | 65/60/60/40/55 | S24 |
| kei | ケイ | 男性・異性愛 | `economy: hardship`、`singleParent: true`、`familyCare: true`（弟妹の世話） | 55/60/45/45/45 | S22, S23 |

脇役：サキ（ケイの交際相手、19歳で登場）、アオイ（ユウのパートナー、24歳で登場）、保健室の養護教諭、ケイの母。

### 10.2 社会条件（`content/conditions.yaml`）

| id | 選択肢 | 既定 | 切り替えられる主人公 | 効果の概要 | 根拠 |
| --- | --- | --- | --- | --- | --- |
| sexEducation | `taught`（避妊・同意・デートDV・相談窓口を学校で学んだ）／`notTaught` | taught | 全員 | `taught` のとき、`knowsConsent`・`knowsDateDV`・`knowsWithdrawalUnreliable`・`knowsHelplines` を true にする。一部の選択肢の表示条件になる | S06, S09 |
| ecAccess | `otc2026`（薬局で処方箋なし）／`prescriptionOnly`（2026年2月以前） | otc2026 | kei | `prescriptionOnly` のとき、緊急避妊薬の入手に受診の場面が加わり、`options` に社会要因の負の効果（S）が付く | S11 |
| parentalLeave | `easy`（育休を取りやすい職場）／`hard` | hard | haruto, kei | 30歳の育休の場面で、`hard` のとき「取る」を選ぶと、`options` に社会要因の負の効果（S）が付く | S21 |
| partnership | `byResidence`（24歳でユウが住む場所しだい）／`available`（どこにも制度がある）／`notAvailable`（どこにも制度がない） | byResidence | yu | 30歳の場面の選択肢と効果が変わる。居住地は付録A-17 | S29（`verified: false`） |

社会条件の既定値は設計値であり、日本の多数派を表すものではない。「このサイトについて」でそう明記する。

### 10.3 イベント一覧（31件）

列の意味：種別は fixed＝確定、chance＝確率、branch＝ルート分岐。パラメーターは主に動くもの。

| id | 年齢 | 主人公 | 種別 | 領域 | 内容 | 選択肢（例） | パラメーター | 発生条件・備考 | 統計カード |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E16-ALL-SEXED | 16 | 全員 | fixed | 包括的性教育 | 保健の授業で避妊・同意・デートDVを学ぶ | ― | （フラグのみ） | `cond.sexEducation` で場面が変わる | S06, S09 |
| E16-YU-HPV | 16 | yu | fixed | ワクチンで防げる疾患 | HPVワクチン定期接種の最終年度。母は迷っている | 自分で調べて決める／親に任せる／受けない | body, autonomy | | S13 |
| E16-MINAMI-DIET | 16 | minami | fixed | 栄養・月経 | 友人と始めたダイエットで月経が不規則になる | 保健室に相談／婦人科を受診／続ける | body | `up.talkAboutSex == false` で相談の場面が変わる | S14 |
| E16-KEI-CARE | 16 | kei | fixed | 家族・社会経済 | 弟妹の世話で放課後が埋まり、授業も欠席しがち | 担任に事情を話す／黙っている | connection | | S22, S23 |
| E16-HARUTO-HOME | 16 | haruto | fixed | 対人暴力 | 父が母を怒鳴る場面を見ないようにしている | 誰かに話す／見ないふりをする | safety, connection | triggerWarning | S04 |
| E17-MH-CONTROL | 17 | minami, haruto | fixed | デートDV予防・同意 | 交際開始。位置情報の共有、スマホのチェック、友人との予定への口出し | ミナミ：受け入れる／違和感を言う／友人に話す。ハルト：「心配だから」を続ける／やめる | safety, autonomy | 視点切替。triggerWarning | S07, S01 |
| E17-YU-SEXTING | 17 | yu | fixed | オンラインの性的被害 | SNSで知り合った相手から画像を求められる | 断る／記録して相談する／送ってしまう | safety | 「送ってしまう」にも責める描写をしない。相談への導線を必ず続ける。triggerWarning | S08 |
| E17-KEI-MYTH | 17 | kei | fixed | 避妊・STIの知識 | 友人から「外に出せば大丈夫」と聞く | 信じる／自分で調べる／保健室で聞く | （フラグ） | 「信じる」で `flags.method = 'withdrawal'`、それ以外で `'condom'`。「調べる」「聞く」で `knowsWithdrawalUnreliable = true` | S09, S05 |
| E19-MH-ESCALATE | 19 | minami, haruto | fixed | 対人暴力・避妊 | 束縛が暴言と「避妊に協力しない」に進む | ミナミ：相談窓口に連絡／友人に話す／一人で耐える。ハルト：自分の言動を振り返る／相手のせいにする | safety, connection, autonomy | 視点切替。ハルト側の選択で `flags.harutoRoute` が決まる（§6.7）。triggerWarning | S01, S02, S04 |
| E19-KS-CONTRACEPTION | 19 | kei | chance | 避妊・緊急避妊 | 避妊のトラブルと緊急避妊 | 緊急避妊薬を入手する／様子を見る | options, body | §10.4 の CH-CONTRACEPTION と CH-EC | S25, S26, S11 |
| E19-YU-COMINGOUT | 19 | yu | fixed | 性の多様性・人権 | 大学の友人にカミングアウトするか | 話す／まだ話さない（neutral） | connection, autonomy | | S24 |
| E21-KS-PREGNANCY | 21 | kei | chance | 予期せぬ妊娠・人工妊娠中絶 | 妊娠が続いた場合、継続か人工妊娠中絶かを二人で話す。決めるのはサキ | 意見を押しつけない／費用と通院を分担する／距離を置く | options, connection | `flags.pregnant == true`。§10.4 の CH-SAKI-DECISION | S10, S27 |
| E21-KEI-STI | 21 | kei | fixed | STI | 梅毒の検査を勧められる | 保健所で検査を受ける／受けない | body | `flags.pregnant != true`。検査の結果は陰性で固定（感染確率の統計が未収集のため確率化しない） | S12 |
| E21-MINAMI-STALKING | 21 | minami | branch | 対人暴力 | 別れた後、元交際相手からのつきまとい | 警察・相談窓口に連絡する／我慢する | safety, connection | `flags.harutoRoute == 'continued'`。triggerWarning | S03 |
| E21-HARUTO-REFLECT | 21 | haruto | branch | 対人暴力・メンタルヘルス | 止まった場合は自分の行動を誰かに相談する。続いた場合は次の関係で同じことを繰り返しかける | 相談する／しない | autonomy, connection | `harutoRoute` でシーンが分かれる。加害者向け相談先はTBD | S01 |
| E21-YU-SCREENING | 21 | yu | fixed | がん予防 | 子宮頸がん検診の案内が届く | 受ける／後回しにする | body | 統計カードはTBD | （TBD） |
| E24-MINAMI-WORK | 24 | minami | fixed | 月経・労働 | 就職。長時間労働で月経のつらさが悪化する | 受診して治療を相談する／我慢する | body, options | 統計カードはTBD | （TBD） |
| E24-HARUTO-DISCLOSE | 24 | haruto | fixed | 関係性・同意 | 新しいパートナーに過去を話すか | 話す／話さない | connection, autonomy | | ― |
| E24-YU-WORKPLACE | 24 | yu | fixed | 性の多様性・労働 | アオイと同居。職場でカミングアウトするか | する／しない（neutral） | connection | | S24 |
| E24-KEI-WORK | 24 | kei | fixed | 社会経済 | 非正規で働きながら家族を支える | 資格取得の支援制度を探す／現状を続ける | options | | S22, S19 |
| E27-MINAMI-DECIDE | 27 | minami | fixed | 妊孕性・ライフコース | 子どもを持つか。年齢と妊孕性の情報に触れる | 持たないと決める／いずれ考える／パートナーと話す（すべて neutral） | autonomy | 選択で `flags.minamiPath` を `'noChildren' / 'later' / 'now'` にする | S17, S19 |
| E27-HARUTO-TEST | 27 | haruto | fixed | 不妊 | パートナーと子どもを望む。男性側も検査を受けるか | 一緒に検査を受ける／相手に任せる | body, connection | | S16 |
| E27-YU-FAMILY | 27 | yu | fixed | ライフコース・人権 | アオイと子どもを持ちたいと考え、制度の壁に直面する | 情報を集める／支援団体に相談する／見送る（neutral） | options, autonomy | 制度の記述は監修で確認するまで `status: draft` | S24 |
| E27-KEI-PATH | 27 | kei | branch | ライフコース | 父親になった場合は育児と仕事の両立。そうでない場合は結婚しない選択 | ルートごとに2択 | options | `flags.keiFather` で分岐 | S21 / S19 |
| E30-HARUTO-LEAVE | 30 | haruto | fixed | 両立・ジェンダー規範 | 子どもが生まれ、育休を取るか | 取る／取らない | connection, options | `cond.parentalLeave` で効果が変わる | S21, S20 |
| E30-MINAMI-BRANCH | 30 | minami | chance | 栄養・妊娠 | `now` ルートは妊娠・出産。`noChildren`・`later` ルートはキャリアの転機 | ルートごと | body, options | `now` ルートで CH-LBW を使う | S14, S15 |
| E30-YU-PARTNERSHIP | 30 | yu | fixed | 人権・制度 | アオイと住まいとパートナーシップ制度を考える | 制度を利用する／しない（neutral） | connection | `cond.partnership` で選択肢が変わる | （TBD） |
| E30-KEI-WORK | 30 | kei | chance | 両立 | 父親ルート：パートナーの出産と就業継続。それ以外：暮らし方の選択 | 家事・育児を分担する／相手に任せる | connection, options | 父親ルートで CH-PARTNER-WORK を使う | S20, S21 |
| E35-MINAMI-ART | 35 | minami | chance | 不妊 | 子どもを望んだ場合、不妊治療を検討する。保険の条件と年齢別の出産率を知る | 治療する／しない／養子・里親制度を調べる | options, autonomy | `flags.minamiPath == 'later'`。CH-ART | S16, S17, S18 |
| E35-HARUTO-CYCLE | 35 | haruto | fixed | 対人暴力の連鎖 | 自分の子どもに、父から受け継いだものを渡さないと決める | ― | safety, connection | | S04 |
| E35-ALL-REVIEW | 35 | 全員 | fixed | ― | 全体のふりかえりへ | 2周目へ進む | ― | §7.8 | ― |

### 10.4 確率ノードの定義

すべての確率は §10.5 の統計値から計算する。設計上の判断で決めた部分は「解釈」として明記し、「このサイトについて」にも載せる。

**CH-CONTRACEPTION（E19-KS-CONTRACEPTION）**
- 何の確率か：この1年に、避妊のトラブルで妊娠に至りうる出来事が起きる確率。
- base：`flags.method == 'withdrawal'` のとき 0.20、`'condom'` のとき 0.13（S25）。
- 解釈：S25 は「典型的な使用での1年目の妊娠率」。物語上の1年を1回の判定とし、この値をそのまま使う。
- happens → CH-EC に進む。notHappens → `flags.pregnant = false`。

**CH-EC（CH-CONTRACEPTION が起きた後）**
- 先にプレイヤーが緊急避妊薬を使うかどうかを選ぶ。ただし、`method == 'withdrawal'` かつ `knowsWithdrawalUnreliable != true` の場合は、トラブルに気づけないため、この選択肢を出さない。
- `cond.ecAccess == 'prescriptionOnly'` のときは、受診の場面を挟む（確率化しない。社会要因の負の効果 S を付ける）。
- `up.economy == 'hardship'` のときは、費用（希望小売価格7,480円、S11）の場面を挟む（生育要因の負の効果 S を付ける）。
- 何の確率か：妊娠が成立する確率。
- base：1.0（S25 の失敗＝妊娠と定義しているため）。
- modifier：緊急避妊薬を使ったとき `mul 0.16`（妊娠阻止率84%、S26、source: choice）。
- happens → `flags.pregnant = true`。notHappens → `flags.pregnant = false`。

**CH-SAKI-DECISION（E21-KS-PREGNANCY）**
- actorLabel：「サキの決定」。
- 何の確率か：サキが人工妊娠中絶を選ぶ確率。
- base：0.441（20〜24歳で妊娠したときに中絶を選ぶ割合、S27）。
- 解釈：決定はサキのもので、ケイの選択はこの確率を変えない（ケイの選択は connection などの効果だけに影響する）。
- happens → `flags.keiFather = false`。notHappens → `flags.keiFather = true`。
- 本文では、どちらの結果も否定的に描かない。

**CH-LBW（E30-MINAMI-BRANCH、`now` ルート）**
- 何の確率か：出生体重が2,500g未満になる確率。
- base：0.098（S15）。
- modifier：やせとの関連の補正は、統計が未収集のため入れない（TBD）。統計カードで、若年女性のやせ（S14）と低出生体重の関連を文章だけで示す。
- 本文では、低出生体重を母親の責任として描かない。

**CH-PARTNER-WORK（E30-KEI-WORK、父親ルート）**
- 何の確率か：パートナーが第1子の出産後も仕事を続ける確率。
- base：0.805（S20）。
- modifier：なし（育休利用との因果を示す統計がないため）。

**CH-ART（E35-MINAMI-ART）**
- 何の確率か：生殖補助医療1回あたりで出産に至る確率。
- base：0.30（S17。「22〜35歳頃は約30%前後」）。
- 解釈：35歳の正確な年齢別値は未取得（TBD）。`verified: false` として扱う。
- 1回ずつ「続ける／やめる」を選ばせる。保険適用の回数（40歳未満は通算6回、S18）を上限とする。各回の `nodeId` は `CH-ART-1`〜`CH-ART-6` とする。

### 10.5 統計（`content/stats.yaml`）

`verified: false` は二次資料などのため原典で未確認のもの。`jpData: false` は日本以外のデータ。

| id | 指標 | 数値（numbers に入れる値） | 定義・注意 | 出典 | 年 | verified | jpData |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | 交際相手からの暴力の被害経験 | 女性22.7%、男性12.0%。被害者の39.1%はどこにも相談せず。女性被害者の23.3%が命の危険を感じた | 交際経験のある18〜59歳 | [内閣府 男女間における暴力に関する調査 概要版](https://www.gender.go.jp/kaigi/senmon/boryoku/siryo/pdf/bo124-2.pdf) | 2023年度 | true | true |
| S02 | 不同意性交等の被害経験 | 女性8.1%、男性0.7%。加害者は交際相手・元交際相手が各16.4%。被害時期は20代が約4割、18・19歳と中学卒業〜17歳が各約2割。55.7%は相談せず | 被害時期・加害者は複数回答 | 同上 | 2023年度 | true | true |
| S03 | 執拗なつきまとい等の被害経験 | 女性14.0%、男性5.7%。加害者は元交際相手が23.9%で最多 | | 同上 | 2023年度 | true | true |
| S04 | 配偶者からの暴力の被害経験 | 結婚経験のある女性27.5%、男性22.0%。女性の性的強要10.6%。子どもがいる被害者の30.8%で子どもにも被害 | 性的強要には「避妊に協力しない」を含む | 同上 | 2023年度 | true | true |
| S05 | 性交経験率 | 高校男子12.0%、高校女子14.8%、大学男子53.7%、大学女子43.8% | 学年平均値 | [日本性教育協会 第9回青少年の性行動全国調査（現代性教育研究ジャーナル No.166）](https://www.jase.faje.or.jp/jigyo/journal/seikyoiku_journal_202501.pdf) | 2023年度 | true | true |
| S06 | 「性的同意」の認知と理解 | 言葉の認知：高校男子74.2%、高校女子62.5%。意味の正答：高校生7割前後、大学生8割前後 | | 同上 | 2023年度 | true | true |
| S07 | デートDVの被害パターン | 被害経験者の66.9〜77.0%が「友達づきあい干渉のみ」「精神的暴力のみ」「その両方」のいずれか。女子の「性的被害のみ」は高校5.4%、大学8.1% | 被害経験者に占める割合 | 同上 | 2023年度 | true | true |
| S08 | 交際相手以外からの性的被害（高校女子） | セクスティング要求13.3%、つきまとい・待ち伏せ15.2%、痴漢8.2% | 高校男子のセクスティング要求は3.1% | 同上 | 2023年度 | true | true |
| S09 | 性知識の正答率（高校生） | 「腟外射精は確実な避妊法ではない」男子67.7%、女子58.9% | 学校で教わった群の方が、多くの項目で正答率が高い | 同上 | 2023年度 | true | true |
| S10 | 人工妊娠中絶実施率 | 20歳未満4.1、20〜24歳11.1、25〜29歳9.1 | 女子人口千対。20歳未満は15〜19歳の女子人口が分母。2026-10-21 原典で確認 | [厚生労働省 令和6年度衛生行政報告例](https://www.mhlw.go.jp/toukei/saikin/hw/eisei_houkoku/24/dl/kekka5.pdf) | 2024年度 | true | true |
| S11 | 緊急避妊薬の市販化 | 2026年2月2日から薬局で処方箋なしで販売。年齢制限・親の同意なし。薬剤師の面前で服用。希望小売価格7,480円。販売可能店舗は約7千 | 性交後72時間以内の服用が原則 | [秋田魁新報（共同通信）](https://www.sakigake.jp/news/article/20260202CO0031/)、[鹿児島県](https://www.pref.kagoshima.jp/ae10/kinkyuuhininyaku.html) | 2026年 | true | true |
| S12 | 梅毒の報告数 | 2023年15,055例（過去最多）、2024年14,829例。女性は20代前半が特に多い | 感染症法に基づく届出（2024年診断分の確定報告）。2026-10-21 原典で確認し、2024年の値を暫定値14,663から確定値に差し替え | [国立健康危機管理研究機構](https://id-info.jihs.go.jp/surveillance/idss/target-diseases/syphilis/2024/20260428Syphilis.pdf) | 2023〜2024年 | true | true |
| S13 | HPVワクチン累積初回接種率 | 2009年度生まれ（2025年度に16歳）で全国55.1% | 2025年度末時点の推計。2026-10-21 原典で確認 | [厚生労働省 第112回副反応検討部会 資料3-2](https://www.mhlw.go.jp/content/11120000/001727327.pdf) | 2025年度末 | true | true |
| S14 | 若年女性のやせ | 20〜30代女性のBMI18.5未満は20.2% | 女性全体は12.2% | [厚労省 e-ヘルスネット（国民健康・栄養調査）](https://kennet.mhlw.go.jp/information/information/food/e-02-006) | 2023年 | true | true |
| S15 | 低出生体重児の割合 | 出生の9.8%が2,500g未満（`p: 0.098`） | 2024年確定数。2,500g未満は67,134人。2026-10-21 原典で確認 | [e-Stat 人口動態統計 第4.26表](https://www.e-stat.go.jp/dbview?sid=0003411615) | 2024年 | true | true |
| S16 | 不妊の検査・治療経験 | 夫婦の22.8%（4.4組に1組） | 妻が55歳未満の夫婦 | [社人研 第17回出生動向基本調査](https://www.ipss.go.jp/ps-doukou/j/doukou17/doukou17_gaiyo.html) | 2025年 | true | true |
| S17 | 生殖補助医療の年齢別生産率 | 35歳29.6%（`p35: 0.296`）、42歳7.8%、43歳6.0%、44歳3.9% | 生産率／総治療周期（全凍結周期を除く）。2026-10-21 原典で確認し、2023年の値に差し替え（以前は二次資料の「約30%前後」） | [日本産科婦人科学会 2023年 臨床実施成績](https://www.jsog.or.jp/activity/art/2023_JSOG-ART.pdf) | 2023年 | true | true |
| S18 | 不妊治療の保険適用条件 | 治療開始時に女性43歳未満。40歳未満は通算6回、40〜43歳未満は通算3回まで | 子ども1人あたりの移植回数 | 同上 | 2022年〜 | true | true |
| S19 | 結婚・子どもについての意識（18〜34歳未婚者） | 「いずれ結婚するつもり」男性75.1%、女性77.8%。希望子ども数は男性1.64人、女性1.70人。6人に1人が結婚しても子を望まない。恋人がいるのは男性19.6%、女性27.8% | | [社人研 第17回出生動向基本調査](https://www.ipss.go.jp/ps-doukou/j/doukou17/doukou17_gaiyo.html) | 2025年 | true | true |
| S20 | 第1子出産前後の妻の就業継続率 | 80.5%（`p: 0.805`、2020〜24年出産）。就業継続者の82.4%が育児休業を利用 | 2015〜19年出産は69.9% | 同上 | 2025年 | true | true |
| S21 | 育児休業取得率 | 男性50.9%、女性88.3% | 令和7年度雇用均等基本調査。2026-10-21 原典で確認 | [厚生労働省](https://www.mhlw.go.jp/toukei/list/dl/71-r07/06.pdf) | 2025年度 | true | true |
| S22 | 子どもの貧困率 | 子ども11.0%、ひとり親世帯44.7% | 2024年の所得。ひとり親世帯は「子どもがいる現役世帯のうち大人が一人」。2026-10-21 原典で確認 | [厚生労働省 2025年 国民生活基礎調査の概況](https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/14.pdf) | 2025年調査 | true | true |
| S23 | 家族の世話をしている中高生 | 中学2年5.7%、全日制高校2年4.1% | 国の初回全国調査 | [nippon.com](https://www.nippon.com/ja/japan-data/h00997/) | 2020〜21年 | true | true |
| S24 | 性的マイノリティの割合 | 全国3.5%（埼玉県調査では3.3%）。子どもを持ちたい割合は、同性愛・両性愛の人で38.6%、全体で23.4% | 18〜69歳の無作為抽出調査 | [釜野・平森ほか 全国調査](https://newscast.jp/smart/news/0895323)、[埼玉県](https://www.pref.saitama.lg.jp/a0303/2020lgbtqchousa.html) | 2023年、2020年 | true | true |
| S25 | 避妊法の1年目の失敗率（典型的な使用） | 腟外射精20%（`withdrawal: 0.20`）、男性用コンドーム13%（`condom: 0.13`）、避妊なし85% | 米国データ。日本の公的統計がないため代替として使う | [CDC MMWR US SPR 2014 Appendix D](https://www.cdc.gov/mmwr/preview/mmwrhtml/rr6304a5.htm) | 2014年 | true | false |
| S26 | 緊急避妊薬（レボノルゲストレル）の妊娠阻止率 | 84%（`prevention: 0.84`。海外第Ⅲ相試験、性交後0〜72時間）。国内第Ⅲ相試験では81.0% | 2026-10-21 添付文書で確認。学会の指針（令和7年度改訂版）には数値がないため、出典を添付文書にし、海外のデータとした | [ノルレボ錠 添付文書](https://pins.japic.or.jp/pdf/newPINS/00066208.pdf) | 2022年改訂 | true | false |
| S27 | 妊娠したときに人工妊娠中絶を選ぶ割合 | 20歳未満71.8%、20〜24歳44.1%（`p2024: 0.441`）、全年齢15.7% | 中絶件数÷（出生数＋中絶件数） | [日本産婦人科医会 記者懇談会資料](https://www.jaog.or.jp/wp/wp-content/uploads/2026/05/20260513_press207_1.pdf) | 2024年 | true | true |
| S28 | HPVの感染とHPVワクチンで防げる範囲 | 性的接触のある女性の50%以上が一生に一度はHPVに感染する。HPVワクチンで感染を防ぐことで、子宮頸がんの原因の50〜70%を防げる | 厚生労働省の広報誌での説明。2026-10-20 追加（付録A-16） | [厚生労働省 広報誌『厚生労働』2022年5月号](https://www.mhlw.go.jp/stf/houdou_kouhou/kouhou_shuppan/magazine/202205_00001.html) | 2022年 | true | true |
| S29 | パートナーシップ制度の人口カバー率 | 導入自治体は530、人口カバー率は92.5%（`coverage: 0.925`）、登録件数は9,836組（2025年5月末時点） | 渋谷区と認定NPO法人虹色ダイバーシティの共同調査。2026-10-21 渋谷区の発表で確認 | [渋谷区 報道発表](https://www.city.shibuya.tokyo.jp/kusei/hodo/hodo-2025/hodo_20250627.html) | 2025年 | true | true |
| S30 | 妊娠前のやせと低出生体重児 | 妊娠前にやせ（BMI18.5未満）だった母親の子は、低出生体重児が発生する可能性の比（オッズ比）が1.61倍（95%CI：1.38〜1.86）（`oddsRatio: 1.61`） | 日本人女性34研究・約76万人のメタ解析。2026-10-20 追加（付録A-21） | [国立成育医療研究センター](https://www.ncchd.go.jp/press/2026/0129.pdf) | 2026年 | true | true |
| S31 | 不妊治療と仕事の両立 | 両立できず11%が離職。両立できなかった理由は、日程調整の難しさ49.3%、精神面の負担44.8%、体調・体力面の負担40.3%、通院回数の多さ32.8% | 原典は令和5年度 不妊治療と仕事の両立に係る諸問題についての総合的調査。2026-10-20 追加（付録A-22） | [厚生労働省 ハンドブック](https://www.mhlw.go.jp/content/11909000/001663161.pdf) | 2026年 | true | true |
| S32 | 性的同意と避妊についての若者の意識 | 「同意を得ているつもりだが自信がない」男性49.1%、女性36.0%。「性的同意とはどういうものか、正直わかっていない」42.0%。妊娠を望まないのに避妊せずに性交した経験は男性29.8%、女性39.0%。「相手に合わせてしまうことがよく／たまにある」71.4% | 交際経験のある15〜29歳5,800人のインターネット調査（全国を代表する標本ではない）。腟外射精は避妊に含まない。2026-10-21 追加（付録B-30） | [ジョイセフ 性と恋愛 意識調査2023（プレスリリース）](https://prtimes.jp/main/html/rd/p/000000111.000017711.html) | 2023年 | true | true |
| S33 | 若年層の性交を伴う性暴力被害 | 遭遇率は16〜19歳の女性2.7%、男性0.5%、Xジェンダー・ノンバイナリー7.5%。最も深刻な被害が性交を伴うものだった人のうち、加害者は(元)交際相手27.5%。被害時の状況は「相手との関係性から拒否できなかった」23.4%。どこにも相談しなかった52.1% | 16〜24歳のインターネット調査。「避妊なしに性交させられた」も性交を伴う性暴力に含む。加害者・状況は複数回答（n=167）。2026-10-21 追加（付録B-30） | [内閣府 若年層の性暴力被害の実態に関するオンラインアンケート及びヒアリング結果 報告書](https://www.gender.go.jp/policy/no_violence/e-vaw/chousa/pdf/r04_houkoku/01.pdf) | 2022年 | true | true |
| S34 | 初めての性交での「自分で決められたか」 | 初めての性交が「避妊した・自分で決めた・二人とも同じくらい望んだ・ちょうどよい時期だった」の4つを満たさなかった人は、女性51.7%、男性43.6%。満たさなかった人は、のちの性機能の低さと関連（オッズ比：女性2.00、男性1.52） | 英国 Natsal-3（2010〜12年、17〜24歳の2,784人）。関連であって因果ではない。2026-10-21 追加（付録B-30） | [Palmer ほか, Journal of Sex Research](https://pmc.ncbi.nlm.nih.gov/articles/PMC5214675/) | 2017年 | true | false |
| S35 | デートDVの被害のうち、身体的・性的な被害を含む割合（S07からの解釈） | 23.0〜33.1%（S07の66.9〜77.0%の残り）。19歳のミナミに合う群の値は原文で未確認のため、下限の23.0%を仮に使う（`p: 0.23`） | 付録B-14・B-32。2026-10-21 追加 | 同 S07 | 2023年度 | false | true |
| S36 | 親の間の暴力を見て育つことと、交際相手への暴力 | 子どものころに親の間の暴力にさらされた男性の、大人になってからの加害のオッズ比1.92（95%CI：1.60〜2.29）（`oddsRatio: 1.92`） | アフリカ29か国・48研究のメタ解析。本文（PMC）で確認。2026-10-21 追加（付録B-15） | [Wadji ほか, Trauma, Violence, & Abuse](https://pmc.ncbi.nlm.nih.gov/articles/PMC12397551/) | 2024年 | true | false |
| S37 | 若者向けのデートDV予防プログラムの効果 | 加害行動への効果量0.157（38研究）。オッズ比に換算して約0.75（`oddsRatio: 0.75`）。学校での予防プログラムでは行動への効果は有意でなかったとするメタ解析もある | Lee & Wong 2020。換算は ln(OR) = d × π/√3。反対の結果は De La Rue ほか 2017。効果量は抄録（米国司法省 NCJRS）で確認。2026-10-21 追加（付録B-15） | [Lee & Wong, Journal of Experimental Criminology](https://ojp.gov/ncjrs-virtual-library/redirect/308082) | 2020年 | true | false |
| S38 | 若い世代の喫煙 | 20代の喫煙率は男性20.6%、女性5.2%（20歳以上全体では男性25.6%、女性6.9%）。望まない受動喫煙の機会がある人は、職場で17.0% | 「現在習慣的に喫煙している者」（毎日または時々吸う）。20代の値は報告書の図32から読み取った。受動喫煙は現在喫煙者を除く20歳以上。2026-10-21 追加（付録B-33） | [厚生労働省 令和5年 国民健康・栄養調査結果の概要](https://www.mhlw.go.jp/content/10900000/001338334.pdf) | 2023年 | true | true |
| S39 | 生活習慣病のリスクを高める量の飲酒 | 男性14.1%、女性9.5%。女性はこの10年で有意に増加 | 1日あたりの純アルコールが男性40g以上、女性20g以上。20歳以上。2026-10-21 追加（付録B-33） | [厚生労働省 令和5年 国民健康・栄養調査結果の概要](https://www.mhlw.go.jp/content/10900000/001338334.pdf) | 2023年 | true | true |
| S40 | 栄養バランスのとれた食事 | 主食・主菜・副菜を組み合わせた食事を毎日1日2回以上とっている人は、20代で男性27.8%、女性28.6%（20歳以上全体では男性45.7%、女性47.1%） | 20代の値は報告書の図16から読み取った。2026-10-21 追加（付録B-33） | [厚生労働省 令和5年 国民健康・栄養調査結果の概要](https://www.mhlw.go.jp/content/10900000/001338334.pdf) | 2023年 | true | true |
| S41 | 妊娠前からの葉酸 | 妊娠を計画している・妊娠の可能性がある女性は、食事に加えて1日400μgの葉酸をとることが望まれる（妊娠1か月以上前から妊娠3か月まで）。日本の二分脊椎の発症率は、出生1万あたり3.10（1987〜1991年）から5.59（2007〜2011年）で、大きな減少はみられない | 神経管閉鎖障害のリスク低減のため。2000年の厚生省（当時）の通知、日本人の食事摂取基準（2025年版）による。2026-10-21 追加（付録B-33） | [厚生労働省 e-ヘルスネット「葉酸とサプリメント」](https://kennet.mhlw.go.jp/information/information/food/e-05-002.html) | 2025年 | true | true |
| S42 | 妊娠中・子育て中の喫煙と飲酒 | 妊娠中の喫煙1.6%、妊娠中の飲酒1.0%。3・4か月児の父親の喫煙28.8% | 乳幼児健康診査（3・4か月児）の問診への回答。2026-10-21 追加（付録B-33） | [こども家庭庁 令和5年度 乳幼児健康診査問診回答状況（全国）](https://www.cfa.go.jp/press/5c98dd59-0aed-4295-81d1-a78accd39b46) | 2023年度 | true | true |
| S43 | 賃金の男女差 | 男性を100とすると女性は76.6。月額は25〜29歳で男性28.8万円、女性26.9万円。35〜39歳で男性36.6万円、女性29.2万円 | 一般労働者の所定内給与。2025年。2026-11-01 追加（付録B-44） | [厚生労働省 令和7年賃金構造基本統計調査](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/dl/14.pdf) | 2025年 | true | true |
| S44 | 管理職に占める女性の割合 | 部長相当職9.2%、課長相当職13.2%、係長相当職20.9% | 令和7年度。2026-11-01 追加（付録B-44） | [厚生労働省 令和7年度雇用均等基本調査](https://www.mhlw.go.jp/toukei/list/dl/71-r07/06.pdf) | 2025年度 | true | true |
| S45 | 女性の正規雇用の割合（L字カーブ） | 25〜29歳の60.3%が最も高く、そのあと年齢とともに下がる | 2024年。2026-11-01 追加（付録B-44） | [内閣府 令和7年版 男女共同参画白書](https://www.gender.go.jp/about_danjo/whitepaper/r07/zentai/html/honpen/b1_s02_01.html) | 2024年 | true | true |
| S46 | 非正規雇用 | 役員を除く雇用者の36.5%。男性678万人、女性1,450万人 | 2025年平均。2026-11-01 追加（付録B-44） | [総務省 労働力調査 2025年平均](https://www.stat.go.jp/data/roudou/sokuhou/nen/ft/pdf/youyaku.pdf) | 2025年 | true | true |
| S47 | 家事と育児の時間 | 6歳未満の子がいる夫婦の家事関連時間は、1日に夫1時間54分、妻7時間28分 | 週全体の平均。夫婦と子どもの世帯。2026-11-01 追加（付録B-44） | [総務省 令和3年社会生活基本調査](https://www.stat.go.jp/data/shakai/2021/pdf/gaiyoua.pdf) | 2021年 | true | true |
| S48 | 結婚で変える名字 | 夫の姓を選ぶ夫婦が94.1%、妻の姓が5.9% | 2024年。原典は人口動態統計。2026-11-01 追加（付録B-44） | [内閣府 夫婦の姓に関するデータ](https://www.gender.go.jp/research/fufusei/pdf/01.pdf) | 2024年 | true | true |
| S49 | 就活セクハラ | インターンシップで22.8%（男性24.7%、女性20.8%）、それ以外の就職活動で23.5%（男性27.0%、女性19.7%） | 厚生労働省の令和5年度の調査を、茨城労働局がまとめた資料で確認。別の記事に約3割という値もあり、母数が違う可能性がある。2026-11-01 追加（付録B-44） | [茨城労働局（厚生労働省 職場のハラスメントに関する実態調査）](https://jsite.mhlw.go.jp/ibaraki-roudoukyoku/content/contents/R06kokin_hara.pdf) | 2023年度 | true | true |
| S50 | ひとり親の収入 | 平均年間就労収入は、母236万円、父496万円 | 2020年の収入。2026-11-01 追加（付録B-44） | [こども家庭庁 令和3年度 全国ひとり親世帯等調査](https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/f1dc19f2-79dc-49bf-a774-21607026a21d/9ff012a5/20230725_councils_shingikai_hinkon_hitorioya_6TseCaln_05.pdf) | 2021年度 | true | true |
| S51 | 性的マイノリティと職場 | 職場で困りごとを抱える人は、レズビアン・ゲイ・バイセクシュアルの約4割、トランスジェンダーの約5割 | 令和元年度の厚生労働省委託調査。2026-11-01 追加（付録B-44） | [厚生労働省 多様な人材が活躍できる職場環境づくりに向けて](https://www.mhlw.go.jp/content/000808159.pdf) | 2019年度 | true | true |
| S52 | 若い世代のがん | 1年あたり、人口10万人に、15〜19歳16.5人、20代32.4人、30代105.4人。30代女性は乳がん30%、子宮頸がん14%。20代男性は精巣などの胚細胞腫瘍22% | 2023年の罹患率。がん種の割合は2016〜2018年。2026-11-01 追加（付録B-44） | [国立がん研究センター がん情報サービス](https://ganjoho.jp/reg_stat/statistics/stat/child_aya.html) | 2023年 | true | true |
| S53 | 子宮内膜症 | 生殖年齢の女性の約10% | 二次資料。よりよい資料を探す（付録B-44）。2026-11-01 追加（付録B-44） | [日本医師会の情報をまとめた記事](https://www.dreamnews.jp/press/0000177877) | 2018年 | false | true |
| S54 | うつ病の有病率 | 12か月有病率2.1%（男性1.0%、女性3.0%）、生涯有病率6.6%（男性3.7%、女性9.1%） | 世界精神保健調査のデータ（2009年の検討会資料）。すべてのうつ病エピソード、ICD-10診断。成人の調査で、高校生の値ではない。性自認別の値はない。2026-11-01 追加（付録B-44）、12か月の値を追記（付録B-46） | [厚生労働省 今後の精神保健医療福祉のあり方等に関する検討会 資料](https://www.mhlw.go.jp/shingi/2009/06/dl/s0604-7c.pdf) | 2009年 | true | true |
| S55 | 流産 | 妊娠の約15%。原因の多くは偶然の染色体異常 | 日本産科婦人科学会の説明。2026-11-01 追加（付録B-44） | [日本産科婦人科学会 流産・切迫流産](https://www.jsog.or.jp/citizen/5707/) | 2026年確認 | true | true |
| S56 | 不妊の原因 | 男性のみ24%、男女とも24% | WHOの調査。2026-11-01 追加（付録B-44） | [こども家庭庁 はじめよう プレコンセプションケア](https://precon.cfa.go.jp/dictionary/male-infertility/) | 2026年確認 | true | true |
| S57 | トランスジェンダーの人のメンタルヘルス | K6が10点以上（気分・不安障害にあてはまる可能性）の人は、シスジェンダーの異性愛者13.3%、トランスジェンダー37.5%（約3倍、有意差あり）。13点以上は6.9%と18.8% | 18〜59歳の大阪市民（2019年調査）。トランスジェンダーは、自認する性別を出生時と別の性別またはその他と答えた人で、n=32。シスジェンダーの異性愛者はn=3,537。うつ病の診断ではなく、心理的苦痛の尺度K6の値。2026-11-01 追加（付録B-46） | [働き方と暮らしの多様性と共生研究チーム](https://www.ipss.go.jp/projects/j/SOGI/%EF%BC%8A20200111%E3%82%BB%E3%82%AF%E3%83%9E%E3%82%A4%E5%8C%BB%E7%99%82%E7%A6%8F%E7%A5%89%E6%95%99%E8%82%B2%E3%83%91%E3%83%8D%E3%83%AB.pdf) | 2020年 | true | true |
| S58 | ひとり親世帯になった理由 | 母子世帯は離婚79.5%、未婚の母10.8%、死別5.3%。父子世帯は離婚69.7%、死別21.3%、未婚の父1.0% | 令和3年度の推計値。2026-11-01 追加（付録B-47） | [こども家庭庁 令和3年度 全国ひとり親世帯等調査](https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/f1dc19f2-79dc-49bf-a774-21607026a21d/9ff012a5/20230725_councils_shingikai_hinkon_hitorioya_6TseCaln_05.pdf) | 2021年度 | true | true |

### 10.6 相談窓口（`content/resources.yaml`）

公開直前に、各窓口の公式ページで番号と受付時間を再確認する。

| 窓口 | 連絡先 | 対象 | 確認元 |
| --- | --- | --- | --- |
| DV相談＋（プラス） | 0120-279-889。電話・メールは24時間、SNSは12〜22時（10言語） | 配偶者・恋人からの暴力 | [警察庁 犯罪被害者白書](https://www.npa.go.jp/hanzaihigai/whitepaper/2024/zenbun/part3_siryo/siryo-9.html) |
| DV相談ナビ | #8008（最寄りの配偶者暴力相談支援センターにつながる） | 配偶者・恋人からの暴力 | 同上 |
| 性犯罪・性暴力被害者のためのワンストップ支援センター | #8891 | 性暴力の被害 | 同上 |
| 性犯罪被害相談電話 | #8103 | 性犯罪の被害（警察） | [政府広報オンライン](https://www.gov-online.go.jp/kurashinosodan/list/ct_higaisoudan.html) |
| 緊急避妊薬の販売薬局 | 厚生労働省の販売可能薬局一覧（URLはTBD） | 避妊の失敗・避妊なしの性交 | [鹿児島県](https://www.pref.kagoshima.jp/ae10/kinkyuuhininyaku.html) |
| 性と健康の相談センター | 都道府県・市の窓口一覧（URLはTBD） | からだ・妊娠・不妊・性の悩み全般 | TBD |

各窓口の表示場所：
- フッターのリンク先：全窓口
- DV・性暴力のイベントの後：DV相談＋、DV相談ナビ、ワンストップ支援センター、性犯罪被害相談電話
- E19-KS-CONTRACEPTION の後：緊急避妊薬の販売薬局、性と健康の相談センター
- 不妊・妊娠のイベントの後：性と健康の相談センター

---

## 11. 本文の執筆ルール

Claude Code が下書きする本文にも、この規則を適用する。

1. 1シーンは200字以内、選択肢は1つ30字以内。
2. 暴力の場面は、行為を描写しない。前後の会話、本人の感情、周囲の反応で描く。
3. 被害者が「なぜ逃げなかったか」と問われる構図を作らない。
4. 加害を「生まれつき」や「性格」として描かない。学習された行動として描き、止める選択肢を必ず置く（P7）。
5. 「正しい／間違い」「失敗した」「〜してしまった」と、選択を評価する言い方をしない。「人工妊娠中絶」を中立の語として使う。
6. 性的指向・性自認を、本人が使っていないラベルで呼ばない。ユウの自認の言葉は、本人が選ぶ場面を経てから使う。
7. 統計カードの文型は「日本では、〜（S01、2023年度）」とする。数値は §10.5 の表からそのまま引く。丸めたり言い換えたりしない。
8. 方言・流行語は使わない。漢字は常用漢字の範囲にし、高校生が読めない語にはルビを振る。
9. 医療情報（薬の用法、検査の流れ）は、§10.5 にある事実だけを書く。それ以外は「医療機関・薬剤師に相談」へつなぐ。

---

## 12. ビルド時の検証とテスト

### 12.1 コンテンツ検証（`npm run validate`、build の前に必ず実行）

ビルドを失敗させる条件：
- zod スキーマ違反
- 存在しない `next`・`statRef`・`statCard`・条件ID・フラグ名の参照
- 構文エラーのある FlagExpr
- `source` のない効果
- `chance` 以外の要因を持つ、確率ノードの結果効果（§6.4-3）
- `statRef` のない ChanceModifier
- `neutral: true` の選択肢に付いた負の効果
- ミナミの視点のシーンから `harutoRoute` を書き換える `setFlags`（P7）
- 行き止まりのシーン（`next` も選択肢もない、`END` 以外のシーン）
- 各主人公について、全フラグの組み合わせで16歳から35歳まで到達できない
- **本番ビルド（`NODE_ENV=production`）では、`verified: false` の統計を参照する確率ノード・統計カードが1つでもあれば失敗させる。** プレビュー用には `ALLOW_UNVERIFIED=1` で通す。その場合、該当箇所の画面に「暫定値」ラベルを表示する。

警告（ビルドは通す）：
- `status: draft` のイベント（件数を一覧で出す）
- 200字を超えるシーン

### 12.2 エンジンの単体テスト

- 要因分解の不変条件（§6.3）が、任意の選択列で成り立つ（プロパティテスト）。
- 同じ seed・同じ nodeId なら、`u` が常に同じになる。
- 前の章の選択を変えても、後の章の `u` が変わらない。
- 同じ seed で社会条件だけを変えたとき、`finalP` が変わらない確率ノードの結果は変わらない。
- CH-EC：`withdrawal` かつ知識なしのとき、緊急避妊の選択肢が出ない。
- P7：ミナミの視点の選択列をすべて試しても、`harutoRoute` が変わらない。
- 標準ルート（§6.8）の計算が、プレイ中の周回の結果に影響しない。

### 12.3 E2E（フェーズ3）

- 4人それぞれで、16歳から35歳まで通しでプレイできる。
- 「すぐに閉じる」で `exitUrl` に移動し、ブラウザの「戻る」で戻れない。
- キーボードだけで1章を終えられる。
- 2周目の「同じ偶然で、条件だけ変える」で、比較画面に差分が出る。

---

## 13. デプロイ

### 13.1 手順

- Claude Code は `npm run build` で `dist/` 一式を用意するところまでを行う。
- アップロードは発注者が行う（付録A-9）。FTP を使う場合は暗号化された接続（FTPS／SFTP）を使う。接続情報はリポジトリに置かない。
- GitHub Actions での自動デプロイは、発注者の指示があるまで作らない。

### 13.2 `.htaccess`（`public/` に置き、`dist/` にコピーされるようにする）

設定するヘッダー：
- `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=31536000`（HTTPS化の確認後に有効にする）
- ハッシュ付きの静的ファイルには長期キャッシュを付け、`index.html` は `no-cache` にする。

Vite がインラインのスタイルやスクリプトを出力しないように設定し、上の CSP で動くことを確認する。

---

## 14. 作業フェーズと完了条件

### フェーズ1：基盤と最初の2章

- §4 の構成、§5 の型とスキーマ、§6 のエンジン、§12.1 の検証、§12.2 の単体テストを作る。
- 画面：7.1、7.2、7.3、7.4、7.5、7.6、7.7、7.11、7.12、7.14、クイック退出。
- コンテンツ：`characters.yaml`、`conditions.yaml`、`stats.yaml`（S01〜S27をすべて）、`resources.yaml`、`config.yaml`、16歳と17歳の全イベント（下書き、`status: draft`）。
- 完了条件：`npm run validate` と `npm test` が通る。4人それぞれで17歳の章末ふりかえりまで遊べる。確率カードと要因分解が表示される。

### フェーズ2：全章と比較

- 19〜35歳の全イベント（下書き）、§10.4 の全確率ノード。
- 画面：7.8、7.9、7.10、7.13。§6.8 の標準ルート。
- 完了条件：4人それぞれで35歳まで遊べる。2周目の比較画面で、同じ偶然・条件1つ変更の差分が出る。§12.1 の到達性検証が通る。

### フェーズ3：品質と公開準備

- §9 のアクセシビリティ対応と確認、§12.3 の E2E、§13.2 の `.htaccess`。
- 完了条件：E2E がすべて通る。CSP の下でコンソールにエラーが出ない。`ALLOW_UNVERIFIED` なしの本番ビルドが、§15 の TBD がすべて解消されれば通る状態になっている。

各フェーズの最後に、`status: draft` のイベント一覧と、未解消の TBD 一覧を `REPORT.md` に出力する。

---

## 15. TBD一覧（Claude Code は値を埋めない）

| # | 項目 | 仮置きの方法 |
| --- | --- | --- |
| T1 | サブドメイン名、サイト名、`<title>`、OGP画像 | `config.yaml` に `siteName: "（仮）SRHR Japan 学習コンテンツ"` |
| T2 | 配色・タイポグラフィの最終値、ロゴ | §16 の暫定トークンで作り、CSS変数1か所で差し替えられるようにする |
| T3 | パラメーター変動幅（S/M/L）と人物の初期値 | §2.2・§10.1 の値 |
| T4 | 社会条件 `partnership` の既定値と根拠統計 | **解消（付録A-17）**：既定値は byResidence、根拠は S29 |
| T5 | S17 の35歳以降の年齢別生産率 | `p35: 0.30`、`verified: false` |
| T6 | CH-LBW のやせ補正 | **解消（付録A-21）**：S30 にもとづく補正 |
| T7 | 統計の未収集：子宮頸がん検診の受診率、月経のつらさと労働、パートナーシップ制度、たばこ・飲酒・薬物、メンタルヘルス | 統計カードなし。該当イベントの `statCard` は空にする |
| T8 | 二次資料の原典確認：S10, S12, S13, S15, S17, S21, S22, S26 | `verified: false` |
| T9 | 加害者向けの公的な相談先（E21-HARUTO-REFLECT） | 本文で特定の窓口名を出さない |
| T10 | 同性カップルが子どもを持つ際の制度の記述（E27-YU-FAMILY） | `status: draft` のまま。制度の具体名を書かない |
| T11 | 緊急避妊薬の販売薬局一覧と、性と健康の相談センター一覧のURL | リンクなしで名称だけ表示する |
| T12 | 監修者名と監修体制 | 「このサイトについて」に「監修：準備中」 |
| T13 | 各人物の標準ルート（canonical）で選ぶ選択肢 | Claude Code が下書きで指定し、`REPORT.md` に一覧化する |
| T14 | アバターに表情を持たせるか（目と口の線のみ） | 表情なし（§16.3） |
| T15 | 加齢をアバターで表すか（章ごとに輪が増える年輪型） | 年齢は数字の表示だけ（§16.3） |
| T16 | パステルからSRHR Japanへの著作権譲渡の契約（著作権法27条・28条の権利を含む旨の明記、著作者人格権の不行使） | 契約で定める。リポジトリには書かない（§17） |
| T17 | 心理的安全（psychSafety）の各人物の初期値 | 各人物の safety と同じ値（付録A-13） |
| T18 | 「他者の行為」の表示色・模様 | 色 #6B5B95・横じま（T2 と同じく暫定） |
| T19 | 19歳のハルトの決定（CH-HARUTO19）の基本の確率：19歳のミナミに合う群（大学生の女性）の「身体的・性的な被害を含む割合」 | いまは S07（確認済み）の66.9〜77.0%の残り23.0〜33.1%のうち、低いほうの23.0%を使う（付録B-35）。『「若者の性」白書－第9回 青少年の性行動全国調査報告』（小学館、2025年）で群ごとの値を確かめたら、S35 の値を直して `verified: true` にし、CH-HARUTO19 の base と統計カードを S35 に戻す |

---

## 16. ビジュアル・UI仕様

### 16.1 トーン

- ゲームライクにする。画面は「HUD（常時表示の情報）＋本文パネル＋選択肢カード」で構成し、カードとボタンで軽快に進む。
- 写実的な人物、写真、リアルなイラストは使わない。人物は §16.3 の抽象アバターだけで表す。
- 性・暴力を扱うため、ゲーム的な派手さは演出の速さと手触りで出し、刺激の強さでは出さない（§16.6）。
- 音は一切出さない。周囲に気づかれないため（P5）。

### 16.2 画面の基本構成（スマホ縦向きが基準）

| 位置 | 要素 |
| --- | --- |
| 上端（固定） | 左：年齢と章名。右：「すぐに閉じる」ボタン |
| 上端の下（固定） | 5パラメーターのミニゲージ（横棒5本、ラベル付き）。タップで章のふりかえりの途中経過を開く |
| 中央 | 本文パネル。話者のアバター（小）＋名前＋本文。視点切替のあるイベントでは、パネル上部にタブ |
| 下部 | 選択肢カード（縦に2〜3枚、1枚の高さ56px以上、全幅） |

- デスクトップでは、中央に最大幅480pxの列として表示し、左右は背景色で埋める。
- 「すぐに閉じる」ボタンは文字で表示する（アイコンだけにしない）。他のどのボタンより高いコントラストにし、どの画面でも同じ位置に置く。

### 16.3 アバター（周回ごとの自動生成＋任意の再生成）

**生成方法**
- 入力は `seed`・`characterId`・`avatarSalt`（初期値0）の3つだけ。**性別・性的指向・生育条件は入力しない。** 見た目と属性が結びつかないことを、入力の段階で保証する。
- `hash(seed + ':' + characterId + ':' + avatarSalt)` から、次の要素を決定的に選ぶ。
  - 基本形状：円、角丸四角、六角形、しずく形、角丸三角、楕円の6種
  - 塗り色：§16.4 のアバター用パレット10色から1色
  - 模様：無地、ストライプ、ドット、同心円、斜め格子の5種（模様色は塗り色の明度違い）
  - 傾き：−12〜＋12度の範囲で5段階
- 4人の塗り色は、色相環上で互いに30度以上離れるようにする。条件を満たさない場合は、内部でソルトを進めて決定的に再抽選する。
- SVGをコードで組み立てる。画像ファイルは使わない。

**性別記号の排除**
- 形状・模様に、リボン、ひげ、まつげ、髪型、ハート、性別記号を連想させる要素を入れない。
- パレットに、ピンクと水色の組み合わせのような、性別を連想させる色の対を入れない（§16.4）。
- テスト：全キャラクター×多数のシードで生成し、性別ごとの色相・形状の分布に偏りがないことを確認する（入力に性別を含まないので構造上は偏らないが、回帰テストとして置く）。

**「見た目を変える」ボタン**
- 主人公選択の画面で、各人物のカードに1つずつ置く。押すと、その人物の `avatarSalt` を1増やして再生成する。
- 押さなくても進める。必須の操作は0回とする。
- 選んだ結果は `RunState.avatarSalts` に保存し、その周回のあいだは固定する。2周目では、「同じ偶然で」を選んだ場合はソルトも引き継ぐ。

**表情と加齢**
- 表情：持たせない（T14）。感情は本文と、本文パネルの背景色の明度で表す。
- 加齢：アバターでは表さない（T15）。章トップとHUDに年齢を数字で表示する。

**アクセシビリティ**
- アバターは装飾として扱い（`aria-hidden="true"`）、名前を必ずテキストで併記する。

### 16.4 配色（暫定トークン。最終値はT2）

UIの基本色：

| トークン | ライト | ダーク | 用途 |
| --- | --- | --- | --- |
| `--bg` | #F7F6F2 | #17181C | 背景 |
| `--surface` | #FFFFFF | #22242A | パネル・カード |
| `--text` | #1E1F24 | #ECECEF | 本文 |
| `--text-sub` | #5B5E66 | #A9ACB4 | 補足 |
| `--accent` | #3D5A80 | #8FB0D9 | 選択肢の枠、フォーカス |
| `--exit` | #B42318 | #FF6B5E | 「すぐに閉じる」 |
| `--caution-bg` | #F3EFE3 | #2A2720 | トリガー注意の画面 |

アバター用パレット（10色）：#E0A526、#2A9D8F、#7A9E3B、#C0563A、#3D5A80、#8D6E63、#4F4F4F、#D4A373、#5E8C61、#9C6644。ピンク系と水色系は入れない。

4要因の表示（色と模様を必ず併用する）：

| 要因 | 色 | 模様 |
| --- | --- | --- |
| 選択 | #3D5A80 | 塗りつぶし |
| 生育条件 | #9C6644 | 右上がりの斜線 |
| 社会条件 | #2A9D8F | ドット |
| 偶然 | #E0A526 | 斜め格子 |

5パラメーターの折れ線は、色に加えて線種（実線、破線、点線、一点鎖線、二点鎖線）と、線の端のラベルで区別する。

### 16.5 タイポグラフィ

- システムフォントのみ：`system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif`。
- 本文16px（大きい表示では19px）、行間1.8。見出し20〜24px。選択肢17px。
- 数字を見せる箇所（確率、統計、ゲージ）では `font-variant-numeric: tabular-nums` を使う。

### 16.6 演出

| 場面 | 演出 | 時間 | `prefers-reduced-motion` のとき |
| --- | --- | --- | --- |
| 選択肢を押したとき | カードが押し込まれ、次の本文がフェードイン | 200ms | 即時に切り替える |
| パラメーターの変化 | ミニゲージが伸び縮みし、変化量（例：+10）を1秒表示 | 300ms | 数値の表示だけ |
| 確率カード | ゲージが最終確率まで伸び、針が `u` の位置で止まって結果を出す | 800ms | 結果を即時表示 |
| 章クリア | 章名と年齢がカードで切り替わる | 400ms | 即時に切り替える |

- 点滅、画面の揺れ、赤いフラッシュは使わない。暴力を扱うイベントでは、パラメーターの減少を強調する演出も使わない。
- トリガー注意のあるイベントの間は、本文パネルの背景を `--caution-bg` にする。

---

## 17. 権利

- **著作権の帰属：** 本プロダクトのソースコード、アバター生成ロジック、デザイン、シナリオ本文、その他の成果物の著作権は、一般社団法人SRHR Japanに帰属する。制作者（株式会社デザインスタジオパステル）からの権利譲渡は、別途契約で定める（T16）。
- **リポジトリ：** オープンソースにしない。`LICENSE` には「Copyright (c) 2026 SRHR Japan. All rights reserved.」と記載する。ソースファイルに個別のライセンスヘッダーは付けない。
- **サイト上の表記：** フッターに「© 2026 一般社団法人SRHR Japan」と記載する。
- **第三者の素材：** 画像、イラスト、アイコンフォント、Webフォントを使わない。アイコンはSVGで自作する。既存のキャラクター、ゲーム、ブランドの意匠を参照・模倣しない。
- **依存パッケージ：** ライセンスは MIT、BSD、Apache-2.0、ISC のみ許可する。GPL系は入れない。`npm run licenses` で一覧を `THIRD_PARTY_NOTICES.md` に出力し、許可外のライセンスがあればビルドを失敗させる。
- **統計の引用：** 数値と、出典名・URL・年度だけを載せる。調査報告書の文章や図表は転載しない（日本性教育協会のジャーナルは無断転載禁止を明記している）。
- **AI生成物の扱い：** Claude Code が生成したコードと本文は、パステルの指示・選択・修正のもとで作る。シナリオ本文を `status: reviewed` にする際は、人が改稿する。アバターの形状とパレットはパステルが決定した値を使う（§16.3・§16.4）。

---

## 付録A　フェーズ1着手時の確認事項（2026-10-20 発注者確認済み）

本文の仕様にない点を、フェーズ1の着手前に確認して決めたもの。本文と同じ効力を持つ。

| # | 項目 | 決定 |
| --- | --- | --- |
| A-1 | 選択肢のない分岐 | Scene に `branches: [{ when, next }]` を置ける。上から順に評価し、最初に当てはまった `next` に進む。どれにも当てはまらなければ `next` に進む |
| A-2 | 視点切替イベントの組み方 | 1つのイベントに、視点ごとのシーン列を持たせる。`viewpointSwitch.entry` に各視点の入口のシーンIDを書く。視点切替イベントのシーンには `viewpoint` が必須で、別の視点のシーンには `next` で進めない。主人公の視点のシーン列を最後まで読むとイベントが終わる。読まなかった視点の残りは canonical の選択肢で解決し、フラグだけを反映する（効果は付けない） |
| A-3 | 17歳でのハルトの選択 | `flags.harutoControl17`（`'continued'` か `'stopped'`）に記録する。`harutoRoute` は19歳（E19-MH-ESCALATE）で決める。`harutoControl17` も `harutoRoute` と同じく、ハルトの視点のシーンからだけ書き換えられる（P7） |
| A-4 | 「この章を読まずに進む」の要因 | 各効果の YAML 上の要因をそのまま記録し、記録に `skipped: true` を付ける。読まずに進んだ章では統計カードを出さない（相談窓口の案内は A-11） |
| A-5 | 社会条件で決まるフラグ | `conditions.yaml` の各選択肢に `setFlags` を書く。イベントの `applyConditionFlags` に条件IDを書くと、そのイベントの開始時に反映する（`sexEducation` は E16-ALL-SEXED で反映） |
| A-6 | 到達性の検証の範囲 | フェーズ1では、いまある最後の章のふりかえりまで到達できることを検査する。16〜35歳の全章がそろっていることの検査（`requireAllChapters`）は、フェーズ2で有効にする |
| A-7 | 文字数の上限 | シーン本文 200字（超えると警告）、選択肢 30字（超えると警告）、効果の `note` 20字（超えるとエラー）。ルビ `{漢字\|かんじ}` は親文字だけを、1文字＝コードポイント1つとして数え、改行は数えない。定義は `src/engine/limits.ts`。確率ノードの modifier の `note` も20字以内 |
| A-8 | その他 | 確率ノードの結果効果は `source` を省略でき、省略時は `chance`。`chance` 以外を書くとエラー。米国データ（`jpData: false`）の統計カードは「米国では、〜」の文型にする。章ごとのファイルに `title`・`season`・`intro`（主人公ごとの状況）・`status` を置く。イベントの `resources` に相談窓口のタグ（`violence`／`ec`／`health`）を書くと、イベント後の統計カードの画面に該当する窓口を出す。E17-YU-SEXTING の選択肢の例「送ってしまう」は、§11-5 に合わせて「画像を送る」とする |
| A-9 | サーバーとアップロード | サーバーはさくらインターネット（`srhr.jp` と同じ）。Claude Code は `dist/` を用意し、アップロードは発注者が行う。§13.2 の `.htaccess` がさくらで効くか（特に `Header` 指令）は、フェーズ3で実機で確認する |
| A-10 | 統計カードの文（2026-10-20 追加） | `stats.yaml` の各統計に `cardText` を置き、統計カードには `cardText（統計ID、年度）` を出す。`value` は §10.5 の表の写しのまま残す（出典ページで使う）。`cardText` は「日本では、」（`jpData: false` は「米国では、」）で始め、自然な文にする。書ける数字は、その統計の `value`・`definition`・`label` にある数字だけとし、検証で落とす |
| A-11 | 読まずに進んだ章の相談窓口（2026-10-20 追加） | 読まずに進んだ章のふりかえりに、その章のイベントの `resources` のタグに当たる相談窓口を出す。案内は前向きな言葉にする（例：「ひとりで抱えなくて大丈夫です」）。イベント後の相談窓口の案内も同じ言葉にそろえる |
| A-12 | 人物の profile（2026-10-20 追加） | 性別は「男性」「女性」と書く。「男の子」「女の子」は使わない（対象に20代を含むため） |
| A-13 | パラメーター「心理的安全」（2026-10-20 追加） | 6つ目のパラメーター `psychSafety`（表示名：心理的安全）を、安全の次に置く。初期値は TBD（T17）で、各人物の `safety` と同じ値を仮置きする。HUD・ふりかえり・グラフはパラメーター一覧から自動で描く |
| A-14 | 要因「他者の行為」（2026-10-20 追加） | 5つ目の要因 `others`（表示名：他者の行為）を置く。加害による変化（例：交際相手からの束縛で心理的安全が L 下がる）と、周りの人の介入・支援による変化（例：友人や養護教諭が受け止める）の両方を記録する。加害による変化を、被害者の `choice` として記録しない（P2）。制度の有無による変化は `society`、本人が相談したことは `choice` のまま。要因分解のグラフでは、同じ要因の増えた分と減った分を相殺せずに、中心線の左右に分けて描く。ChanceModifier の source にも使える。表示色・模様は T18 |
| A-15 | シーンに入ったときの効果（2026-10-20 追加） | Scene に `effects` を置ける。イベントの開始時と `next` による移動でシーンに入ったときに、主人公の視点のシーンでだけ適用する。視点を切り替えて戻ったときには再び適用しない。選択と関係なく起きる変化に使うため、`source: choice` は書けない（検証で落とす）。読まずに進んだ章でも適用し、`skipped: true` を付ける |
| A-16 | 統計 S28（2026-10-20 追加） | 発注者の承認を得て §10.5 に S28 を追加した。E16-YU-HPV は、自分で調べて S28 の事実に触れたうえで「受ける／今は受けない」を決める流れにし、受けた場合に `body` を S 上げる（statRef: S28）。親に任せた場合は、母の決定を「他者の行為」として記録する。受けない選択に負の効果を付けない |
| A-17 | パートナーシップ制度と居住地（フェーズ2） | 24歳（E24-YU-WORKPLACE）でユウが住む場所を選ぶ。「制度のある自治体を選んで住む」か「いまの地域で暮らす」。確率ノード CH-RESIDENCE（base 0.925、S29）で、住む自治体に制度があるかを決める。選んだ場合は1.0（要因：選択）。社会条件 `partnership` は `byResidence`（既定）／`available`（1.0、要因：社会条件）／`notAvailable`（0、要因：社会条件。このとき「選んで住む」は出さない）。30歳の場面は `flags.partnershipLocal` で分かれる |
| A-18 | ケイの父親ルートの時期（フェーズ2） | CH-PARTNER-WORK（S20）は、第1子の出産の時期に合わせて、24歳（E24-KEI-WORK）の父親ルートで判定する。E30-KEI-WORK は確率を使わない fixed にする。S20 は「妻」のデータだが、結婚しているかに関わらずケイのパートナー（サキ）に当てはめる解釈とし、「このサイトについて」に明記する |
| A-19 | 群像劇の一貫性（フェーズ2） | 他の主人公の標準ルートでは、視点切替のあるイベントについて、プレイヤーがその周回で選んだ選択を canonical より優先する（`pinnedChoices`）。例：ハルトで19歳に「振り返る」を選ぶと、ミナミの標準ルートでもつきまといは起きない。そのため標準ルートは、プレイ開始時ではなく全体のふりかえりを表示するときに計算する（乱数を消費しないので結果は同じ）。周回の記録 `choices` に、選んだ選択肢を残す |
| A-20 | 比較の「差が開いた章」（フェーズ2） | いずれかのパラメーターについて、2つの周回の差（の絶対値）が前の章より M（10）以上広がった章を強調する。強調しない章でも、要因・確率・出来事に違いがあれば一覧に出す |
| A-21 | 低出生体重とプレコンセプション（フェーズ2） | S30 を追加し、CH-LBW に補正を入れる。条件は16歳の「食事をさらに減らす」（`flags.minamiExtremeDiet`）。ダイエット全般ではなく、極端な食事制限だけを条件にする（ダイエットをする人へのスティグマを避ける）。値は、基本の確率9.8%のオッズにオッズ比1.61を掛けた約14.9%（`set 0.149`、解釈として明記）。要因は選択。出産そのものと、低出生体重という結果では、パラメーターを動かさない |
| A-22 | 不妊治療の負担（フェーズ2） | S31 を追加。治療を始めるときと「続ける」を選ぶたびに、からだ −S（選択、S31）と選択肢の幅 −S（社会条件、S31）を付け、各回の本文で、通院・投薬による体調や体力の負担を説明する。結果（出産に至ったか）には増減を付けない |
| A-23 | トリガー注意の追加（フェーズ2） | E21-KS-PREGNANCY（妊娠と人工妊娠中絶）と E35-MINAMI-ART（不妊治療）にも、トリガー注意を出す |
| A-24 | ハルトの19歳の標準ルート（フェーズ2） | E19-MH-ESCALATE のハルトの canonical は「相手のせいにする」（`harutoRoute: 'continued'`）。視点を切り替えずにミナミで遊ぶと、21歳でつきまといの場面が出る |
| A-25 | §10.3 の例からの変更（フェーズ2） | 選択肢の例「一人で耐える」は「今は、誰にも話さない」、「我慢する」は「今は、誰にも言わない」「今は、このまま様子を見る」にした（§11-3・§11-5）。E19-YU-COMINGOUT の前に、ユウが自分を表す言葉を選ぶ場面（3つの選択肢、すべて neutral）を置いた（§11-6）。E35-HARUTO-CYCLE は §10.3 で選択肢が「―」だが、パラメーター（safety、connection）を本人の行動で動かすため、2つの選択肢を置いた（要確認）。統計の未収集（T7）のイベントは `statCard: []` |
| A-26 | 終えた周回の保存（フェーズ2） | 比較のために、終えた周回を最大6件、進行状況と同じ保存先に残す。「すぐに閉じる」では sessionStorage から消す。RunState の version は 3 |
| A-27 | サイト内の移動と履歴（フェーズ3） | サイト内の移動（ボタン・`#/` のリンク）は `location.replace` で行い、ブラウザの履歴を増やさない。履歴が残ると、「すぐに閉じる」のあとで「戻る」を押したときに、このサイトの前の画面に戻れてしまうため（§8.1）。そのかわり、サイト内ではブラウザの「戻る」で前の画面に戻れない |
| A-28 | セキュリティヘッダーの定義（フェーズ3） | §13.2 のヘッダーの値は `scripts/lib/security-headers.ts` で定義し、`public/.htaccess` と `vite preview` で同じ値を使う（一致はテストで確認）。E2E は、このヘッダーの下でプレビュー用のビルドを動かし、コンソールにエラーが出ないことを確かめる。`.htaccess` は `<IfModule mod_headers.c>` で囲む。サーバーでヘッダーが付いているかは、アップロード後に `curl -I` で確かめる |
| A-29 | アクセシビリティの検査方法（フェーズ3） | axe-core はライセンスが MPL-2.0（§17 の許可外）のため使わない。配色トークンのコントラスト比（本文4.5:1、図・枠3:1）をテストで検査し、キーボード操作・横スクロール・フォーカス表示を E2E で確かめる。視点の切り替えは、矢印キーの操作を持たない tab ロールではなく、押し込み状態（aria-pressed）のボタンにする。要因分解の棒には輪郭を付ける（黄色などの塗りは背景との比が3:1に届かないため） |

---

## 付録B　体験の再設計（2026-10-21〜、発注者確認済み）

フェーズ3までの版をスマホで試した結果、「読まされているだけでゲームになっていない」との評価を受け、体験を再設計する。決定は確認のたびにここへ追記する。本文と同じ効力を持ち、本文の該当箇所より優先する。

| # | 項目 | 決定 |
| --- | --- | --- |
| B-1 | 人物と背景のグラフィック | ドット絵風の人物と背景を、コードで計算して描く（手続き型の生成。光と影、年齢による頭身と服、表情、時間帯、まばたき・呼吸）。§16.1・§16.3 の「抽象アバターだけ」、T14（表情なし）、T15（年齢は数字だけ）を置き換える。画像ファイル・第三者の素材は使わない（§17 は維持）。色・人物の特徴・構図はパステルが選んで決める。髪型や服装で性別のステレオタイプに寄せないことを、監修で確認する |
| B-2 | 場面の形式 | 会話中心にする。相手のセリフと主人公の「心の声」で語り、1タップで1つの吹き出し（40字ほど）を出す。選択肢は主人公が言うセリフや行動にし、選んだ直後に表情と心の声で反応を返す。P7 のため、ミナミの選択への反応でハルトの行動は変えない |
| B-3 | パラメーターの表示 | 画面上部のゲージ6本は常には出さない。変化したときだけ小さな通知（例：「自己決定 +10 ・ 選択」）を出し、小さなボタンからいつでも開けるようにする（§16.2 の変更） |
| B-4 | 統計カード | 場面の中では出さず、章のふりかえりで必ず出す（§7.6 の変更） |
| B-5 | 脇役の名前 | 友だち・先生などの脇役にも名前を付ける（例：ミナミの友だち「リコ」）。名前の一覧は REPORT.md に出して確認を受ける |
| B-6 | 1章の長さ | 吹き出し20〜30個、3〜5分で遊べる長さを目安にする |
| B-7 | 人生のアルバム | 全体のふりかえりの中心を、年齢ごとのドット絵のアルバムにする（場所、近況、「あなたが言ったこと」、起きたこと、まわりの人との距離）。プレイ中も小さなボタンから開ける。パラメーターの折れ線グラフは「数字で見る」を押したときだけ出す（§7.8 の変更） |
| B-8 | 幕間 | 章と章のあいだに、時間が流れる演出を入れる。経過年数の表示、次の場所への背景の切り替え、成長した人物、近況1行 |
| B-9 | 人との距離 | 脇役ごとの「近さ」（0〜3）を、選択や出来事で変える。物語を見せるためのもので、6つのパラメーターと要因分解（P2）には含めない。表示の言葉で「つながり」と区別する |
| B-10 | 新しい脇役（仮） | ミナミのパートナー「ソウ」、ミナミの同期「ユキ」。B-5 の一覧に含めて確認を受ける |
| B-11 | 相手の視点 | 主人公の場面が終わったあとに「そのころ、〇〇は……」と出し、プレイヤーが「のぞいてみる」を押したときだけ読む。主体的に選ぶ行動として促し、読む情報の量をプレイヤーに委ねる。相手の視点には選択肢を置かない（相手の選択は、その人物で遊ぶときに選ぶ）。§6.7 の視点切替タブを置き換える |
| B-12 | ハルトの行動の決め方 | ハルト以外の人物で遊ぶとき、ハルトの暴力が19歳で激しくなるか（E19）と、別れたあともつきまとうか（E21）を、確率ノードで決める。確率カードでは「ハルトの決定（統計にもとづく）」と表示する（サキの決定と同じ扱い）。確率を変える要因は、社会条件と生育条件だけにし、ミナミの選択は入れない（P7）。ハルトで遊ぶときは、プレイヤーの選択で決まる。根拠の統計は Claude Code が調べて候補を示し、発注者が採否を決める |
| B-13 | ハルトの行動の確率の置き場所 | ハルト以外の人物で遊ぶとき、確率で決めるのは19歳（E19）の1か所だけにする。19歳で暴力が身体的・性的なものに進んだ場合だけ、21歳でつきまといが起きる（21歳は19歳の結果に従う）。21歳の割合の統計が見つかれば、確率を足せる |
| B-14 | 19歳の基本の確率 | S07 から求めた「デートDVの被害を受けた人のうち、身体的・性的な被害を含む人の割合」（23.0〜33.1% のうち、19歳のミナミに合う群の値。原文で群ごとの値を確認する）を使う。求め方は「解釈」として「このサイトについて」に明記する。補正に使う要因（社会条件・生育条件）は検討中 |
| B-15 | 19歳の確率の補正 | 国内に使える統計がないため、海外のデータに依拠する（`jpData: false`、原文で確認するまで `verified: false`）。補正は2つ。生育条件「親のあいだの暴力を見て育った」：オッズ比1.92（アフリカ48研究のメタ解析、2024年、男性）。社会条件「学校でデートDVを学んだ」：オッズ比約0.75（38研究のメタ解析の効果量0.157を換算、Lee & Wong 2020）。性教育の重要性と、教師が関わることの意味を伝えるため、研究によって結論が分かれることを明記したうえで入れる。換算の方法は「解釈」として「このサイトについて」に明記する。国内の事例研究（法務省掲載、DV加害者62件中11件が親の間の暴力を見て育った）は、統計カードの補足に使う候補 |
| B-16 | 画面の中の「戻る」 | ブラウザの「戻る」は使わないまま（§8.1・付録A-27）、吹き出しの左上に「◀ 戻る」を置く。その章の吹き出しを読み返せ、直前の選択だけ選び直せる（パラメーターの変化も取り消す）。それより前の選択は変えられない。別の選択を試したい場合は2周目で受け止める |
| B-17 | 注意書きと場面の飛ばし（P4 の変更） | 章ごとのトリガー注意はやめる（注意書きは、場面を見たあとのつらさを減らさず、見る前の不安を高めるとするメタ解析〔Bridgland ほか 2023〕を踏まえる）。代わりに、どの場面にも同じ「この場面をとばす」ボタンを目立たない形で置く（ボタンの有無で内容を予告しない）。とばした場面は「この場面で起きたこと」を1行で伝え、効果は本来の要因のまま `skipped: true` で記録する（付録A-4 と同じ扱い）。扱う内容の全体は「はじめに」で一度だけ短く伝える。暴力の行為を描写しないこと、「すぐに閉じる」は変えない。§6.2-3 の「この章を読まずに進む」は、場面単位の「とばす」に置き換える |
| B-18 | 相談先の位置づけ | 相談先は、暴力の被害だけでなく、プレコンセプションケア・SRHR 全般の幅広い支援（産婦人科、ユースクリニック、悩み相談チャット、検査、性のあり方、妊娠・不妊など）を示す。全国で使えるものを中心にし、地域ごとにあるものは一覧の探し方（地図・まとめのページ）を載せる。支援先は Claude Code が公式の名前・連絡方法・対象・確認元 URL をそろえて候補を示し、発注者が採否を決める。公開直前に公式ページで再確認する（§10.6） |
| B-19 | 相談先の入口と画面 | ゲームの画面の外（いちばん下）に、ゲームとは違う落ち着いた見た目で「私も相談したいことがある」を置き、ゲームを閉じずに開ける。開いた先の見出しは「話せる場所」とし、カテゴリはすべて閉じたアコーディオンで並べる。カテゴリ名は強い言葉を避け、本人の気持ちに近い言い方にする（窓口の正式名は開いたときに初めて出す。P5）。カテゴリは8つ：からだのこと／妊娠かもしれない／検査を受けたい／好きになる人や、自分の性のこと／付き合っている人や、家族との関係／嫌なことをされた・されそうになった／こころがしんどい・話を聞いてほしい／妊娠・不妊・これからの家族 |
| B-20 | 暴力の場面のあとの支援 | 暴力全般（交際相手からの暴力、つきまとい、家庭の中の暴力、性的な被害）の場面のあとには、必ず短い支援のカードを1枚出す（関係する窓口を2つほどと「ほかの相談先」）。場面を「とばした」場合も出す。§10.6 の「イベントの後の窓口の一覧」を置き換える。それ以外の場面のあとには、相談先を自動で出さない |
| B-21 | 相談先の採否 | docs/support-candidates.md の候補をすべて採用する。地域ごとにしかない窓口（ユースクリニック、ヤングケアラーの相談など）は、探し方に加えて地域の例（東京都の「わかさぽ」など）も載せ、「地域：東京都」のように示す。対象が限られる窓口は「対象：女性」「18歳まで」などのラベルを付ける。「二次」の確認状態のものは、公式ページで確認してから `verified: true` にする |
| B-22 | 名前 | サイトの名前は「SRHR U35 SIMULATOR」（T1 のサイト名・`<title>` を解消。サブドメイン名・OGP 画像は未定）。§8.2 の「内容を推測されにくい `<title>`」より、発注者の決定を優先する |
| B-23 | 人生の流れの俯瞰 | 「人生の地図」を置く。16〜35歳の8つの章を並べ、過ぎた章はその年齢の姿・場所・近況・自分が言ったこと（選んだセリフ）を、まだ来ていない章は伏せて見せる。幕間と章のふりかえりには横一列の小さな地図、プレイ中は「記録」ボタンから、全体のふりかえりでは全体を出す（B-7 のアルバムをこの形にした） |
| B-24 | オンボーディング | 「はじめに」を3段にする。タイトル（4人のドット絵、名前、ひとこと）→ あそびかた（選ぶ・5つの要因・20年をふりかえる）→ 安心して遊ぶために（すぐに閉じる・とばす・保存・話せる場所）。出典の方針などの説明は「このサイトについて」に移す。主人公を選ぶ画面は、各人物の暮らしの場所に立つドット絵にし、「見た目を変える」はやめる（§16.3 の自動生成アバターは使わない） |
| B-25 | 章のふりかえり | 「あなたが選んだこと」（選んだセリフ）、「変わったこと」（パラメーターごとに増減と理由を要因の色帯つきで）、「そのころ、ほかの3人は」（標準ルートでの近況と選んだこと）、「この章に関係するデータ」を出す。グラフと表は「グラフと表で見る」を開いたときに出す |
| B-26 | 年齢相応の言葉づかい | 若い登場人物どうしの会話や心の声では、医学用語（例：腟外射精）を使わず、その年齢の人が実際に使う言い方にする（例：「外に出せば大丈夫」）。先生の授業での説明と、統計カードでは正式な用語を使ってよい |
| B-27 | 会話を積み重ねる | 吹き出しを1つずつ消して出す形をやめ、メッセージアプリのように、同じイベントの中の会話を下に積み重ねて見せる。主人公のセリフは右、相手は左、心の声は点線の枠、地の文は中央。話している人の顔アイコン（ドット絵の切り出し）を添える。最新の行は文字が流れるように出す（演出を減らす設定では一度に出す）。絵とステータスは画面上部に固定する |
| B-28 | パラメーターの変化を感じられるように | 絵の下に、6つのパラメーターのアイコンと小さなゲージをいつも出す（B-3 の「常には出さない」を変更）。変化したアイコンは光らせる。選んだ直後には、絵の上に「変化カード」を出す（アイコン、もとの値から新しい値へ伸び縮みするゲージ、増減、理由を要因の色帯つきで）。カードは次へ進むか「閉じる」で消える |
| B-29 | パートナーや家族を絵に出す | 17歳以降のすべてのイベントに舞台を設定し、パートナー（サキ、アオイ、ソウ、ナオ）や子どもを描く。パートナーは主人公と一緒に年をとり（`peerOffset`）、子どもは生まれた年から数える（`bornAt`）。条件で登場を変えられる（例：ケイが父親になったときだけサキと子どもを描く。`stage.cast[].when`）。脇役の名前は仮（B-5） |
| B-30 | 性交渉と自己決定 | 「するかどうか」「どう決めるか」を描く。行為は描かず、前後の会話・心の声と暗転で描く（P4）。17歳（高校生）から入れる。するか・しないかに正解はなく、どちらも負の効果を付けない（P1・P6）。パラメーターは決め方（同意を確かめた、気持ちを言えた、避妊を二人で話し合えた、「したくない」と伝えた）に付ける。押し切られた側の変化は「他者の行為」（P2）、押し切った側には学び直す選択肢を置く（§11-4）。安心・親密さ・楽しさといった肯定的な面も描く（ITGSE）。ユウの同性どうしの関係でも描く。同意は、決まった言葉で確かめる手続きではなく、ふだんのやりとりの中で、相手の様子や気持ちを気にかけ合うこととして描く。お酒の有無で同意の可否を決めつける表現はしない（飲み会を性交渉の機会として描かない。2026-10-21 追記）。この場面のための統計は Claude Code が調べて候補を示し、発注者が採否を決める |
| B-31 | 17歳の性交渉の場面と「のぞいてみる」の実装 | E17-MH-TALK「するかどうか」を、束縛（E17-MH-CONTROL）の前に置く。ミナミで遊ぶとき、ハルトはどの答えでも同意を確かめる（標準ルート。P7）。ハルトで遊ぶとき、ミナミの答えは「まだ、したくない」に固定する（標準ルートの根拠は S05）。相手の側の会話が食い違わないよう、ハルトの側はミナミの答え（`minamiFirst17`）、ミナミの側はハルトの選択（`harutoConsent17`。ハルトの視点からだけ書き換える）で続きを分ける。暗転は吹き出しの種類 `kind: fade` で表す。B-11 は、主人公の場面のあとに進行の段階 `peek` を置き、「〇〇の側を、のぞいてみる」を押したときだけ相手の会話を読む形で実装する（とばした場面・読まずに進んだ章では出さない）。統計カードの文は、tips として短くまとめる（2026-10-21） |
| B-32 | 19歳のハルトの行動（B-12〜B-15 の実装） | 基本の確率は S35 の下限23.0%を `verified: false` で仮置きする（群ごとの値を白書で確認したら差し替える）。補正はオッズ比としてオッズに掛ける（確率ノードの `op: odds`）：ハルトの生育条件（S36、1.92。ハルトの生育条件は固定のため、誰で遊んでも必ずかかる）、社会条件「学校で学んだ」（S37、0.75）。「ハルトの決定」の確率ノード（`actorLabel` がハルトで始まる）は、ハルト以外の視点からハルトのフラグを決めてよいが、確率を変える要因に選択（flags）を使えない（検証で止める）。ハルトで遊ぶときは確率を使わない。標準ルートでは、ハルトの行動を1つにそろえる（ハルトで遊ぶときはプレイヤーの選択を、ほかの人物で遊ぶときはミナミの側で決まった結果を使う）。ユウは19歳でアオイと付き合い始め、手をつなぐときの同意を前向きな場面として描く。性感染症の予防は21歳で扱う。ケイは19歳で、サキと避妊を二人で決める場面を、避妊のトラブルの確率の前に置く（2026-10-21） |
| B-33 | 日ごろの生活とプレコンセプションケア | 食生活・喫煙・飲酒・葉酸を扱う（S38〜S42。T7 のうち、たばこ・飲酒を解消）。21歳：4人とも、20歳を過ぎて最初の飲み会（自分のペースで飲む、飲まない・飲めない人に無理に勧めない、飲みすぎた友人を気づかう）。性的同意の話はつながない（B-30 の追記）。24歳：ミナミの忙しい日の食事（体型や体重への評価は書かない）、ケイが職場でたばこを勧められる（吸い始めた場合は、27・30歳で子どものそばでの喫煙と、やめるかどうかにつなげる）。27歳：ハルトとナオが子どもを持つことを話し始めたときに、葉酸と、ハルトのお酒・たばこの見直しを二人で考える（男性のプレコン）。ミナミの27歳にも葉酸の話を足す（2026-10-21） |
| B-34 | 人との距離（B-9 の実装） | 主人公ごとの近しい人を characters.yaml の `bonds`（はじめの近さ0〜3、登場する年齢、条件）に書く。ミナミ：リコ・ハルト・ユキ・ソウ、ハルト：ミナミ・ナオ・子ども、ユウ：母・アオイ、ケイ：妹・弟・サキ・子ども（父親の場合）。近さは選択（`choices[].closeness`）と、相手の行動（シーンに入ったときの `closeness`）で変わり、理由を1行付ける。6つのパラメーターと要因分解には含めず、数字は出さずに点の数で見せる（選んだ直後の通知、章のふりかえり、人生の地図、全体のふりかえりの同心円）。関係が終わった人（別れたなど）は `end` で点を消し、評価をつけずに「別れた」と書く。暴力の場面では、イベントに出る主人公どうしの近さを変えない（end だけ書ける。検証で止める）。保存データの version を5にした（2026-10-21） |
| B-35 | S35 の回避 | 白書の入手を待たずに公開できるよう、CH-HARUTO19 の基本の確率と19歳の統計カードの根拠を、S35（未確認の群ごとの値）から S07（確認済み）に付け替える。値は同じ23.0%（S07 の範囲の残りの低いほう）。S35 は表に残し、本文からは参照しない。あとから白書で確かめて戻す手順を T19 に記録する（2026-10-22） |
| B-36 | 4人を見分けやすくする持ち物 | 4人の外見が似ていて見分けにくいため、主人公ごとに持ち物を1つ描く。ミナミ：メガネ、ハルト：キャップ、ユウ：ヘッドホン（バンド好き）、ケイ：ニット帽。性別のステレオタイプに寄せない。頭のまわりに描き、顔アイコンに切り出しても見えるようにする。cast.yaml の `look.accessory` と `look.accent`（色）で指定する（2026-10-22） |
| B-37 | チェック用の限定公開 | `npm run build:check` で、本番ビルドに検索エンジン除け（meta robots、robots.txt、X-Robots-Tag）を付けた `dist/` と `srhr-check.zip` を作る。パスワード（ベーシック認証）はかけない（発注者の判断：インデックスされなければ、漏れても問題になる内容ではない）。推測されにくい名前のフォルダに置き、修正のたびに上書きでアップロードする。発注者がアップロードする。手順は docs/deploy-check.md（2026-10-22、10-23 改訂） |
| B-38 | GitHub Pages でのチェック用公開 | 発注者の判断で、チェック用の公開先を GitHub Pages にする（公開リポジトリ `srhr-u35-simulator`。ソースコードも公開になる）。main に送るたびに、GitHub Actions がテストと `npm run build:check` を実行して公開し直す（.github/workflows/pages.yml）。GitHub Pages では .htaccess が効かないため、CSP をページの中の meta に書く（frame-ancestors は meta では効かないため除く）。検索エンジン除けは meta robots で効く（X-Robots-Tag は付かない）。本公開（さくら）の手順は変えない（2026-10-30） |
| B-39 | 相談先の案内は画面の下だけ（B-20 の変更） | 暴力の場面のあとに必ず出していた支援のカードをやめる。相談先は、画面の下の「私も相談したいことがある」からだけ案内する（発注者の判断。2026-10-31） |
| B-40 | パラメーターの見せ方（B-28 の変更） | 名前・数字・ゲージを常に見せる。動いたときは、増減の数字が飛び出し、数字が数え上がり、ゲージが伸び縮みし、絵も反応する（下がると揺れ、上がると光る）。絵をふさぐ変化カードはやめ、理由はステータスのすぐ下に出す。演出を減らす設定では動きを止める（2026-10-31） |
| B-41 | 画面の幅 | 全体の幅を480pxから1120pxに広げる。幅900px以上では、左に絵とステータス、右に会話を置く。読むページは720pxまで（2026-10-31） |
| B-42 | 授業の場面 | 授業の内容を1行ずつ読ませない。知識は、あとの章で必要になった場面で、心の声として思い出す（2026-10-31） |
| B-43 | 主人公1人と属性の組み立て（全体の方向転換） | 主人公は1人にし、属性を選んで組み立てる。性自認は5つ（女性／男性／トランスジェンダー女性／トランスジェンダー男性／ノンバイナリー）、からだ（妊娠する可能性）、好きになる人、家庭の条件、見た目。ミナミ・ハルト・ユウ・ケイは、1クリックで選べる見本としてだけ残す（友だちとしては登場させない）。視点の切り替えと「そのころ」はやめる。性暴力は、性別や性的指向の選択にかかわらず起こり得るという前提で書く。7つ目のパラメーター「くらし（お金）」を足し、収入によって、買うもの・住まい・暮らしぶりの出来事が選べたり、自動で起きたりする。自分で選べない出来事（疾病など）を統計の確率で起こす。就職活動・社会人・子育てとキャリア・家庭内・結婚／未婚の格差を場面にする。16歳の授業の場面は省く。進め方は、統計の候補の採否 → 属性の画面と16〜17歳の試作 → 19〜35歳（2026-11-01 決定） |
| B-44 | 試作に向けた統計と方針 | 統計の候補14件（案 S43〜S56）をすべて採用する：賃金、管理職、正規雇用、非正規、家事と育児、名字、就活セクハラ、ひとり親の収入、性的マイノリティと職場、がん、子宮内膜症、うつ、流産、不妊の原因。原典を読んで表の数値と一致したものだけ `verified: true` にする（S48・S49・S50・S51 は原典を読む。S53・S54 はよりよい資料を探す）。がんの確率は統計どおりにする（ほとんどの周回で起きない）。くらしの場面は金額を出さず、「住める／住めない」「買える／我慢する」の形で見せ、収入は S43 から決める。作業はブランチ single-protagonist で行い、動いてから main に入れて公開する（2026-11-01 決定） |
| B-45 | ランダムな人生とプロローグ | 試作の感想を受けて変更する。（1）オンボーディングをやめ、主旨、画面の見かた、安心して遊ぶための説明を最初の画面にまとめる。（2）1周目の属性はすべてランダムに決める。属性を組み立てる画面は1周目から外し、2周目で属性を変えて比べるときだけ使う（4人の見本もそこに残す）。確率は設計値で統計ではない：性自認と好きになる人は同じ確率、家計の苦しさ・ひとり親・きょうだいの世話・親のあいだの暴力はそれぞれ25%、家で性の話ができるは50%。性自認とからだは対応させ（ノンバイナリーのみ50%）、暴力の場面は同居の父親を描くためひとり親とは重ねない。現実の割合ではないことを画面に書く。（3）左上に「私（名前）」と顔を出す。（4）生まれた日から15歳までのプロローグ（`content/prologue.yaml`）を置く。パラメーターは動かさない。8歳で夢中になったものだけ選べ、17歳の進路の場面に出る。性自認と好きになる人は15歳で自覚する形で見せ、最後に、生育条件によるはじまりの値の差と理由を出す。（5）E16-DIET：未成年が保険証を使うと受診が親に伝わり得ることを描く。保険証は親が管理していること、医療費のお知らせに医療機関名が載り得ること（協会けんぽは被扶養者分も記載）、保険を使わなければ全額自費になることを心の声で出し、親に話す／自費（家計がふつうの場合）／行かないを選ばせる（2026-11-01 決定） |
| B-46 | トップページと根拠の見直し | 発注者の指示で変更する。（1）確率は統計に従い、監修は当面頼まない（ゲームが一定の評価を得てから）。うつ（CH-MIND）は S54 の12か月有病率を年1回の判定に使い（全体2.1%、男性1.0%、女性3.0%）、トランスジェンダー女性・男性とノンバイナリーは全体の値に S57 の比（37.5÷13.3＝2.82）を掛ける（解釈）。性暴力（CH-HARM）は S33 が性自認で集計しているため、自認する性別の値を使う。（2）主人公の名前はジェンダーニュートラルにする（ヒカル、マコト、チヒロ、カオル、ミズキ、ツカサ。見本はナツキ、ハル、ユウ、ケイ。友だちはルイ、妹はアサヒ）。パートナーのソウとサキは、性別が物語の分岐に関わるのでそのままにする。（3）トップページに、SRHR とプレコンセプションケアの説明と統計を置く（`content/home.yaml`）。このサイトの要点は、からだの自己決定権とライフステージの体感。（4）「夢中になったもの」の選択を外す（既存のサイトに似るため）。（5）§7・§8.1・§16 の「すぐに閉じる」ボタンをやめ、右上を「ホーム」にする。Esc キーの退出は残す（2026-11-01 決定） |
| B-47 | トラウマインフォームドな構成（発注者の指示書による） | （1）パラメーターを4軸に統合する：からだ／自己決定（旧：自己決定＋選択肢の幅）／つながり（旧：つながり＋心理的安全）／くらし（旧：くらし＋安全）。変数そのものを4つにし、既存の効果は機械的に読み替える。読み替えが不自然なもの（「記録して相談した」は自己決定、「授業で相談先を知った」はつながり）は内容に合わせる。§2.2 ほかの「5パラメーター」「6つ」の記述はこれで置きかえる。（2）属性ラベルへの直接減点をやめ、0〜15歳の出来事の積み重ねとして15歳のパラメーターを決める。プロローグは数秒ごとに自動で進む年表にし、一時停止ととばすを置く。演出を減らす設定では全部を一度に見せる。（3）家族の歩みは8通り。指示書の7通り（離別の2型、未婚、死別、ふたり親の3型）の値をそのまま使う。既存の「親のあいだの暴力」の場面（E16-HOME）を残すため、ふたり親に「父が母を怒鳴る夜がある」（くらし-5、つながり-5）を足す。（4）ひとり親になった理由の比は S58（母子世帯の離婚79.5%、未婚の母10.8%、死別5.3%）。離別の2型は同じ確率。物語の親が母なので、死別は父、ひとり親は母として書く。ひとり親の割合（25%）、ふたり親の内訳（安定40%、ほか各20%）、からだの感覚の3型（同じ確率）、きょうだいの世話（25%）は設計値。（5）「家で性や体の話ができるか」を廃止し、「本人のからだの感覚が尊重されてきたか」（我慢型／管理型／尊重型。値は指示書どおり）に置きかえる。親に話さないこと自体は問題として書かない。15歳以降は E16-DIET・E17-TALK・E17-MIND の心の声と効果で引き継ぐ。（6）性自認と好きになる人は、15歳で一度に自覚せず、何年もかけて少しずつ気づく形で書く。（7）15〜35歳の本編に親の死亡の場面を入れない。（8）いま何歳かを常に示す人生のゲージ（0〜35歳）を上端に置く。（9）表紙を、全面の見出しと罫線の統計の構成に作り直す（2026-11-01 決定） |
