import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node --experimental-strip-types tests/mock-auth-server.ts',
      url: 'http://127.0.0.1:54329',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec next dev --port 3100',
      url: 'http://localhost:3100/login',
      env: {
        NEXT_DIST_DIR: '.next/playwright',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:54329',
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
