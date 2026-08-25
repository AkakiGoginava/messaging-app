import { ApiProperty } from '@nestjs/swagger';

/**
 * The only user shape the API ever returns. It deliberately has no
 * `passwordHash` field, so a password hash cannot leak through a response by
 * accident.
 */
export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'jordan_lee' })
  username!: string;

  @ApiProperty({ format: 'email', example: 'jordan@example.com' })
  email!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** Envelope returned by register, login, and `GET /auth/me`. */
export class AuthSessionDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

/** Envelope returned by a successful `POST /auth/logout`. */
export class LogoutResponseDto {
  @ApiProperty({
    description: 'Always true; the session was destroyed server-side.',
    example: true,
  })
  signedOut!: boolean;
}
