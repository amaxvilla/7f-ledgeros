import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Same reasoning as packages/ui/src/test/setup.ts's identical file:
// RTL doesn't auto-cleanup outside of Jest's global afterEach hook, so
// it's done explicitly here — without it, a form instance rendered in
// one test would still be mounted when the next test's render() runs.
afterEach(() => {
  cleanup();
});
