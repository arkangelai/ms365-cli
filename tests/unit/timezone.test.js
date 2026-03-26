import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config — factory must not reference top-level variables
vi.mock('../../src/utils/config.js', () => ({
  default: {
    get: vi.fn((key) => {
      if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
      return undefined;
    }),
  },
}));

// Mock token-manager
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

// Mock error module
vi.mock('../../src/utils/error.js', () => ({
  ApiError: class ApiError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
  parseGraphError: vi.fn((data, status) => {
    const err = new Error(data?.error?.message || `API Error (${status})`);
    err.name = 'ApiError';
    err.statusCode = status;
    return err;
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks are set up
import graphClient from '../../src/graph/client.js';
import config from '../../src/utils/config.js';

describe('GraphClient.getTimezone()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cached timezone between tests
    graphClient._cachedTimezone = null;
    // Default config: graphApiUrl only, no timezone
    config.get.mockImplementation((key) => {
      if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
      return undefined;
    });
  });

  describe('Fallback chain', () => {
    it('should return config/env timezone when set (level 1)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return 'America/New_York';
        return undefined;
      });

      const tz = await graphClient.getTimezone();
      expect(tz).toBe('America/New_York');
      // Should not call Graph API
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return Graph API mailboxSettings timezone (level 2)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ timeZone: 'China Standard Time' }),
      });

      const tz = await graphClient.getTimezone();
      expect(tz).toBe('China Standard Time');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/me/mailboxSettings');
    });

    it('should return system timezone when Graph API fails with 403 (level 3)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      // Graph API responds with 403
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 'AccessDenied', message: 'Insufficient privileges' },
        }),
      });

      const tz = await graphClient.getTimezone();
      // Falls through to Intl — should be a non-empty IANA string
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
      // Verify Graph API was attempted
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return UTC when both Graph API and Intl fail (level 4)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      // Graph API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 'AccessDenied', message: 'Insufficient privileges' },
        }),
      });

      // Mock Intl to fail
      const originalIntl = globalThis.Intl;
      globalThis.Intl = {
        DateTimeFormat: () => { throw new Error('Intl unavailable'); },
      };

      try {
        const tz = await graphClient.getTimezone();
        expect(tz).toBe('UTC');
      } finally {
        globalThis.Intl = originalIntl;
      }
    });

    it('should fall through when Graph API returns null timeZone', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ timeZone: null }),
      });

      const tz = await graphClient.getTimezone();
      // Should fall through to Intl — non-empty string
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache the timezone after first call', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return 'Europe/London';
        return undefined;
      });

      const tz1 = await graphClient.getTimezone();
      const tz2 = await graphClient.getTimezone();

      expect(tz1).toBe('Europe/London');
      expect(tz2).toBe('Europe/London');
      // config.get('timezone') should be called only once due to caching
      const timezoneCalls = config.get.mock.calls.filter(c => c[0] === 'timezone');
      expect(timezoneCalls.length).toBe(1);
    });

    it('should return cached value on subsequent calls', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ timeZone: 'Pacific Standard Time' }),
      });

      const tz1 = await graphClient.getTimezone();
      const tz2 = await graphClient.getTimezone();

      expect(tz1).toBe('Pacific Standard Time');
      expect(tz2).toBe('Pacific Standard Time');
      // Fetch only called once — second call uses cache
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should treat empty string config as falsy (fall through)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ timeZone: 'Eastern Standard Time' }),
      });

      const tz = await graphClient.getTimezone();
      expect(tz).toBe('Eastern Standard Time');
    });

    it('should handle Graph API network error gracefully', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        if (key === 'timezone') return '';
        return undefined;
      });

      // Network error (fetch rejects)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const tz = await graphClient.getTimezone();
      // Should fall through to Intl, not throw
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('should treat undefined config timezone as falsy', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'graphApiUrl') return 'https://graph.microsoft.com/v1.0';
        // timezone not configured at all — returns undefined
        return undefined;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ timeZone: 'Tokyo Standard Time' }),
      });

      const tz = await graphClient.getTimezone();
      expect(tz).toBe('Tokyo Standard Time');
    });
  });
});
