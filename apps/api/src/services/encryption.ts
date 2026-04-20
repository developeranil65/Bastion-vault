/**
 * Encryption Service — AES-256-GCM Envelope Encryption
 *
 * Architectural Constraints:
 * 1. Each secret gets a unique DEK (Data Encryption Key)
 * 2. The DEK encrypts the secret plaintext → encryptedData + iv + authTag
 * 3. The DEK itself is encrypted by the KEK (Master Key) → encryptedDek + dekIv + dekAuthTag
 * 4. Only encrypted forms are ever stored in DB
 * 5. Decrypted values exist only in RAM and are wiped after use
 *
 * Constraint: Persistence or external logging of decrypted buffers is strictly prohibited.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EncryptionResult {
  encryptedData: string;  // hex — secret encrypted with DEK
  encryptedDek: string;   // hex — DEK encrypted with KEK
  iv: string;             // hex — IV for data encryption
  authTag: string;        // hex — GCM auth tag for data encryption
  dekIv: string;          // hex — IV for DEK encryption
  dekAuthTag: string;     // hex — GCM auth tag for DEK encryption
  algorithm: string;
}

export interface DecryptionResult {
  decryptedData: string;
  keyValid: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH = 12;   // 96 bits (GCM recommended)
const AUTH_TAG_LENGTH = 16; // 128 bits

// ─── Service ─────────────────────────────────────────────────────────────────

export class EncryptionService {
  private kek: Buffer; // Key Encryption Key (Master Key)

  constructor() {
    const kekHex = process.env.KEK_KEY || process.env.ENCRYPTION_MASTER_KEY;

    if (!kekHex || kekHex.length < 32) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          '[EncryptionService] FATAL: KEK_KEY or ENCRYPTION_MASTER_KEY must be set (min 32 hex chars) in production.'
        );
      }
      // Development fallback — deterministic key for local testing only
      this.kek = Buffer.from('12345678901234567890123456789012'.slice(0, 32));
    } else {
      // Pad/trim to exactly 32 bytes
      this.kek = Buffer.from(kekHex.padEnd(64, '0').slice(0, 64), 'hex');
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Encrypt plaintext using envelope encryption.
   *
   * 1. Generate random DEK
   * 2. Encrypt plaintext with DEK → encryptedData + iv + authTag
   * 3. Encrypt DEK with KEK → encryptedDek + dekIv + dekAuthTag
   * 4. Wipe plaintext DEK from memory
   */
  encrypt(plaintext: string): EncryptionResult {
    // Step 1: Generate unique DEK for this secret
    const dek = randomBytes(KEY_LENGTH);

    // Step 2: Encrypt data with DEK
    const dataIv = randomBytes(IV_LENGTH);
    const dataCipher = createCipheriv(ALGORITHM, dek, dataIv, { authTagLength: AUTH_TAG_LENGTH });
    let encryptedData = dataCipher.update(plaintext, 'utf8', 'hex');
    encryptedData += dataCipher.final('hex');
    const dataAuthTag = dataCipher.getAuthTag();

    // Step 3: Encrypt DEK with KEK
    const dekIv = randomBytes(IV_LENGTH);
    const dekCipher = createCipheriv(ALGORITHM, this.kek, dekIv, { authTagLength: AUTH_TAG_LENGTH });
    let encryptedDek = dekCipher.update(dek).toString('hex');
    encryptedDek += dekCipher.final('hex');
    const dekAuthTag = dekCipher.getAuthTag();

    // Step 4: Wipe plaintext DEK from memory
    dek.fill(0);

    return {
      encryptedData,
      encryptedDek,
      iv: dataIv.toString('hex'),
      authTag: dataAuthTag.toString('hex'),
      dekIv: dekIv.toString('hex'),
      dekAuthTag: dekAuthTag.toString('hex'),
      algorithm: 'AES-256-GCM',
    };
  }

  /**
   * Decrypt data using envelope encryption.
   *
   * 1. Decrypt DEK using KEK + dekIv + dekAuthTag
   * 2. Decrypt data using DEK + iv + authTag
   * 3. Wipe DEK from memory
   */
  decrypt(
    encryptedData: string,
    encryptedDek: string,
    iv: string,
    authTag: string,
    dekIv: string,
    dekAuthTag: string,
  ): DecryptionResult {
    let dek: Buffer | null = null;

    try {
      // Step 1: Decrypt DEK with KEK
      const dekDecipher = createDecipheriv(
        ALGORITHM,
        this.kek,
        Buffer.from(dekIv, 'hex'),
      );
      dekDecipher.setAuthTag(Buffer.from(dekAuthTag, 'hex'));
      dek = Buffer.concat([
        dekDecipher.update(Buffer.from(encryptedDek, 'hex')),
        dekDecipher.final(),
      ]);

      // Step 2: Decrypt data with DEK
      const dataDecipher = createDecipheriv(
        ALGORITHM,
        dek,
        Buffer.from(iv, 'hex'),
      );
      dataDecipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let decrypted = dataDecipher.update(encryptedData, 'hex', 'utf8');
      decrypted += dataDecipher.final('utf8');

      return { decryptedData: decrypted, keyValid: true };
    } catch {
      return { decryptedData: '', keyValid: false };
    } finally {
      // Step 3: Wipe DEK from memory
      if (dek) dek.fill(0);
    }
  }

  /**
   * Re-encrypt: decrypt with current keys, then encrypt with a fresh DEK.
   * Used for secret rotation.
   */
  rotate(
    encryptedData: string,
    encryptedDek: string,
    iv: string,
    authTag: string,
    dekIv: string,
    dekAuthTag: string,
  ): EncryptionResult | null {
    const { decryptedData, keyValid } = this.decrypt(
      encryptedData, encryptedDek, iv, authTag, dekIv, dekAuthTag,
    );

    if (!keyValid) return null;

    const result = this.encrypt(decryptedData);
    return result;
  }

  /**
   * Validate that encryption subsystem is properly configured.
   */
  validateConfig(): boolean {
    return this.kek.length === KEY_LENGTH;
  }
}

// Singleton
export const encryptionService = new EncryptionService();
