import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Argon2id password hashing, per the OWASP Password Storage Cheat Sheet and
 * Stage 1 plan section 2.
 *
 * Only `argon2id` is ever used, and only hashes are persisted. Neither the
 * plaintext password nor the resulting hash is logged anywhere.
 */
@Injectable()
export class PasswordService {
  /**
   * OWASP's recommended Argon2id baseline: 19 MiB of memory, 2 iterations,
   * and 1 degree of parallelism.
   */
  private readonly options: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  };

  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.options);
  }

  /**
   * The cost parameters are encoded in the digest itself, so verification
   * reads them from the stored hash rather than from `options`. That keeps
   * existing hashes verifiable if the parameters above are ever raised.
   *
   * Returns false rather than throwing when the stored value is not a valid
   * Argon2 encoded hash, so a malformed row cannot turn a failed sign-in
   * into a 500 that is distinguishable from a normal rejection.
   */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }
}
