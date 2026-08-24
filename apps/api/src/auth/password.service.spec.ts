import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('produces an Argon2id encoded hash', async () => {
    const hash = await service.hash('Correct-Horse-1');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('never stores the plaintext inside the hash', async () => {
    const plaintext = 'Correct-Horse-1';

    const hash = await service.hash(plaintext);

    expect(hash).not.toContain(plaintext);
  });

  it('salts every hash, so the same password hashes differently', async () => {
    const [first, second] = await Promise.all([
      service.hash('Correct-Horse-1'),
      service.hash('Correct-Horse-1'),
    ]);

    expect(first).not.toEqual(second);
  });

  it('verifies a matching password', async () => {
    const hash = await service.hash('Correct-Horse-1');

    await expect(service.verify(hash, 'Correct-Horse-1')).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await service.hash('Correct-Horse-1');

    await expect(service.verify(hash, 'Correct-Horse-2')).resolves.toBe(false);
  });

  it('rejects rather than throws when the stored hash is malformed', async () => {
    await expect(service.verify('not-a-hash', 'Correct-Horse-1')).resolves.toBe(
      false,
    );
  });
});
