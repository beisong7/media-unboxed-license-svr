import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

export interface LicensePayload {
  licenseId: string;
  expiresAt: string;
  licensedTo: string;
  email: string;
  features: string[];
  maxDevices?: number;
  offlineGraceDays?: number;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKeys: string[];

  constructor(private configService: ConfigService) {
    this.encryptionKeys =
      this.configService.get<string[]>('license.encryptionKeys') || [];

    if (this.encryptionKeys.length === 0) {
      this.logger.warn('No encryption keys configured!');
    }
  }

  /**
   * Get the primary encryption key (first in the list)
   */
  private getPrimaryKey(): string {
    if (this.encryptionKeys.length === 0) {
      throw new Error('No encryption keys configured');
    }
    return this.encryptionKeys[0];
  }

  /**
   * Derive a 32-byte key from the encryption key using scrypt
   */
  private deriveKey(encryptionKey: string): Buffer {
    return crypto.scryptSync(encryptionKey, 'mediaunboxed-salt', 32);
  }

  /**
   * Encrypt license payload using the primary key
   */
  encrypt(payload: LicensePayload): string {
    const primaryKey = this.getPrimaryKey();
    const key = this.deriveKey(primaryKey);
    const iv = crypto.randomBytes(IV_LENGTH);

    // DEBUG: Log encryption key (masked for security)
    const maskedKey =
      primaryKey.substring(0, 4) +
      '****' +
      primaryKey.substring(primaryKey.length - 4);
    this.logger.debug(
      `Using encryption key: ${maskedKey} (length: ${primaryKey.length})`,
    );
    this.logger.debug(`Derived key (hex): ${key.toString('hex')}`);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(JSON.stringify(payload), 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: IV (16 bytes) + AuthTag (16 bytes) + EncryptedData
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypt license key, trying all available keys for backward compatibility
   */
  decrypt(encryptedBase64: string): LicensePayload | null {
    for (const encryptionKey of this.encryptionKeys) {
      try {
        const result = this.decryptWithKey(encryptedBase64, encryptionKey);
        if (result) {
          return result;
        }
      } catch (error) {
        // Try next key
        continue;
      }
    }

    this.logger.warn('Failed to decrypt license with any available key');
    return null;
  }

  /**
   * Decrypt with a specific key
   */
  private decryptWithKey(
    encryptedBase64: string,
    encryptionKey: string,
  ): LicensePayload | null {
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');

      if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        return null;
      }

      const iv = buffer.subarray(0, IV_LENGTH);
      const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const key = this.deriveKey(encryptionKey);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as LicensePayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a SHA-256 hash of the payload for verification
   */
  hashPayload(payload: LicensePayload): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
