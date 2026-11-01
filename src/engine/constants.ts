// 定数（zod に依存しない）。画面のコードはここから読み込み、配信物に zod を含めない。
// others（他者の行為）は付録A-14 で追加
// パラメーターは4軸に統合した（付録B-47）：自己決定＋選択肢の幅、つながり＋心理的安全、くらし＋安全
export const PARAM_KEYS = ['body', 'autonomy', 'connection', 'living'] as const;
export const SOURCES = ['choice', 'upbringing', 'society', 'others', 'chance'] as const;
// 主人公は1人（付録B-43）。属性は RunState.profile で持つ
export const CHARACTER_IDS = ['me'] as const;
export const AGES = [16, 17, 19, 21, 24, 27, 30, 35] as const;
export const EFFECT_SIZES = ['S', 'M', 'L'] as const;
