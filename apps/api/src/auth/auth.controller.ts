import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { ErrorResponseDto } from '../common/errors/error-response.dto';
import { AuthMessages } from './auth.messages';
import { AuthService } from './auth.service';
import { AuthSessionDto, LogoutResponseDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SESSION_COOKIE_NAME } from './session/session.config';
import {
  destroySession,
  establishSession,
  getSessionUserId,
} from './session/session.helpers';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  /**
   * `ThrottlerGuard` is applied to the two unauthenticated, credential-taking
   * endpoints only, with the framework default policy and no custom
   * parameters (product decision, 2026-08-21).
   */
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account and start an authenticated session.',
    description:
      'A duplicate username answers 409 with `fieldErrors.username`. A ' +
      'duplicate email answers 409 with exactly the same status, body ' +
      'shape, and timing profile as an unexpected registration failure, so ' +
      'the response cannot be used to discover whether an email address is ' +
      'already registered.',
  })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthSessionDto> {
    const user = await this.auth.register(body);
    await establishSession(req, user.id);
    return { user };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange an email-or-username and password for a session.',
    description:
      'Every rejection answers 401 with the same neutral message, whether ' +
      'the account is unknown or the password is wrong.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
  ): Promise<AuthSessionDto> {
    const user = await this.auth.validateCredentials(body);
    await establishSession(req, user.id);
    return { user };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({
    summary: 'Return the signed-in user for session restoration.',
    description:
      'Answers 401 rather than redirecting so the client can render the ' +
      'expired-session state without following a navigation.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@Req() req: Request): Promise<AuthSessionDto> {
    const userId = getSessionUserId(req.session);
    const user = userId ? await this.auth.findById(userId) : null;

    if (!user) {
      // The session referenced a user that no longer exists. Treat it as an
      // invalid session and clear it rather than serving a partial identity.
      await destroySession(req).catch(() => undefined);
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: ErrorCode.UNAUTHENTICATED,
        message: AuthMessages.SESSION_EXPIRED,
      });
    }

    return { user };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({
    summary: 'Destroy the current session server-side.',
    description:
      'The session record is deleted from the store before the cookie is ' +
      'cleared, so the previously issued cookie can no longer authenticate ' +
      'any request. On failure the client retries; it has no local ' +
      'force-sign-out fallback.',
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    try {
      await destroySession(req);
    } catch (error) {
      this.logger.error(
        'Failed to destroy a session during sign-out.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, {
        code: ErrorCode.LOGOUT_FAILED,
        message: AuthMessages.LOGOUT_FAILED,
      });
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { signedOut: true };
  }
}
