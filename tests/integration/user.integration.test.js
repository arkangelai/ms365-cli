import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import graphClient from '../../src/graph/client.js';
import { searchUser } from '../../src/commands/user.js';
import { getAvailableAccounts, setupAuth, teardownAuth } from './helpers/setup.js';

const accounts = getAvailableAccounts();

describe('[Integration] User search — Graph API', { timeout: 30000 }, () => {
  if (accounts.length === 0) {
    it('requires integration env vars', (ctx) => {
      console.log('⏭️  Integration env vars not set — skipping user integration tests');
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

    describe('Organization users (/users endpoint)', () => {
      it('should search organization users by name', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();
        // Org user search is not available for personal accounts
        if (account.type === 'personal') return ctx.skip();

        const results = await graphClient.user.searchUsers('a', { top: 5 });

        expect(Array.isArray(results)).toBe(true);

        for (const user of results) {
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('displayName');
          expect(user).toHaveProperty('userPrincipalName');
          expect('mail' in user).toBe(true);
        }
      });

      it('should respect the top parameter', async (ctx) => {
        if (!hasAuth) return ctx.skip();
        if (account.type === 'personal') return ctx.skip();

        const results = await graphClient.user.searchUsers('a', { top: 2 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should return empty array for nonsense query', async (ctx) => {
        if (!hasAuth) return ctx.skip();
        if (account.type === 'personal') return ctx.skip();

        const results = await graphClient.user.searchUsers('zzxqqnonexistent99', { top: 5 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      });
    });

    describe('Personal contacts (/me/contacts endpoint)', () => {
      it('should search personal contacts by name', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const results = await graphClient.user.searchContacts('a', { top: 5 });

        expect(Array.isArray(results)).toBe(true);

        for (const contact of results) {
          expect(contact).toHaveProperty('id');
          expect(contact).toHaveProperty('displayName');
          expect(Array.isArray(contact.emailAddresses)).toBe(true);
        }
      });

      it('should return empty array for nonsense query', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const results = await graphClient.user.searchContacts('zzxqqnonexistent99', { top: 5 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      });
    });

    describe('Full searchUser() command flow', () => {
      it('should execute the full search flow without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          searchUser('a', { top: 5, json: true })
        ).resolves.not.toThrow();
      });

      it('should handle empty results gracefully', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          searchUser('zzxqqnonexistent99', { top: 5, json: true })
        ).resolves.not.toThrow();
      });
    });
  });
});
