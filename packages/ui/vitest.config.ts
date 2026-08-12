import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Frontend Completion, Checkpoint G.
 *
 * First test runner configured anywhere under apps/web or packages/ui —
 * `packages/ui` owns it (not apps/web) because that's where the actual
 * conditional component logic lives (Nav's active-route matching and
 * mobile toggle, PageContainer's breakpoint class). apps/web's pages
 * are plain Server Components that only compose @7f/ui components with
 * fetched data, so there's nothing there yet worth a render test.
 *
 * Vitest over Jest (which apps/api already uses) because @7f/ui's own
 * build is already Vite-less/tsc-only ESM-first, and Vitest's jsdom
 * + esbuild pipeline needs no extra Babel/ts-jest transform config to
 * handle 'use client' components and JSX out of the box.
 *
 * ADDENDUM (FE-10.5) — `include` widened from `*.test.tsx` only to also
 * match plain `*.test.ts`: every test in this package through FE-10.4
 * has been a component render test (hence `.tsx` only), but
 * `validation.ts` (this checkpoint) is the package's first plain-
 * function module with no JSX of its own — its own test file has none
 * either, so it's `.ts`, and needed a real config change to actually
 * run rather than silently being skipped by the old glob.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
