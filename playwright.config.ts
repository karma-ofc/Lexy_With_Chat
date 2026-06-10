import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: 'tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 5000,
  },
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      CI: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
};

export default config;
