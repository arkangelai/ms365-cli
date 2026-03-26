import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock token manager
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  forceRefreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
}));

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  default: {
    get: vi.fn((key) => {
      const config = {
        graphApiUrl: 'https://graph.microsoft.com/v1.0',
      };
      return config[key];
    }),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import AFTER mocks — vitest hoists vi.mock
import graphClient from '../../src/graph/client.js';
import { InsufficientPrivilegesError, ApiError, TokenExpiredError } from '../../src/utils/error.js';
import { getAccessToken, forceRefreshAccessToken } from '../../src/auth/token-manager.js';
describe('GraphClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request error handling', () => {
    it('should throw InsufficientPrivilegesError on 403 AccessDenied without retrying', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: {
            code: 'Authorization_RequestDenied',
            message: 'Insufficient privileges to complete the operation.',
          },
        }),
      });

      await expect(graphClient.get('/sites/test-site/drive')).rejects.toBeInstanceOf(InsufficientPrivilegesError);

      // Should NOT have made a second fetch call (no retry)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw ApiError on non-403 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          error: {
            code: 'itemNotFound',
            message: 'The resource could not be found.',
          },
        }),
      });

      await expect(graphClient.get('/me/messages/nonexistent')).rejects.toBeInstanceOf(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry once on 401 with force token refresh', async () => {
      // First call: 401 Unauthorized
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Access token has expired.',
          },
        }),
      });
      // Second call after refresh: 200 OK
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '123', displayName: 'Test User' }),
      });

      const result = await graphClient.get('/me');

      expect(forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: '123', displayName: 'Test User' });
    });

    it('should not retry more than once on consecutive 401s (_retried flag)', async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Access token has expired.',
          },
        }),
      });
      // Second call after refresh: still 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Access token has expired.',
          },
        }),
      });

      await expect(graphClient.get('/me')).rejects.toThrow();

      // forceRefreshAccessToken called once (first 401), not again (second 401 has _retried=true)
      expect(forceRefreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
