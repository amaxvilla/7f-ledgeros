import { test, expect } from '@playwright/test';

const routes = [
  '/admin-branding', '/admin-tools', '/feature-flags', '/hse', '/my-security',
  '/roles', '/security', '/tenants', '/users', '/workspace-admin'
];

test.describe('Batch 6 Admin Modules', () => {
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
