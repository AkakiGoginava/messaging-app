import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { request } from '@playwright/test';

import {
  ACCOUNTS_PATH,
  STORAGE_STATE_PATH,
  WEB_BASE_URL,
} from '../playwright.config';
import { buildAccount, type TestAccounts } from './support/accounts';

/**
 * Creates the two shared accounts the suite needs and saves an
 * authenticated session, once per run.
 *
 * Doing this here rather than per spec keeps the number of
 * `/auth/register` and `/auth/login` calls well under the API's default
 * rate limit, which is shared by the whole suite because every request
 * reaches the API from the same proxy address.
 *
 * Registration goes through the web origin's `/api` prefix, so the setup
 * itself depends on the same-origin proxy being wired correctly — if the
 * proxy is broken the suite fails immediately and unambiguously.
 */
async function globalSetup(): Promise<void> {
  const accounts: TestAccounts = {
    session: buildAccount('session'),
    taken: buildAccount('taken'),
  };

  const context = await request.newContext({ baseURL: WEB_BASE_URL });

  try {
    for (const account of [accounts.taken, accounts.session]) {
      const response = await context.post('/api/auth/register', {
        data: account,
      });

      if (!response.ok()) {
        throw new Error(
          `Global setup could not register ${account.username}: ` +
            `${response.status()} ${await response.text()}`,
        );
      }
    }

    // The context now holds the session cookie for `accounts.session`,
    // because it was registered last.
    mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
    await context.storageState({ path: STORAGE_STATE_PATH });
    writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
  } finally {
    await context.dispose();
  }
}

export default globalSetup;
