// npm run validate（§12.1）。--production を付けると本番ビルドの条件で検査する。
import { loadRawContent } from './lib/load-content';
import { validateContent } from '../src/engine/validate';

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const allowUnverified = process.env.ALLOW_UNVERIFIED === '1';

let raw: unknown;
try {
  raw = loadRawContent();
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
const r = validateContent(raw, { production, allowUnverified });

const mode = production ? (allowUnverified ? '本番（ALLOW_UNVERIFIED=1：プレビュー用）' : '本番') : '開発';
console.log(`コンテンツ検証（${mode}）`);

if (r.drafts.length) {
  console.log(`\n― status: draft（${r.drafts.length}件）`);
  for (const d of r.drafts) console.log(`  ・${d.id}`);
}
if (r.unverifiedUses.length) {
  console.log(`\n― 暫定値（verified: false）の統計を参照している箇所（${r.unverifiedUses.length}件）`);
  for (const u of r.unverifiedUses) console.log(`  ・${u.statId}：${u.where}`);
}
const otherWarnings = r.warnings.filter((w) => !w.startsWith('status: draft'));
if (otherWarnings.length) {
  console.log(`\n― 警告（${otherWarnings.length}件）`);
  for (const w of otherWarnings) console.log(`  ⚠ ${w}`);
}
if (r.errors.length) {
  console.error(`\n― エラー（${r.errors.length}件）`);
  for (const e of r.errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n✓ 検証を通過しました');
