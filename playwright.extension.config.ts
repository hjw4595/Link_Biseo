import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  webServer:
    base.webServer && Array.isArray(base.webServer)
      ? base.webServer.map((server) => ({
          ...server,
          env: {
            ...server.env,
            NEXT_PUBLIC_BISEO_EXTENSION_ID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        }))
      : base.webServer,
});
