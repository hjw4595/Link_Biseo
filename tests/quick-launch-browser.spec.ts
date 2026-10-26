import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
test('real browsing-context requests under browser popup policy and individual fallback', async ({
  page,
  context,
  browser,
}, info) => {
  await presetApi(page);
  let records = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/open')) records++;
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  const before = context.pages().length;
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(page.getByText('링크 열기를 요청했어요.')).toBeVisible();
  await expect.poll(() => records).toBe(2);
  const opened = context.pages().filter((p) => p !== page);
  for (const popup of opened) {
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
  }
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toBeEnabled();
  const next = context.waitForEvent('page');
  await page
    .getByRole('link', { name: /개별 열기/ })
    .first()
    .click();
  const fallback = await next;
  await fallback.waitForLoadState();
  expect(await fallback.evaluate(() => window.opener === null)).toBe(true);
  await fallback.close();
  await expect.poll(() => records).toBe(3);
  await mkdir('artifacts/wo-v1-01', { recursive: true });
  await writeFile(
    `artifacts/wo-v1-01/browser-${info.project.name}.json`,
    JSON.stringify(
      {
        project: info.project.name,
        version: browser.version(),
        before,
        observedContexts: opened.length,
        attempted: 2,
        individualFallback: true,
        note: 'Automated browser profile; not a guarantee of tab count or native Safari behavior.',
      },
      null,
      2,
    ),
  );
});
