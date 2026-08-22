import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  
  // Fill the login form using the seeded admin credentials
  await page.getByLabel('Email').fill('admin@7fifteencapital.com');
  await page.getByLabel('Password').fill('ChangeMe!2026');
  
  // Click login
  await page.getByRole('button', { name: 'Log in' }).click();
  
  // Wait for redirect to dashboard or executive
  await page.waitForURL(url => url.pathname === '/' || url.pathname === '/executive' || url.pathname === '/dashboard');
  
  // Save storage state
  await page.context().storageState({ path: authFile });
});
