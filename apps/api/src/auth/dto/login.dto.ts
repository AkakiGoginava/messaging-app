import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { AuthMessages } from '../auth.messages';
import { IDENTIFIER_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../auth.rules';

/**
 * Sign-in deliberately validates presence only. Applying the registration
 * password policy here would leak the policy to unauthenticated callers and
 * would let an attacker distinguish "wrong shape" from "wrong password".
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email address or username.',
    example: 'jordan@example.com',
    maxLength: IDENTIFIER_MAX_LENGTH,
  })
  @IsString({ message: AuthMessages.IDENTIFIER_REQUIRED })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: AuthMessages.IDENTIFIER_REQUIRED })
  @MaxLength(IDENTIFIER_MAX_LENGTH, {
    message: AuthMessages.IDENTIFIER_REQUIRED,
  })
  identifier!: string;

  @ApiProperty({
    description: 'Account password. Never returned or logged.',
    format: 'password',
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString({ message: AuthMessages.PASSWORD_REQUIRED })
  @IsNotEmpty({ message: AuthMessages.PASSWORD_REQUIRED })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: AuthMessages.PASSWORD_REQUIRED })
  password!: string;
}
