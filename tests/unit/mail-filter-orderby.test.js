import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock token manager
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
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

/**
 * Helper: extract URL query params from the first mockFetch call
 */
function getQueryParams() {
  const url = mockFetch.mock.calls[0][0];
  const parsed = new URL(url);
  return Object.fromEntries(parsed.searchParams.entries());
}

/**
 * Stub mockFetch to return a successful Graph API mail list response
 */
function stubMailListResponse(mails = []) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ value: mails }),
  });
}

describe('GraphClient mail.list — filter & orderby query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Default behavior (no filter) ───────────────────────────────
  describe('without filter', () => {
    it('should default $orderby to receivedDateTime desc', async () => {
      stubMailListResponse();

      await graphClient.mail.list({ top: 5 });

      const params = getQueryParams();
      expect(params['$orderby']).toBe('receivedDateTime desc');
      expect(params).not.toHaveProperty('$filter');
    });

    it('should use custom orderby when provided', async () => {
      stubMailListResponse();

      await graphClient.mail.list({ top: 5, orderby: 'subject asc' });

      const params = getQueryParams();
      expect(params['$orderby']).toBe('subject asc');
      expect(params).not.toHaveProperty('$filter');
    });

    it('should set $top from options', async () => {
      stubMailListResponse();

      await graphClient.mail.list({ top: 3 });

      const params = getQueryParams();
      expect(params['$top']).toBe('3');
    });
  });

  // ─── Filter without receivedDateTime (workaround) ──────────────
  describe('with filter NOT containing receivedDateTime', () => {
    it('should prepend receivedDateTime ge 1900-01-01 to the filter', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "inferenceClassification eq 'focused'",
      });

      const params = getQueryParams();
      expect(params['$filter']).toBe(
        "receivedDateTime ge 1900-01-01 AND inferenceClassification eq 'focused'"
      );
    });

    it('should preserve default $orderby when workaround filter is applied', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "inferenceClassification eq 'focused'",
      });

      const params = getQueryParams();
      expect(params['$orderby']).toBe('receivedDateTime desc');
    });

    it('should preserve custom $orderby when workaround filter is applied', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "inferenceClassification eq 'focused'",
        orderby: 'receivedDateTime asc',
      });

      const params = getQueryParams();
      expect(params['$orderby']).toBe('receivedDateTime asc');
      expect(params['$filter']).toBe(
        "receivedDateTime ge 1900-01-01 AND inferenceClassification eq 'focused'"
      );
    });

    it('should apply workaround for any filter without receivedDateTime', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 10,
        filter: "isRead eq false",
      });

      const params = getQueryParams();
      expect(params['$filter']).toBe(
        "receivedDateTime ge 1900-01-01 AND isRead eq false"
      );
    });
  });

  // ─── Filter already containing receivedDateTime (no workaround) ─
  describe('with filter already containing receivedDateTime', () => {
    it('should NOT prepend workaround when filter includes receivedDateTime', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "receivedDateTime ge 2026-01-01 AND inferenceClassification eq 'focused'",
      });

      const params = getQueryParams();
      expect(params['$filter']).toBe(
        "receivedDateTime ge 2026-01-01 AND inferenceClassification eq 'focused'"
      );
    });

    it('should handle case-insensitive receivedDateTime detection', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "ReceivedDateTime ge 2026-01-01",
      });

      const params = getQueryParams();
      // Should pass through unchanged — no workaround prefix
      expect(params['$filter']).toBe("ReceivedDateTime ge 2026-01-01");
      expect(params['$filter']).not.toContain('1900-01-01');
    });

    it('should preserve $orderby when filter already has receivedDateTime', async () => {
      stubMailListResponse();

      await graphClient.mail.list({
        top: 5,
        filter: "receivedDateTime ge 2026-01-01",
      });

      const params = getQueryParams();
      expect(params['$orderby']).toBe('receivedDateTime desc');
    });
  });

  // ─── URL structure ──────────────────────────────────────────────
  describe('URL construction', () => {
    it('should target correct mailFolder endpoint for inbox', async () => {
      stubMailListResponse();

      await graphClient.mail.list({ top: 5, folder: 'inbox' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/me/mailFolders/inbox/messages');
    });

    it('should map friendly folder names to Graph API names', async () => {
      stubMailListResponse();

      await graphClient.mail.list({ top: 5, folder: 'sent' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/me/mailFolders/sentitems/messages');
    });
  });
});
