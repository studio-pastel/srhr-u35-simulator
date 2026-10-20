// 定数（zod に依存しない）。画面のコードはここから読み込み、配信物に zod を含めない。
export const PARAM_KEYS = ['body', 'safety', 'options', 'connection', 'autonomy'] as const;
export const SOURCES = ['choice', 'upbringing', 'society', 'chance'] as const;
export const CHARACTER_IDS = ['minami', 'haruto', 'yu', 'kei'] as const;
export const AGES = [16, 17, 19, 21, 24, 27, 30, 35] as const;
export const EFFECT_SIZES = ['S', 'M', 'L'] as const;
