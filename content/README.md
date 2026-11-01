# content/ の書き方（編集担当向け）

ここにある YAML を書き換えると、サイトの本文・数値・相談窓口が変わります。
仕様の正本は `SPEC.md` です。このファイルは、そのうち編集でよく使う部分をまとめたものです。

## 書き換えたら必ず実行する

```bash
npm run validate
```

エラー（✗）が1件でもあると、ビルドできません。警告（⚠）はビルドを止めませんが、確認してください。

## 文字数の上限（SPEC.md 付録A-7）

| 対象 | 上限 | 超えたとき |
| --- | --- | --- |
| シーン本文 `text` | 200字 | 警告 |
| 選択肢 `label` | 30字 | 警告 |
| 効果の `note`（ふりかえりに出す理由） | 20字 | **エラー** |
| 確率ノードの modifier の `note` | 20字 | **エラー** |

数え方：

- ルビ `{漢字|かんじ}` は、親文字（漢字）だけを数えます。
- 改行は数えません。
- 句読点・かぎかっこ・数字は、それぞれ1字として数えます。

上限は `src/engine/limits.ts` で定義しています。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `config.yaml` | サイト名、「すぐに閉じる」の移動先、変動幅（S/M/L）、相談窓口のタグ名 |
| `characters.yaml` | 4人の人物（プロフィール、生育条件、初期値） |
| `conditions.yaml` | 社会条件（性教育、緊急避妊薬の入手、育休、パートナーシップ制度。パートナーシップ制度は既定で「住む場所しだい」） |
| `stats.yaml` | 統計 S01〜S31。**この表にない数値は、本文にも確率にも使わない** |
| `resources.yaml` | 相談窓口 |
| `chapters/<年齢>.yaml` | 章ごとのイベントとシーン |

## 本文のきまり（SPEC.md §11 の要点）

- 暴力の場面は、行為を描写しない。前後の会話・本人の感情・周囲の反応で描く。
- 「正しい／間違い」「失敗した」「〜してしまった」など、選択を評価する言い方をしない。
- 被害者に「なぜ逃げなかったか」を問う構図にしない。
- 性的指向・性自認を、本人が使っていないラベルで呼ばない。
- 医療情報は `stats.yaml` にある事実だけを書き、それ以外は「医療機関・薬剤師に相談」へつなぐ。
- 人が改稿していない本文は `status: draft` のままにする。

## よく使う書き方

```yaml
# 選択肢と効果
choices:
  - id: tell
    label: "担任に事情を話す"
    canonical: true            # ほかの主人公のプレイ中や、読まずに進んだ章で使う選択
    effects:
      - { param: connection, sign: 1, size: M, source: choice, note: "担任に事情を話した" }
      - { param: connection, sign: -1, size: S, source: upbringing, statRef: S23,
          when: "up.familyCare == true", note: "世話で放課後が埋まる" }
    setFlags: { keiToldTeacher: true }
    next: tell                 # 次のシーンID。イベントの終わりは END

# シーンに入ったときの効果（付録A-15）。選択と関係なく起きる変化。choice は使えない
- id: m-start
  effects:
    - { param: connection, sign: -1, size: L, source: others, statRef: S07, note: "交際相手からの束縛" }
  text: "……"
  next: m-plans

# 選択肢のない分岐（付録A-1）
- id: start
  text: "……"
  branches:
    - when: "cond.sexEducation == 'taught'"
      next: taught
  next: notTaught              # どの条件にも当てはまらないとき
```

- `param`：body（からだ）／autonomy（自己決定）／connection（つながり）／living（くらし）（付録B-47）
- `source`：choice（選択）／upbringing（生育条件）／society（社会条件）／others（他者の行為）／chance（偶然）
  - 暴力を受けたことによる変化は、必ず `others` にする（被害者の `choice` にしない）。友人や先生などの支援による回復も `others`。
- `size`：S／M／L（数値は `config.yaml`）
- 条件式（`when`・`requires`）で使えるもの：`flags.名前`、`cond.社会条件ID`、`up.生育条件`、`char`、`==`、`!=`、`&&`、`||`、`!`、括弧
