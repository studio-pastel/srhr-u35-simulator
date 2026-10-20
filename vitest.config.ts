import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'] },
});
