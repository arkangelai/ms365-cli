import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs module before importing
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { isTrustedSender } from '../../src/utils/trusted-senders.js';
import { existsSync, readFileSync } from 'fs';

describe('isTrustedSender', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no whitelist file
    existsSync.mockReturnValue(false);
  });

  describe('without currentUserEmail', () => {
    it('should return false for null email', () => {
      expect(isTrustedSender(null)).toBe(false);
    });

    it('should return false for undefined email', () => {
      expect(isTrustedSender(undefined)).toBe(false);
    });

    it('should return false for empty email', () => {
      expect(isTrustedSender('')).toBe(false);
    });

    it('should return true for Exchange DN format (EXCHANGELABS)', () => {
      const exchangeEmail = '/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP/CN=RECIPIENTS/CN=user';
      expect(isTrustedSender(exchangeEmail)).toBe(true);
    });

    it('should return true for Exchange DN format (EXCHANGE)', () => {
      const exchangeEmail = '/O=EXCHANGE/OU=SITE/CN=RECIPIENTS/CN=user';
      expect(isTrustedSender(exchangeEmail)).toBe(true);
    });

    it('should return false for untrusted external email (no whitelist)', () => {
      expect(isTrustedSender('attacker@evil.com')).toBe(false);
    });
  });

  describe('with currentUserEmail', () => {
    const currentUserEmail = 'user@example.com';

    it('should return true when sender equals current user (exact match)', () => {
      expect(isTrustedSender('user@example.com', currentUserEmail)).toBe(true);
    });

    it('should return true when sender equals current user (case insensitive)', () => {
      expect(isTrustedSender('USER@EXAMPLE.COM', currentUserEmail)).toBe(true);
    });

    it('should return true when sender has different case (currentUserEmail)', () => {
      expect(isTrustedSender('user@example.com', 'USER@EXAMPLE.COM')).toBe(true);
    });

    it('should return false when sender is different from current user', () => {
      expect(isTrustedSender('other@example.com', currentUserEmail)).toBe(false);
    });

    it('should prioritize currentUserEmail check over whitelist', () => {
      // Even if not in whitelist, own email should be trusted
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue('other@example.com'); // Only other is in whitelist
      
      expect(isTrustedSender('user@example.com', currentUserEmail)).toBe(true);
    });
  });

  describe('with whitelist file', () => {
    beforeEach(() => {
      existsSync.mockReturnValue(true);
    });

    it('should return true for whitelisted email', () => {
      readFileSync.mockReturnValue('trusted@example.com\nuser@company.com');
      expect(isTrustedSender('trusted@example.com')).toBe(true);
    });

    it('should return true for whitelisted domain', () => {
      readFileSync.mockReturnValue('@example.com\n@company.com');
      expect(isTrustedSender('anyone@company.com')).toBe(true);
    });

    it('should return false for non-whitelisted email', () => {
      readFileSync.mockReturnValue('trusted@example.com');
      expect(isTrustedSender('attacker@evil.com')).toBe(false);
    });

    it('should handle comments in whitelist file', () => {
      readFileSync.mockReturnValue('# This is a comment\ntrusted@example.com\n# Another comment');
      expect(isTrustedSender('trusted@example.com')).toBe(true);
    });

    it('should handle empty lines in whitelist file', () => {
      readFileSync.mockReturnValue('trusted@example.com\n\n\nuser@company.com');
      expect(isTrustedSender('user@company.com')).toBe(true);
    });

    it('should match domain case insensitively', () => {
      readFileSync.mockReturnValue('@EXAMPLE.COM');
      expect(isTrustedSender('user@example.com')).toBe(true);
    });
  });
});
