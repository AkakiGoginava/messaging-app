import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { toFieldErrors } from '../common/validation/validation-exception.factory';
import { AuthMessages } from './auth.messages';
import { normalizeEmail } from './auth.rules';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

async function fieldErrorsFor<T extends object>(
  dto: new () => T,
  payload: Record<string, unknown>,
): Promise<Record<string, string>> {
  const instance = plainToInstance(dto, payload);
  const errors = await validate(instance, { stopAtFirstError: true });
  return toFieldErrors(errors);
}

describe('registration rules', () => {
  it('accepts a valid username, email, and password', async () => {
    await expect(
      fieldErrorsFor(RegisterDto, {
        username: 'jordan_lee',
        email: 'jordan@example.com',
        password: 'Correct-Horse-1',
      }),
    ).resolves.toEqual({});
  });

  it.each([
    ['too short', 'jo'],
    ['too long', 'j'.repeat(21)],
    ['contains a hyphen', 'jordan-lee'],
    ['contains a space', 'jordan lee'],
    ['contains a dot', 'jordan.lee'],
    ['empty', ''],
  ])('rejects a username that is %s', async (_case, username) => {
    const fieldErrors = await fieldErrorsFor(RegisterDto, {
      username,
      email: 'jordan@example.com',
      password: 'Correct-Horse-1',
    });

    expect(fieldErrors.username).toBe(AuthMessages.USERNAME_INVALID);
  });

  it.each([
    ['exactly 3 characters', 'joe'],
    ['exactly 20 characters', 'j'.repeat(20)],
    ['all underscores', '___'],
    ['digits only', '007'],
  ])('accepts a username that is %s', async (_case, username) => {
    const fieldErrors = await fieldErrorsFor(RegisterDto, {
      username,
      email: 'jordan@example.com',
      password: 'Correct-Horse-1',
    });

    expect(fieldErrors.username).toBeUndefined();
  });

  it.each([
    ['missing a domain', 'jordan@'],
    ['missing an @', 'jordan.example.com'],
    ['empty', ''],
  ])('rejects an email that is %s', async (_case, email) => {
    const fieldErrors = await fieldErrorsFor(RegisterDto, {
      username: 'jordan_lee',
      email,
      password: 'Correct-Horse-1',
    });

    expect(fieldErrors.email).toBe(AuthMessages.EMAIL_INVALID);
  });

  it.each([
    ['shorter than 12 characters', 'Short-1'],
    ['longer than 128 characters', `A1${'a'.repeat(127)}`],
    ['missing an uppercase letter', 'correct-horse-1'],
    ['missing a digit', 'Correct-Horse-x'],
  ])('rejects a password that is %s', async (_case, password) => {
    const fieldErrors = await fieldErrorsFor(RegisterDto, {
      username: 'jordan_lee',
      email: 'jordan@example.com',
      password,
    });

    expect(fieldErrors.password).toBe(AuthMessages.PASSWORD_INVALID);
  });

  it.each([
    ['exactly 12 characters', 'Abcdefghij12'],
    ['exactly 128 characters', `A1${'a'.repeat(126)}`],
    ['full of symbols', 'A1!@#$%^&*()_+'],
  ])('accepts a password that is %s', async (_case, password) => {
    const fieldErrors = await fieldErrorsFor(RegisterDto, {
      username: 'jordan_lee',
      email: 'jordan@example.com',
      password,
    });

    expect(fieldErrors.password).toBeUndefined();
  });

  it('does not trim the password, because spaces are valid characters', () => {
    const instance = plainToInstance(RegisterDto, {
      username: ' jordan_lee ',
      email: ' Jordan@Example.com ',
      password: '  Correct-Horse-1  ',
    });

    expect(instance.username).toBe('jordan_lee');
    expect(instance.email).toBe('Jordan@Example.com');
    expect(instance.password).toBe('  Correct-Horse-1  ');
  });
});

describe('sign-in rules', () => {
  it('accepts any non-empty identifier and password', async () => {
    await expect(
      fieldErrorsFor(LoginDto, { identifier: 'jordan_lee', password: 'x' }),
    ).resolves.toEqual({});
  });

  it('requires an identifier', async () => {
    const fieldErrors = await fieldErrorsFor(LoginDto, {
      identifier: '   ',
      password: 'Correct-Horse-1',
    });

    expect(fieldErrors.identifier).toBe(AuthMessages.IDENTIFIER_REQUIRED);
  });

  it('requires a password', async () => {
    const fieldErrors = await fieldErrorsFor(LoginDto, {
      identifier: 'jordan_lee',
      password: '',
    });

    expect(fieldErrors.password).toBe(AuthMessages.PASSWORD_REQUIRED);
  });

  it('does not apply the registration password policy to sign-in', async () => {
    const fieldErrors = await fieldErrorsFor(LoginDto, {
      identifier: 'jordan_lee',
      password: 'short',
    });

    expect(fieldErrors.password).toBeUndefined();
  });
});

describe('normalizeEmail', () => {
  it.each([
    ['Jordan@Example.com', 'jordan@example.com'],
    ['  jordan@example.com  ', 'jordan@example.com'],
    ['JORDAN@EXAMPLE.COM', 'jordan@example.com'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});
