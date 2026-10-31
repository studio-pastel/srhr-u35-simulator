// 定数（zod に依存しない）。画面のコードはここから読み込み、配信物に zod を含めない。
// psychSafety（心理的安全）と others（他者の行為）は付録A-13・A-14 で追加
// living（くらし）は付録B-43 で追加
export const PARAM_KEYS = ['body', 'safety', 'psychSafety', 'options', 'connection', 'autonomy', 'living'] as const;
export const SOURCES = ['choice', 'upbringing', 'society', 'others', 'chance'] as const;
// 主人公は1人（付録B-43）。属性は RunState.profile で持つ
export const CHARACTER_IDS = ['me'] as const;
export const AGES = [16, 17, 19, 21, 24, 27, 30, 35] as const;
export const EFFECT_SIZES = ['S', 'M', 'L'] as const;
