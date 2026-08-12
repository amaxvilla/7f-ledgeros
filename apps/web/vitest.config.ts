import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Frontend Completion, Checkpoint AB.
 *
 * First test runner configured for apps/web itself. `packages/ui`'s own
 * vitest.config.ts (Checkpoint G) deliberately scoped testing to that
 * package, with a doc comment explaining why: "apps/web's pages are
 * plain Server Components that only compose @7f/ui components with
 * fetched data, so there's nothing there yet worth a render test." That
 * premise no longer holds — apps/web now has nine Create*Form 'use
 * client' components (Checkpoints Q through AA) with real conditional
 * logic of their own (CreateIpRuleForm's userId field only rendering
 * when scope === 'USER', CreatePaymentLinkForm's major-to-minor unit
 * conversion, every form's pending/error/reset state machine) — exactly
 * the kind of logic that comment already considered test-worthy for
 * @7f/ui's own components. This checkpoint gives apps/web that same
 * capability rather than continuing to leave it as a named-but-unaddressed
 * gap (see the last three release reports, which all flagged it).
 *
 * Deliberately a SEPARATE config from packages/ui's own, not a shared
 * one — same reasoning that package's own vitest.config.ts gives for
 * choosing Vitest over Jest in the first place (no cross-package config
 * sharing was set up when that decision was made, and unifying them now
 * is a bigger refactor than "add tests for two forms," not this
 * checkpoint's job). The two configs are intentionally near-identical
 * (same jsdom environment, same globals: false posture, same
 * setupFiles shape) so a future unification, if ever done, is a
 * mechanical merge rather than a redesign.
 *
 * `resolve.alias` for `@7f/ui` points at the PACKAGE SOURCE
 * (`packages/ui/src`), not its built `dist/` output — same as this
 * app's own tsconfig.json path mapping already does for the real Next
 * build (see that file's own `paths` entry), so tests don't require a
 * `pnpm --filter @7f/ui build` step to run first.
 *
 * Checkpoint AJ widened `include` to also match `lib/**` tests —
 * `fetchApi`'s new accessToken-cookie-vs-service-token precedence logic
 * (lib/api.ts) is the first piece of testable logic in this app that
 * isn't a component, so the previous `app/**` -only glob no longer
 * covered everything worth testing.
 *
 * Checkpoint AN widens it again to match a root-level `__tests__/**`:
 * `middleware.ts` must live at `apps/web/middleware.ts` itself (Next's
 * own required location for project middleware — it isn't picked up
 * from `app/` or `lib/`), so its test can't live under either of the
 * two directories the glob already covered.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@7f/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['app/**/__tests__/**/*.test.tsx', 'lib/**/__tests__/**/*.test.ts', '__tests__/**/*.test.ts'],
    globals: false,
  },
});
