import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  define: { __BUILD_DATE__: JSON.stringify('2026-01-01') },
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'] },
});
