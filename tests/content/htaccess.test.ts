import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SECURITY_HEADERS } from '../../scripts/lib/security-headers';

describe('.htaccess（§13.2）', () => {
  const ht = readFileSync(resolve(import.meta.dirname, '../../public/.htaccess'), 'utf8');
  it.each(Object.entries(SECURITY_HEADERS))('%s が security-headers.ts と同じ値', (name, value) => {
    expect(ht).toContain(`Header always set ${name} "${value}"`);
  });
  it('HSTS は HTTPS の確認後に有効にする（いまはコメントのまま）', () => {
    expect(ht).toMatch(/^\s*# Header always set Strict-Transport-Security "max-age=31536000"/m);
  });
  it('ハッシュ付きの静的ファイルは長期キャッシュ、index.html は no-cache', () => {
    expect(ht).toContain('max-age=31536000, immutable');
    expect(ht).toContain('Header set Cache-Control "no-cache"');
  });
});
