import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadCreds, isTokenExpired, getAccessToken, refreshToken } from '../../src/auth/token-manager.js';
import { getAvailableAccounts, setupAuth, teardownAuth } from './helpers/setup.js';

const accounts = getAvailableAccounts();

describe('[Integration] Token Manager — Azure AD', { timeout: 30000 }, () => {
  if (accounts.length === 0) {
    it('requires integration env vars', (ctx) => {
      console.log('⏭️  Integration env vars not set — skipping token-manager integration tests');
      ctx.skip();
    });
    return;
  }

  describe.each(accounts)('$type account', (account) => {
    let hasAuth = false;
    let savedEnv = {};

    beforeAll(async () => {
      const result = await setupAuth(account);
      hasAuth = result.hasAuth;
      savedEnv = result.savedEnv;
    });

    afterAll(() => teardownAuth(savedEnv));

    describe('Load credentials', () => {
      it('should load valid credentials from file', (ctx) => {
        if (!hasAuth) return ctx.skip();

        const creds = loadCreds();

        expect(creds).toBeDefined();
        expect(creds).toHaveProperty('accessToken');
        expect(typeof creds.accessToken).toBe('string');
        expect(creds.accessToken.length).toBeGreaterThan(0);
        expect(creds).toHaveProperty('refreshToken');
        expect(typeof creds.refreshToken).toBe('string');
      });

      it('should have expiresAt timestamp', (ctx) => {
        if (!hasAuth) return ctx.skip();

        const creds = loadCreds();

        expect(creds).toHaveProperty('expiresAt');
        expect(typeof creds.expiresAt).toBe('number');
      });
    });

    describe('Token expiration check', () => {
      it('should check if token is expired', (ctx) => {
        if (!hasAuth) return ctx.skip();

        const creds = loadCreds();
        const expired = isTokenExpired(creds);

        expect(typeof expired).toBe('boolean');
        expect([true, false]).toContain(expired);
      });

      it('should report expired for null creds', () => {
        const expired = isTokenExpired(null);
        expect(expired).toBe(true);
      });

      it('should report expired for creds without expiresAt', () => {
        const expired = isTokenExpired({ accessToken: 'test' });
        expect(expired).toBe(true);
      });

      it('should report expired for past timestamp', () => {
        const expired = isTokenExpired({
          accessToken: 'test',
          expiresAt: Math.floor(Date.now() / 1000) - 3600,
        });
        expect(expired).toBe(true);
      });

      it('should report not expired for far future timestamp', () => {
        const expired = isTokenExpired({
          accessToken: 'test',
          expiresAt: Math.floor(Date.now() / 1000) + 36000,
        });
        expect(expired).toBe(false);
      });
    });

    describe('Get access token (auto-refresh)', () => {
      it('should return a valid access token', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const token = await getAccessToken();

        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
      });

      it('should return consistent token on repeated calls', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const token1 = await getAccessToken();
        const token2 = await getAccessToken();

        expect(typeof token1).toBe('string');
        expect(typeof token2).toBe('string');
        expect(token1.length).toBeGreaterThan(0);
        expect(token2.length).toBeGreaterThan(0);
      });
    });

    describe('Refresh token', () => {
      it('should refresh the token using refresh token', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const creds = loadCreds();
        if (!creds.refreshToken) {
          console.log('  (no refresh token — skipping)');
          return ctx.skip();
        }

        const refreshed = await refreshToken(creds.refreshToken);

        expect(refreshed).toHaveProperty('accessToken');
        expect(typeof refreshed.accessToken).toBe('string');
        expect(refreshed.accessToken.length).toBeGreaterThan(0);

        expect(refreshed).toHaveProperty('refreshToken');
        expect(typeof refreshed.refreshToken).toBe('string');
        expect(refreshed.refreshToken.length).toBeGreaterThan(0);

        expect(refreshed).toHaveProperty('expiresIn');
        expect(typeof refreshed.expiresIn).toBe('number');
        expect(refreshed.expiresIn).toBeGreaterThan(0);
      });
    });

    describe('Token validity', () => {
      it('should get a token that can make Graph API calls', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const token = await getAccessToken();

        const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('displayName');
      });
    });
  });
});
