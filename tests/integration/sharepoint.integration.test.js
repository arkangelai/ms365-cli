import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import graphClient from '../../src/graph/client.js';
import sharepointCommands from '../../src/commands/sharepoint.js';
import { getAvailableAccounts, setupAuth, teardownAuth } from './helpers/setup.js';

const INTEGRATION_SP_SITE = process.env.M365_INTEGRATION_SP_SITE;

// SharePoint is work-account only
const accounts = getAvailableAccounts({ workOnly: true });

describe('[Integration] SharePoint — Graph API', { timeout: 30000 }, () => {
  if (accounts.length === 0) {
    it('requires integration env vars (work account)', (ctx) => {
      console.log('⏭️  Integration env vars not set — skipping SharePoint integration tests');
      ctx.skip();
    });
    return;
  }

  describe.each(accounts)('$type account', (account) => {
    let hasAuth = false;
    let savedEnv = {};
    let resolvedSiteId = null;

    beforeAll(async () => {
      const result = await setupAuth(account);
      hasAuth = result.hasAuth;
      savedEnv = result.savedEnv;

      if (hasAuth && INTEGRATION_SP_SITE) {
        try {
          resolvedSiteId = await graphClient.sharepoint._parseSite(INTEGRATION_SP_SITE);
        } catch (error) {
          console.log(`⚠️  Could not resolve SP site (${error.message}) — site-specific tests will skip`);
        }
      }
    });

    afterAll(() => teardownAuth(savedEnv));
  describe('List sites', () => {
    it('should list followed sites', { retry: 2 }, async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        const sites = await graphClient.sharepoint.sites({ top: 5 });

        expect(Array.isArray(sites)).toBe(true);

        for (const site of sites) {
          expect(site).toHaveProperty('id');
          expect(site).toHaveProperty('name');
          expect(site).toHaveProperty('webUrl');
        }
      } catch (error) {
        // SharePoint may not be available for all accounts
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (SharePoint access denied — skipping)');
          return ctx.skip();
        }
        // Network errors (fetch failed) on first call — retry handles this
        throw error;
      }
    });

    it('should search sites by keyword', { retry: 2 }, async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        const sites = await graphClient.sharepoint.sites({ search: 'team', top: 5 });

        expect(Array.isArray(sites)).toBe(true);
        // May return empty if no sites match
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (SharePoint access denied — skipping)');
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should respect top parameter', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        const sites = await graphClient.sharepoint.sites({ top: 2 });

        expect(Array.isArray(sites)).toBe(true);
        expect(sites.length).toBeLessThanOrEqual(2);
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          return ctx.skip();
        }
        throw error;
      }
    });
  });

  describe('Parse site URL', () => {
    it('should parse a Graph API ID (hostname,guid,guid) format', async (ctx) => {
      if (!hasAuth) return ctx.skip();
      if (!resolvedSiteId) {
        console.log('  (no SP site configured — skipping)');
        return ctx.skip();
      }

      // The resolved site ID should be a parseable Graph ID (hostname,guid,guid)
      const parsed = await graphClient.sharepoint._parseSite(resolvedSiteId);
      expect(typeof parsed).toBe('string');
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should parse hostname:/path format', async (ctx) => {
      if (!hasAuth) return ctx.skip();
      if (!INTEGRATION_SP_SITE || !INTEGRATION_SP_SITE.includes(':/')) {
        console.log('  (no hostname:/path site configured — skipping)');
        return ctx.skip();
      }

      try {
        const siteId = await graphClient.sharepoint._parseSite(INTEGRATION_SP_SITE);
        expect(typeof siteId).toBe('string');
        expect(siteId.length).toBeGreaterThan(0);
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 404) {
          console.log(`  (site not accessible: ${error.message} — skipping)`);
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should throw for invalid site', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      await expect(
        graphClient.sharepoint._parseSite('invalid-nonexistent-host.example.com:/sites/fakefake')
      ).rejects.toThrow();
    });
  });

  describe('List site lists', () => {
    it('should list site lists and document libraries', async (ctx) => {
      if (!hasAuth || !resolvedSiteId) {
        return ctx.skip();
      }

      try {
        const lists = await graphClient.sharepoint.lists(resolvedSiteId, { top: 10 });

        expect(Array.isArray(lists)).toBe(true);

        for (const list of lists) {
          expect(list).toHaveProperty('id');
          expect(list).toHaveProperty('displayName');
        }
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (access denied — skipping)');
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should respect top parameter for lists', async (ctx) => {
      if (!hasAuth || !resolvedSiteId) {
        return ctx.skip();
      }

      try {
        const lists = await graphClient.sharepoint.lists(resolvedSiteId, { top: 2 });

        expect(Array.isArray(lists)).toBe(true);
        expect(lists.length).toBeLessThanOrEqual(2);
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          return ctx.skip();
        }
        throw error;
      }
    });
  });

  describe('List site files', () => {
    it('should list files in site default document library root', async (ctx) => {
      if (!hasAuth || !resolvedSiteId) {
        return ctx.skip();
      }

      try {
        const files = await graphClient.sharepoint.files(resolvedSiteId, '', { top: 10 });

        expect(Array.isArray(files)).toBe(true);

        for (const file of files) {
          expect(file).toHaveProperty('id');
          expect(file).toHaveProperty('name');
        }
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (access denied — skipping)');
          return ctx.skip();
        }
        throw error;
      }
    });
  });

  describe('List items in a list', () => {
    it('should list items in a SharePoint list', async (ctx) => {
      if (!hasAuth || !resolvedSiteId) {
        return ctx.skip();
      }

      try {
        // First, get a list to query
        const lists = await graphClient.sharepoint.lists(resolvedSiteId, { top: 5 });
        if (lists.length === 0) {
          console.log('  (no lists found — skipping)');
          return ctx.skip();
        }

        const items = await graphClient.sharepoint.items(resolvedSiteId, lists[0].id, { top: 5 });

        expect(Array.isArray(items)).toBe(true);
        // Items may be empty depending on the list
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (access denied — skipping)');
          return ctx.skip();
        }
        throw error;
      }
    });
  });

  describe('Search SharePoint content (/search/query)', () => {
    it('should search SharePoint content', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        const results = await graphClient.sharepoint.search('report', { top: 5 });

        expect(Array.isArray(results)).toBe(true);
        // Results may be empty
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          console.log('  (SharePoint search access denied — skipping)');
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should respect top parameter in search', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        const results = await graphClient.sharepoint.search('test', { top: 2 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(2);
      } catch (error) {
        if (error.statusCode === 403 || error.statusCode === 401) {
          return ctx.skip();
        }
        throw error;
      }
    });
  });

  describe('Full command flows', () => {
    it('should execute listSites command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        await sharepointCommands.sites({ top: 5, json: true });
      } catch (error) {
        // Skip if insufficient permissions (Sites.Read.All required)
        if (error.message?.includes('process.exit') || error.statusCode === 403) {
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should execute searchSites command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        await sharepointCommands.sites({ search: 'team', top: 5, json: true });
      } catch (error) {
        if (error.message?.includes('process.exit') || error.statusCode === 403) {
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should execute listLists command without throwing', async (ctx) => {
      if (!hasAuth || !INTEGRATION_SP_SITE) return ctx.skip();

      await expect(
        sharepointCommands.lists(INTEGRATION_SP_SITE, { top: 5, json: true })
      ).resolves.not.toThrow();
    });

    it('should execute listFiles command without throwing', async (ctx) => {
      if (!hasAuth || !INTEGRATION_SP_SITE) return ctx.skip();

      await expect(
        sharepointCommands.files(INTEGRATION_SP_SITE, '', { top: 5, json: true })
      ).resolves.not.toThrow();
    });

    it('should execute searchContent command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        await sharepointCommands.search('report', { top: 5, json: true });
      } catch (error) {
        // Skip if insufficient permissions (Sites.Read.All required for search)
        if (error.message?.includes('process.exit') || error.statusCode === 403) {
          return ctx.skip();
        }
        throw error;
      }
    });

    it('should handle empty search results gracefully', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      try {
        await sharepointCommands.search('zzxqqnonexistent99integration', { top: 5, json: true });
      } catch (error) {
        if (error.message?.includes('process.exit') || error.statusCode === 403) {
          return ctx.skip();
        }
        throw error;
      }
    });
  });
  });
});
