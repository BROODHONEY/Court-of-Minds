/**
 * Secure credential storage and management
 * Validates Requirement 8.2: Secure credential storage
 */

import crypto from 'crypto';
import { ConfigurationError } from './types.js';

/**
 * Encryption algorithm and settings
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Encrypted credential structure
 */
export interface EncryptedCredential {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

/**
 * Credential store for managing API keys and secrets
 */
export class CredentialStore {
  private masterKey: Buffer | null = null;

  /**
   * Initializes the credential store with a master key
   * The master key should be stored securely (e.g., environment variable, key management service)
   */
  initialize(masterPassword: string): void {
    if (!masterPassword || masterPassword.length < 32) {
      throw new ConfigurationError('Master password must be at least 32 characters');
    }

    // Derive a key from the master password
    const salt = crypto.randomBytes(SALT_LENGTH);
    this.masterKey = crypto.pbkdf2Sync(masterPassword, salt, 100000, KEY_LENGTH, 'sha512');
  }

  /**
   * Encrypts a credential (API key, password, etc.)
   */
  encrypt(plaintext: string): EncryptedCredential {
    if (!this.masterKey) {
      throw new ConfigurationError('Credential store not initialized');
    }

    if (!plaintext || plaintext.trim() === '') {
      throw new ConfigurationError('Cannot encrypt empty credential');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Generate salt for this credential
    const salt = crypto.randomBytes(SALT_LENGTH);

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
    };
  }

  /**
   * Decrypts a credential
   */
  decrypt(credential: EncryptedCredential): string {
    if (!this.masterKey) {
      throw new ConfigurationError('Credential store not initialized');
    }

    try {
      // Convert hex strings back to buffers
      const iv = Buffer.from(credential.iv, 'hex');
      const authTag = Buffer.from(credential.authTag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(credential.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new ConfigurationError('Failed to decrypt credential: invalid key or corrupted data');
    }
  }

  /**
   * Masks a credential for display (shows only first and last 4 characters)
   */
  static mask(credential: string): string {
    if (!credential || credential.length < 8) {
      return '****';
    }

    const first = credential.substring(0, 4);
    const last = credential.substring(credential.length - 4);
    const masked = '*'.repeat(Math.min(credential.length - 8, 20));

    return `${first}${masked}${last}`;
  }

  /**
   * Validates that a credential meets minimum security requirements
   */
  static validate(credential: string, minLength: number = 20): boolean {
    if (!credential || credential.length < minLength) {
      return false;
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^[0-9]+$/, // Only numbers
      /^[a-z]+$/i, // Only letters
      /^(.)\1+$/, // Repeated character
      /^(test|demo|example|sample)/i, // Test/demo keys
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(credential)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generates a secure random API key
   */
  static generate(length: number = 32): string {
    const bytes = crypto.randomBytes(length);
    return bytes.toString('base64').replace(/[+/=]/g, '').substring(0, length);
  }

  /**
   * Hashes a credential for comparison (one-way)
   */
  static hash(credential: string): string {
    return crypto.createHash('sha256').update(credential).digest('hex');
  }

  /**
   * Compares a plaintext credential with a hashed credential
   */
  static compare(plaintext: string, hash: string): boolean {
    const plaintextHash = this.hash(plaintext);
    return crypto.timingSafeEqual(Buffer.from(plaintextHash), Buffer.from(hash));
  }
}

/**
 * In-memory credential cache with automatic expiration
 */
export class CredentialCache {
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private defaultTTL: number = 3600000; // 1 hour in milliseconds

  /**
   * Sets a credential in the cache
   */
  set(key: string, value: string, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Gets a credential from the cache
   */
  get(key: string): string | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Removes a credential from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears all credentials from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Removes expired credentials from the cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gets the number of cached credentials
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Global credential cache instance
 */
export const credentialCache = new CredentialCache();

/**
 * Schedules automatic cleanup of expired credentials
 */
export function scheduleCredentialCleanup(intervalMs: number = 300000): NodeJS.Timeout {
  return setInterval(() => {
    credentialCache.cleanup();
  }, intervalMs);
}
