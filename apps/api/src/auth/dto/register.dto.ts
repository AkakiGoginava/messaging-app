import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

import { AuthMessages } from '../auth.messages';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../auth.rules';

export class RegisterDto {
  @ApiProperty({
    description: `Public display name. ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} letters, numbers, or underscores.`,
    example: 'jordan_lee',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  @IsString({ message: AuthMessages.USERNAME_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, {
    message: AuthMessages.USERNAME_INVALID,
  })
  @Matches(USERNAME_PATTERN, { message: AuthMessages.USERNAME_INVALID })
  username!: string;

  @ApiProperty({
    description:
      'Email address. Stored lowercase-normalized; never disclosed by ' +
      'conflict responses.',
    example: 'jordan@example.com',
    maxLength: EMAIL_MAX_LENGTH,
  })
  @IsString({ message: AuthMessages.EMAIL_INVALID })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(EMAIL_MAX_LENGTH, { message: AuthMessages.EMAIL_INVALID })
  @IsEmail({}, { message: AuthMessages.EMAIL_INVALID })
  email!: string;

  @ApiProperty({
    description:
      `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters with at ` +
      'least one uppercase letter and one digit. Never returned or logged.',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString({ message: AuthMessages.PASSWORD_INVALID })
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, {
    message: AuthMessages.PASSWORD_INVALID,
  })
  @Matches(PASSWORD_PATTERN, { message: AuthMessages.PASSWORD_INVALID })
  password!: string;
}
