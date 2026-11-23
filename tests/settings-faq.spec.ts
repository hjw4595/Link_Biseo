import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';

for (const width of [320, 1440]) {
  test(`FAQ starts collapsed, supports keyboard and fits ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    const faq = page.getByRole('region', { name: '자주 묻는 질문' });
    const questions = faq.getByRole('button');
    await expect(questions).toHaveCount(4);
    for (const question of await questions.all())
      await expect(question).toHaveAttribute('aria-expanded', 'false');
    await questions.first().focus();
    await questions.first().press('Enter');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(
      faq.getByText('팝업 및 리디렉션을 허용으로 변경해 주세요.'),
    ).toBeVisible();
    await questions.first().press('ArrowDown');
    await expect(questions.nth(1)).toBeFocused();
    await questions.nth(1).press('Space');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    await questions.nth(1).press('Enter');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'false');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const logout = page.getByRole('button', { name: '로그아웃', exact: true });
    expect(
      await logout.evaluate(
        (button) =>
          !!(
            button.compareDocumentPosition(
              document.getElementById('settings-faq-heading')!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true);
  });
}

test('quick launch guidance navigates to the expanded popup FAQ without opening the editor', async ({
  page,
}) => {
  await presetApi(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: '빠른 실행 추가', exact: true })
    .click();
  await page
    .getByRole('button', { name: '자세한 설정 방법 보기', exact: true })
    .click();
  await expect(page).toHaveURL('/settings?faq=popup#faq-popup');
  const question = page.getByRole('button', {
    name: '빠른 실행에서 링크가 하나만 열려요.',
    exact: true,
  });
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(question).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.reload();
  await expect(question).toHaveAttribute('aria-expanded', 'true');
});
