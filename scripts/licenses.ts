// npm run licenses（§17）：node_modules の全パッケージのライセンスを調べ、
// THIRD_PARTY_NOTICES.md に出力する。許可外のライセンスがあれば失敗する。
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ALLOWED = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD']);

interface Pkg {
  name: string;
  version: string;
  license: string;
  dev: boolean;
}

function licenseOf(j: Record<string, unknown>): string {
  const l = j.license ?? j.licenses;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => (typeof x === 'string' ? x : (x as { type?: string }).type)).join(' OR ');
  if (l && typeof l === 'object') return String((l as { type?: string }).type);
  return 'UNKNOWN';
}

/** 「(MIT OR Apache-2.0)」のような SPDX 式は、OR のどれかが許可されていればよい */
function allowed(expr: string): boolean {
  const cleaned = expr.replace(/[()]/g, '').trim();
  if (/\bAND\b/.test(cleaned)) return cleaned.split(/\s+AND\s+/).every((p) => allowed(p));
  return cleaned.split(/\s+OR\s+/).some((p) => ALLOWED.has(p.trim()));
}

const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { dev?: boolean; optional?: boolean }>;
};

const pkgs: Pkg[] = [];
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path) continue;
  const pj = join(ROOT, path, 'package.json');
  if (!existsSync(pj)) continue; // 別のOS向けの任意依存など、入っていないもの
  const j = JSON.parse(readFileSync(pj, 'utf8')) as Record<string, unknown>;
  pkgs.push({ name: String(j.name), version: String(j.version), license: licenseOf(j), dev: Boolean(info.dev) });
}
pkgs.sort((a, b) => a.name.localeCompare(b.name));

const bad = pkgs.filter((p) => !allowed(p.license));
const runtime = pkgs.filter((p) => !p.dev);
const dev = pkgs.filter((p) => p.dev);

const row = (p: Pkg) => `| ${p.name} | ${p.version} | ${p.license} |`;
const md = [
  '# THIRD_PARTY_NOTICES',
  '',
  '`npm run licenses` が自動で出力するファイルです。手で編集しないでください。',
  '',
  `許可するライセンス（SPEC.md §17）：${[...ALLOWED].join('、')}`,
  '',
  `## 配信物に含まれるパッケージ（${runtime.length}件）`,
  '',
  '| パッケージ | バージョン | ライセンス |',
  '| --- | --- | --- |',
  ...runtime.map(row),
  '',
  `## 開発・ビルドにだけ使うパッケージ（${dev.length}件）`,
  '',
  '| パッケージ | バージョン | ライセンス |',
  '| --- | --- | --- |',
  ...dev.map(row),
  '',
].join('\n');
writeFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), md);

console.log(`ライセンス検査：${pkgs.length}件（配信物 ${runtime.length}件、開発用 ${dev.length}件）→ THIRD_PARTY_NOTICES.md`);
if (bad.length) {
  console.error('✗ 許可外のライセンスがあります：');
  for (const p of bad) console.error(`  ${p.name}@${p.version}：${p.license}`);
  process.exit(1);
}
console.log('✓ すべて許可されたライセンスです');
