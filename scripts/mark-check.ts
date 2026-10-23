// チェック用の限定公開ビルド（付録B-37）。npm run build のあとに dist/ を「検索エンジンに載らない」形にする。
// - index.html に <meta name="robots" content="noindex, nofollow">
// - robots.txt ですべてを拒否
// - .htaccess に X-Robots-Tag
// パスワード（ベーシック認証）はかけない（発注者の判断。付録B-37）
// 本公開のときは、npm run build だけを使う（この処理を通さない）。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');

const indexPath = join(dist, 'index.html');
const html = readFileSync(indexPath, 'utf8');
if (!html.includes('name="robots"'))
  writeFileSync(indexPath, html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />'));

writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

const htPath = join(dist, '.htaccess');
const ht = readFileSync(htPath, 'utf8');
if (!ht.includes('X-Robots-Tag'))
  writeFileSync(
    htPath,
    `${ht}
# ── チェック用の限定公開（npm run build:check で付く。本公開では付かない） ──
<IfModule mod_headers.c>
  Header always set X-Robots-Tag "noindex, nofollow"
</IfModule>

`,
  );

console.log('チェック用の設定を dist/ に付けました（noindex・robots.txt・X-Robots-Tag）');
