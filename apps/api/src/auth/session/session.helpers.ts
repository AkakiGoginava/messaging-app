import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';

import './session.types';

/**
 * Minimal structural view of the parts of `express-session` these helpers
 * touch. Declaring it explicitly keeps the helpers unit-testable without a
 * running store.
 */
export type SessionLike = Session & Partial<SessionData>;

type Callback = (error?: unknown) => void;

function promisify(run: (done: Callback) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    run((error) => (error ? reject(asError(error)) : resolve()));
  });
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Reads the authenticated user id, if any, from a request's session. */
export function getSessionUserId(
  session: SessionLike | undefined,
): string | undefined {
  const userId = session?.userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : undefined;
}

/**
 * Issues a brand-new session id and binds it to `userId`.
 *
 * Regenerating on every successful authentication is the OWASP-recommended
 * defense against session fixation: a session id an attacker planted before
 * sign-in is discarded rather than promoted to an authenticated one.
 *
 * `req.session` is replaced in place by `regenerate`, so the post-regenerate
 * session must be read back off the request rather than captured up front.
 */
export async function establishSession(
  req: Request,
  userId: string,
): Promise<void> {
  await promisify((done) => req.session.regenerate(done));
  req.session.userId = userId;
  await promisify((done) => req.session.save(done));
}

/**
 * Destroys the session record server-side. The caller is responsible for
 * clearing the browser cookie; a cleared cookie alone would leave a usable
 * session in the store.
 */
export function destroySession(req: Request): Promise<void> {
  return promisify((done) => req.session.destroy(done));
}
