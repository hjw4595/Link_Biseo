import { test, expect } from './auth-fixture';

for (const width of [320, 390, 512, 768, 1024, 1440, 1920]) {
  test(`common controlled sheet, fixed regions and focus ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto('/dev/ui');
    const trigger = page.getByRole('button', {
      name: '공통 Sheet 예시',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog', {
      name: '공통 Sheet 예시',
      exact: true,
    });
    await expect(dialog.getByLabel('예시 이름')).toBeFocused();
    await expect(dialog).toHaveAccessibleDescription(
      '편집 패널의 공통 레이아웃을 확인합니다.',
    );
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.round(box.x + box.width) : 0;
      })
      .toBe(width);
    const box = await dialog.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(width < 1024 ? width : 512);
    expect(Math.round(box?.height ?? 0)).toBe(650);
    const body = dialog.locator('[data-slot="app-sheet-body"]');
    const footer = dialog.locator('[data-slot="app-sheet-footer"]');
    const before = await footer.boundingBox();
    await body.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await footer.boundingBox()).toEqual(before);
    await expect(
      dialog.getByRole('button', { name: '완료', exact: true }),
    ).toBeInViewport();
    const buttons = await footer
      .getByRole('button')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().width),
      );
    expect(buttons[0]).toBe(buttons[1]);
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    if (width >= 1024) {
      await trigger.click();
      await page.mouse.click(5, 5);
      await expect(dialog).toHaveCount(0);
    }
    await page.getByLabel('Sheet Footer 표시').uncheck();
    await trigger.click();
    await expect(footer).toHaveCount(0);
    await expect(body).toBeVisible();
    await dialog
      .getByRole('button', { name: '처리 중 예시', exact: true })
      .click();
    await expect(
      dialog.getByRole('button', { name: '닫기', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: '처리 완료 예시', exact: true })
      .click();
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(trigger).toBeFocused();
  });
}

test('keyboard-sized visual viewport keeps the footer accessible without scrolling the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/dev/ui');
  await page
    .getByRole('button', { name: '공통 Sheet 예시', exact: true })
    .click();
  const sheet = page.getByRole('dialog', {
    name: '공통 Sheet 예시',
    exact: true,
  });
  await page.evaluate(() => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error('VisualViewport unavailable');
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      get: () => 360,
    });
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect
    .poll(async () => Math.round((await sheet.boundingBox())?.height ?? 0))
    .toBe(360);
  const footer = await sheet
    .locator('[data-slot="app-sheet-footer"]')
    .boundingBox();
  expect((footer?.y ?? 900) + (footer?.height ?? 0)).toBeLessThanOrEqual(360);
  expect(await sheet.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
