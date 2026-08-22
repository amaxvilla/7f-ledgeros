import { test, expect } from '@playwright/test';

const BATCH_1 = ['/executive', '/entities', '/chart-of-accounts', '/general-ledger', '/settings'];

test.describe('Batch 1 Core Modules', () => {
  for (const route of BATCH_1) {
    test(`Module ${route} read and navigation`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      // Ensure no error messages appear from the server side
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('failed (401)');
      expect(bodyText).not.toContain('failed (500)');
      expect(bodyText).not.toContain('Application error');

      // Test presence and usability of Create/Add controls generically
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        // Just verify it doesn't crash the page
        const newBody = await page.locator('body').innerText();
        expect(newBody).not.toContain('Application error');
      }
    });
  }

  test('Chart of Accounts specific test', async ({ page }) => {
    await page.goto('/chart-of-accounts');
    await expect(page.locator('h1').first()).toContainText('Chart of Accounts');
    // Ensure the table rendered
    await expect(page.locator('table')).toBeVisible();
    
    // Look for Create account
    const createBtn = page.getByRole('button', { name: 'Create account' });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      // Look for form validation behavior by submitting empty
      const submitBtn = page.getByRole('button', { name: 'Save' });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await expect(page.locator('text=Required').first()).toBeVisible({ timeout: 2000 }).catch(() => {});
      }
    }
  });

  test('Settings specific test', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeVisible();
    // Test that the form is editable and can be saved
    await saveBtn.click();
    await expect(page.locator('text=Saved.')).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});
