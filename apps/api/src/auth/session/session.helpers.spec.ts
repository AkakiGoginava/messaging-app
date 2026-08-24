import type { Request } from 'express';

import {
  destroySession,
  establishSession,
  getSessionUserId,
  type SessionLike,
} from './session.helpers';

type Callback = (error?: unknown) => void;

/**
 * Minimal stand-in for `express-session`'s runtime behavior: `regenerate`
 * replaces `req.session` with a fresh object, exactly as the real store
 * does.
 */
function createRequest(options: {
  regenerateError?: Error;
  saveError?: Error;
  destroyError?: Error;
  initialUserId?: string;
}): { req: Request; calls: string[] } {
  const calls: string[] = [];

  const makeSession = (userId?: string): SessionLike =>
    ({
      userId,
      regenerate(done: Callback) {
        calls.push('regenerate');
        if (options.regenerateError) {
          done(options.regenerateError);
          return this;
        }
        req.session = makeSession();
        done();
        return this;
      },
      save(done: Callback) {
        calls.push('save');
        done(options.saveError);
        return this;
      },
      destroy(done: Callback) {
        calls.push('destroy');
        done(options.destroyError);
        return this;
      },
    }) as unknown as SessionLike;

  const req = { session: makeSession(options.initialUserId) } as Request;

  return { req, calls };
}

describe('getSessionUserId', () => {
  it('returns the user id when one is present', () => {
    expect(getSessionUserId({ userId: 'user-1' } as SessionLike)).toBe(
      'user-1',
    );
  });

  it.each([
    ['an undefined session', undefined],
    ['a session with no user id', {} as SessionLike],
    ['a session with an empty user id', { userId: '' } as SessionLike],
  ])('returns undefined for %s', (_case, session) => {
    expect(getSessionUserId(session)).toBeUndefined();
  });
});

describe('establishSession', () => {
  it('regenerates the session id before binding the user', async () => {
    const { req, calls } = createRequest({ initialUserId: 'attacker-planted' });

    await establishSession(req, 'user-1');

    expect(calls).toEqual(['regenerate', 'save']);
    expect(getSessionUserId(req.session)).toBe('user-1');
  });

  it('binds the user to the regenerated session, not the old one', async () => {
    const { req } = createRequest({});
    const originalSession = req.session;

    await establishSession(req, 'user-1');

    expect(req.session).not.toBe(originalSession);
    expect(originalSession.userId).toBeUndefined();
  });

  it('propagates a regeneration failure without binding the user', async () => {
    const { req, calls } = createRequest({
      regenerateError: new Error('store unavailable'),
    });

    await expect(establishSession(req, 'user-1')).rejects.toThrow(
      'store unavailable',
    );
    expect(calls).toEqual(['regenerate']);
    expect(getSessionUserId(req.session)).toBeUndefined();
  });

  it('propagates a save failure', async () => {
    const { req } = createRequest({ saveError: new Error('write failed') });

    await expect(establishSession(req, 'user-1')).rejects.toThrow(
      'write failed',
    );
  });
});

describe('destroySession', () => {
  it('destroys the session record', async () => {
    const { req, calls } = createRequest({ initialUserId: 'user-1' });

    await expect(destroySession(req)).resolves.toBeUndefined();
    expect(calls).toEqual(['destroy']);
  });

  it('propagates a destroy failure so the caller can report it', async () => {
    const { req } = createRequest({
      destroyError: new Error('store unavailable'),
    });

    await expect(destroySession(req)).rejects.toThrow('store unavailable');
  });
});
