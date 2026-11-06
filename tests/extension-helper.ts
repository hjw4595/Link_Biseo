import type { Page } from '@playwright/test';
import type { ExtensionRequest } from '../src/contracts/browser-extension';
declare global {
  interface Window {
    extensionProbe: {
      calls: ExtensionRequest[];
      scenario: string;
      release: (() => void) | null;
      windowOpens: number;
    };
  }
}
export async function mockExtension(page: Page, scenario = 'success') {
  await page.addInitScript((initial) => {
    const probe = (window.extensionProbe = {
      calls: [] as ExtensionRequest[],
      scenario: initial,
      release: null as (() => void) | null,
      windowOpens: 0,
    });
    window.open = () => {
      probe.windowOpens++;
      return null;
    };
    const runtime = {
      sendMessage(
        _id: string,
        message: ExtensionRequest,
        callback: (value: unknown) => void,
      ) {
        probe.calls.push(message);
        if (probe.scenario === 'transport') {
          callback(undefined);
          return;
        }
        if (probe.scenario === 'invalid') {
          callback({ ok: true });
          return;
        }
        if (probe.scenario === 'timeout') return;
        if (message.type === 'BISEO_PING') {
          callback({ ok: true, type: 'BISEO_PONG', version: 1 });
          return;
        }
        if (message.type === 'BISEO_GET_STATUS') {
          const reply = () =>
            callback(
              probe.scenario === 'old'
                ? {
                    ok: false,
                    type: 'BISEO_ERROR',
                    version: 1,
                    error: { code: 'UNSUPPORTED_TYPE' },
                  }
                : {
                    ok: true,
                    type: 'BISEO_STATUS_RESULT',
                    version: 1,
                    incognitoAllowed: probe.scenario !== 'denied',
                  },
            );
          if (probe.scenario === 'delayed-status') probe.release = reply;
          else reply();
          return;
        }
        if (message.type !== 'BISEO_OPEN_URLS') return;
        const reply = () => {
          const kind = probe.scenario;
          if (kind === 'open-timeout') return;
          if (kind === 'partial' || kind === 'unknown' || kind === 'revoked') {
            callback({
              ok: false,
              type: 'BISEO_OPEN_URLS_ERROR',
              version: 1,
              code:
                kind === 'partial'
                  ? 'PARTIAL_OPEN_FAILED'
                  : kind === 'unknown'
                    ? 'OPEN_FAILED'
                    : 'INCOGNITO_NOT_ALLOWED',
              ...(kind === 'revoked'
                ? {}
                : {
                    requestedCount: message.urls.length,
                    openedCount: kind === 'partial' ? 1 : 0,
                  }),
            });
          } else
            callback({
              ok: true,
              type: 'BISEO_OPEN_URLS_RESULT',
              version: 1,
              requestedCount: message.urls.length,
              openedCount: kind === 'bad-count' ? 0 : message.urls.length,
            });
        };
        if (probe.scenario === 'delayed-open') probe.release = reply;
        else reply();
      },
    };
    if (initial !== 'no-api') {
      if (!window.chrome) window.chrome = {};
      Object.defineProperty(window.chrome, 'runtime', {
        configurable: true,
        value: runtime,
      });
    }
    if (initial === 'unsupported')
      Object.defineProperty(navigator, 'userAgent', { value: 'Firefox/123' });
  }, scenario);
}
export const setScenario = (page: Page, value: string) =>
  page.evaluate((v) => {
    window.extensionProbe.scenario = v;
  }, value);
export const openCalls = (page: Page) =>
  page.evaluate(() =>
    window.extensionProbe.calls.filter(
      (message) => message.type === 'BISEO_OPEN_URLS',
    ),
  );
