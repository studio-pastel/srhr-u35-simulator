import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  define: { __BUILD_DATE__: JSON.stringify('2026-01-01') },
  // GitHub Actions の実行環境は遅いため、コンテンツ全体の到達性を調べるテストが5秒を超える。制限を延ばす
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'], testTimeout: 60_000 },
});
