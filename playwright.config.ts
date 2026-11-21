import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4177';
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4177 --strictPort',
    url: baseURL,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54399',
      VITE_SUPABASE_ANON_KEY: 'playwright-public-test-key',
    },
    reuseExistingServer: false,
  },
});
