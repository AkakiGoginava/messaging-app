import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { ApiException } from '../../common/errors/api-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthMessages } from '../auth.messages';
import { getSessionUserId } from '../session/session.helpers';

/**
 * Rejects any request that does not carry a valid server-side session.
 *
 * It answers with 401 and the shared error envelope rather than a redirect,
 * so the client can distinguish "not signed in" from a navigation and render
 * the Restored Session Failed state.
 *
 * Only a session record that still exists in the store can reach here: an
 * expired or destroyed session leaves `req.session` empty even though the
 * browser may still be sending the old cookie.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (getSessionUserId(request.session) === undefined) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: ErrorCode.UNAUTHENTICATED,
        message: AuthMessages.SESSION_EXPIRED,
      });
    }

    return true;
  }
}
