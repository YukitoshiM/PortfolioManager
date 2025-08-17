import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/ポートフォリオ管理/);
});

test('get started link', async ({ page }) => {
  await page.goto('/');

  // Expect the main heading to be visible
  await expect(page.getByRole('heading', { name: 'ポートフォリオ管理' })).toBeVisible();
});
