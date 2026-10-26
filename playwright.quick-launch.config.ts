import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: /quick-launch-browser\.spec\.ts/,
  projects: [
    {
      name: 'chrome-policy',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        launchOptions: { ignoreDefaultArgs: ['--disable-popup-blocking'] },
      },
    },
    {
      name: 'edge-policy',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
        launchOptions: { ignoreDefaultArgs: ['--disable-popup-blocking'] },
      },
    },
    {
      name: 'firefox-policy',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: { 'dom.disable_open_during_load': true },
        },
      },
    },
    { name: 'webkit-policy', use: { browserName: 'webkit' } },
  ],
});
