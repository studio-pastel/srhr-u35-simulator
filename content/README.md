# content/ の書き方（編集担当向け）

ここにある YAML を書き換えると、サイトの本文・数値・相談先が変わります。
仕様の正本は `SPEC.md` です。このファイルは、そのうち編集でよく使う部分をまとめたものです。

## 書き換えたら必ず実行する

```bash
npm run validate
```

エラー（✗）が1件でもあると、ビルドできません。警告（⚠）はビルドを止めませんが、確認してください。
場面のつながりを見たいときは、`npm run flow` でルート図を書き出せます。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `config.yaml` | サイト名、Esc キーで退出したときの移動先、変動幅（S/M/L）、相談先のタグ名 |
| `characters.yaml` | 主人公（はじめの値の基準、近しい人） |
| `cast.yaml` | 登場人物の見た目と関係（関係図に出す言葉など） |
| `presets.yaml` | 2周目の属性の画面で選べる4人の見本 |
| `prologue.yaml` | 生まれた日から15歳までの年表 |
| `conditions.yaml` | 社会条件（性教育、緊急避妊薬の入手、育休、パートナーシップ制度） |
| `stats.yaml` | 統計。**この表にない数値は、本文にも確率にも使わない** |
| `resources.yaml` | 相談先（「話せる場所」） |
| `home.yaml` | 表紙の説明と統計 |
| `chapters/<年齢>.yaml` | 章ごとのイベント |

## 文字数の上限（SPEC.md §11）

| 対象 | 上限 | 超えたとき |
| --- | --- | --- |
| 会話の1行 | 40字 | 警告 |
| 選択肢 `label` | 30字 | 警告 |
| 効果の `note`（増減の理由に出す） | 20字 | **エラー** |
| 確率の補正の `note` | 20字 | **エラー** |

数え方：ルビ `{漢字|かんじ}` は親文字（漢字）だけを数えます。改行は数えません。上限は `src/engine/limits.ts` で定義しています。

## イベントの書き方

```yaml
- id: E17-ASKOUT
  age: 17
  characters: [me]
  kind: fixed                  # fixed：決まって起きる／chance：確率で起きる
  trigger: { kind: profile, text: "クラスに気になる人がいるから起きた" }   # 場面の上に出す「なぜ起きたか」
  domains: [関係性]
  requires: "flags.partnerId == 'sou' || flags.partnerId == 'saki'"      # 起きる条件
  stage: { place: gate, time: dusk, cast: [{ id: self, x: 28 }, { id: partner, x: 62 }] }
  summary: "クラスメイトに、付き合ってほしいと言われた。"
  status: draft                # 人が改稿するまで draft のまま
  scenes:
    - id: start
      lines:
        - { who: narration, text: "放課後、校門のところで呼び止められた。" }   # 地の文
        - { who: partner, text: "付き合ってほしい。……どうかな。" }          # 相手の言葉
        - { who: self, kind: inner, text: "（どうしよう）", face: thinking }   # 心の声
      choices:
        - id: yes
          label: "「うん。付き合おう」"          # 「」は言葉、（）は心の声、記号なしは行動
          neutral: true                         # どちらも正解。負の効果を付けられない
          setFlags: { dating: true }
          next: yes
        - id: no
          label: "「ごめん。友だちのままでいたい」"
          canonical: true                       # 「この場面をとばす」で使う選択
          neutral: true
          next: no
    - id: yes
      closeness:                                # 人との近さ（0〜3）。パラメーターとは別
        - { who: sou, delta: 1, note: "付き合い始めた", when: "flags.partnerId == 'sou'" }
      lines:
        - { who: narration, text: "こうして、%partner%と付き合うことになった。" }
      next: END                                 # イベントの終わり
```

### 効果

```yaml
effects:
  - { param: connection, sign: 1, size: M, source: choice, note: "担任に事情を話した" }
  - { param: connection, sign: -1, size: S, source: upbringing, statRef: S23,
      when: "up.familyCare == true", note: "世話で放課後が埋まる" }
```

- `param`：body（からだ）／autonomy（自己決定）／connection（つながり）／living（くらし）
- `source`：choice（選択）／upbringing（生育条件）／society（社会条件）／others（他者の行為）／chance（偶然）
  - 暴力を受けたことによる変化は、必ず `others` にする（被害を受けた人の `choice` にしない）。
  - シーンに入ったときの効果（選択と関係なく起きる変化）に、`choice` は使えない。
- `size`：S／M／L（数値は `config.yaml`）
- 条件式（`when`・`requires`）で使えるもの：`flags.名前`、`cond.社会条件ID`、`up.属性`、`==`、`!=`、`&&`、`||`、`!`、括弧

### 確率で起きる出来事

```yaml
chance:
  id: CH-MIND
  label: "1年のあいだに、うつ病になる可能性"
  base: { value: 0.021, statRef: S54 }          # 基本の確率と根拠
  modifiers:                                     # 補正。set：置きかえ／mul：掛ける／odds：オッズに掛ける
    - { when: "up.gender == 'woman'", op: set, value: 0.03, source: society, statRef: S54, note: "女性の割合" }
  outcomes:
    happens: { effects: [...], next: happened }  # 結果の効果の要因は、自動で chance になる
    notHappens: { next: fine }
```

- 補正には、根拠（`statRef`）と要因（`source`）が必ず要ります。
- 統計を確率に読みかえたときは、「このサイトについて」の「数字の使い方」にも書きます。

## 本文のきまり（SPEC.md §11 の要点）

- 暴力の場面は、行為を描写しない。前後の会話・本人の感情・周囲の反応で描く。
- 「正しい／間違い」「失敗した」「〜してしまった」など、選択を評価する言い方をしない。
- 被害を受けた人に「なぜ逃げなかったか」を問う構図にしない。
- 性自認とセクシュアリティについて、断定的に書かない。不在を感じさせる表現や、本人が使っていないラベルを使わない。
- 医療情報は `stats.yaml` にある事実だけを書き、それ以外は「医療機関・薬剤師に相談」へつなぐ。
- 人が改稿していない本文は `status: draft` のままにする。
