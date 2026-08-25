import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when Vitest globals are
// enabled. They are not, so unmounting is wired up explicitly here —
// otherwise rendered trees accumulate across tests and queries start
// matching elements from an earlier test.
afterEach(() => {
  cleanup();
});
