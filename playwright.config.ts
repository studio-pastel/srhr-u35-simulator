import { defineConfig, devices } from '@playwright/test';

// §12.3 の E2E。本番と同じ形のビルド（プレビュー用）を、本番と同じセキュリティヘッダーの下で動かす。
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  // 演出を減らす設定で動かす（確率カードなどの演出を待たない）
  use: { baseURL: 'http://localhost:4173', locale: 'ja-JP', contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'ALLOW_UNVERIFIED=1 npx vite build && npx vite preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
