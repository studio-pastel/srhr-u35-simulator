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

// GitHub Pages（付録B-38）：.htaccess が効かないため、セキュリティの設定（CSP など）をページの中に書く。
// frame-ancestors はページの中では効かないため除く。
if (process.env.PAGES === '1') {
  const { SECURITY_HEADERS } = await import('./lib/security-headers');
  const csp = SECURITY_HEADERS['Content-Security-Policy']!.replace(/;\s*frame-ancestors[^;]*/, '');
  const page = readFileSync(indexPath, 'utf8');
  if (!page.includes('Content-Security-Policy'))
    writeFileSync(indexPath, page.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`));
  writeFileSync(join(dist, '.nojekyll'), '');
}

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
