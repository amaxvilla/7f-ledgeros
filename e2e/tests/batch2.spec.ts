import { test, expect } from '@playwright/test';

const routes = [
  '/ap-ar', '/bank-integration', '/bank-reconciliation', '/budgeting', '/commission-calculations',
  '/commission-plans', '/consolidation', '/dimensions', '/finance-reports', '/financial-statements',
  '/fixed-assets', '/payments', '/revenue-recognition', '/tax', '/transfers', '/treasury'
];

test.describe('Batch 2 Financial Modules', () => {
  for (const route of routes) {
    test(`Module ${route} read and navigation`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('failed (401)');
      expect(bodyText).not.toContain('failed (500)');
      expect(bodyText).not.toContain('Application error');

      const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        const newBody = await page.locator('body').innerText();
        expect(newBody).not.toContain('Application error');
      }
    });
  }
});
