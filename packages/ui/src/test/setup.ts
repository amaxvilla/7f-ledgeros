import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// RTL doesn't auto-cleanup outside of Jest's global afterEach hook, so
// it's done explicitly here — without it, Nav/PageContainer instances
// rendered in one test would still be mounted (and duplicated in the
// DOM) when the next test's render() runs.
afterEach(() => {
  cleanup();
});
