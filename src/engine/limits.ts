// 本文の文字数上限（SPEC.md §5、§11-1、付録A-7）。
// 数え方：ルビ記法 {漢字|かんじ} は親文字（漢字）だけを数える。改行は数えない。
// 1文字＝Unicode のコードポイント1つ（絵文字の結合などは考慮しない）。
export const TEXT_LIMITS = {
  /** シーン本文。超えたら警告（ビルドは通す。§12.1） */
  sceneText: 200,
  /** 選択肢のラベル。超えたら警告（ビルドは通す） */
  choiceLabel: 30,
  /** 効果の note（要因分解の画面に出す理由）。超えたらエラー（ビルドを止める） */
  effectNote: 20,
  /** 会話の吹き出し1つ（付録B-2）。超えたら警告 */
  line: 40,
  /** 「この場面をとばす」の要約（付録B-17）。超えたら警告 */
  summary: 40,
} as const;

/** ルビ記法を親文字に置き換え、改行を除いた文字数を返す */
export function countChars(text: string): number {
  const plain = text.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1').replace(/\r?\n/g, '');
  return Array.from(plain).length;
}
