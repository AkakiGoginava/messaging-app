import { readFileSync } from 'node:fs';

import { ACCOUNTS_PATH } from '../../playwright.config';

export interface TestAccount {
  username: string;
  email: string;
  password: string;
}

export interface TestAccounts {
  /**
   * Signed in during the global setup; its session is saved to the shared
   * storage state. Specs that only need "a signed-in user" reuse it and must
   * never sign it out, or they would invalidate the session for every other
   * spec.
   */
  session: TestAccount;
  /**
   * Exists purely so the conflict specs have a username and an email that
   * are already taken.
   */
  taken: TestAccount;
}

/**
 * Every generated credential is unique per run, so specs never collide with
 * rows left behind by an earlier run against the same database.
 */
export function buildAccount(label: string): TestAccount {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const username = `${label}_${suffix}`.slice(0, 20);

  return {
    username,
    email: `${username}@example.com`,
    // Satisfies the 12–128 character, one uppercase, one digit policy.
    password: 'Correct-Horse-1',
  };
}

export function readAccounts(): TestAccounts {
  return JSON.parse(readFileSync(ACCOUNTS_PATH, 'utf8')) as TestAccounts;
}
