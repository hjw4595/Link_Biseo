import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Additional compatibility run, separate from the complete Chromium regression.
// CDP CPU throttling remains tested by the default suite; it is Chromium-only.
export default defineConfig({
  ...base,
  testMatch: [
    'bookmark-import-parser.spec.ts',
    'bookmark-import.spec.ts',
    'bookmark-import-execution.spec.ts',
    'bookmark-folder-mapping.spec.ts',
  ],
  grepInvert: /simulated 4x CPU slowdown/,
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
  ],
});
