// 属性の選択肢（zod に依存しない）
export const GENDERS = ['woman', 'man', 'transWoman', 'transMan', 'nonbinary'] as const;
export const BODIES = ['canBePregnant', 'cannot'] as const;
export const ATTRACTIONS = ['men', 'women', 'any', 'none', 'unsure'] as const;
export const ECONOMIES = ['middle', 'hardship'] as const;

// 0〜15歳の家族の歩み（付録B-47）
export const FAMILY_STORIES = ['divorceMoved', 'divorceRelief', 'unmarried', 'bereaved', 'twoStable', 'twoCold', 'twoTense', 'twoHardship'] as const;
// 家で、本人のからだの感覚が尊重されてきたか（付録B-47）
export const BODY_RESPECTS = ['dismissed', 'managed', 'respected'] as const;
