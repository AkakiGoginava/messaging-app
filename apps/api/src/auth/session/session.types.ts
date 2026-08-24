import 'express-session';

declare module 'express-session' {
  /**
   * The only value stored in a session record. Nothing derived from the
   * password (not even its hash) is ever placed in the session payload,
   * because that payload is persisted as JSON in the `session` table.
   */
  interface SessionData {
    userId?: string;
  }
}

export {};
