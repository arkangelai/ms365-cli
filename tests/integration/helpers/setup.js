/**
 * Shared integration test setup helper.
 *
 * Discovers available accounts from environment variables and provides
 * setupAuth/teardownAuth functions that handle the env-swap dance.
 *
 * Environment variables:
 *   M365_INTEGRATION_CLIENT_ID          — Azure AD app client ID (shared)
 *   M365_INTEGRATION_TENANT_ID          — Azure AD tenant ID (shared)
 *   M365_INTEGRATION_CREDS_PATH         — Work account credentials file
 *   M365_INTEGRATION_PERSONAL_CREDS_PATH — Personal account credentials file (optional)
 *   M365_INTEGRATION_SP_SITE            — SharePoint site URL (work only, optional)
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadCreds, getAccessToken } from '../../../src/auth/token-manager.js';

/**
 * Returns an array of account descriptors for which env vars are configured.
 *
 * @param {Object} [options]
 * @param {boolean} [options.workOnly=false] — only return work accounts
 * @returns {Array<{type: string, clientId: string, tenantId: string, credsPath: string}>}
 */
export function getAvailableAccounts({ workOnly = false } = {}) {
  const clientId = process.env.M365_INTEGRATION_CLIENT_ID;
  const tenantId = process.env.M365_INTEGRATION_TENANT_ID;

  if (!clientId || !tenantId) return [];

  const accounts = [];
  const workCredsPath = process.env.M365_INTEGRATION_CREDS_PATH;
  const personalCredsPath = process.env.M365_INTEGRATION_PERSONAL_CREDS_PATH;

  if (workCredsPath) {
    accounts.push({ type: 'work', clientId, tenantId, credsPath: workCredsPath });
  }

  if (!workOnly && personalCredsPath) {
    accounts.push({ type: 'personal', clientId, tenantId, credsPath: personalCredsPath });
  }

  return accounts;
}

/**
 * Set up auth for a specific account.
 * Saves current env vars, overrides them, loads creds, and obtains a valid token.
 *
 * @param {{type: string, clientId: string, tenantId: string, credsPath: string}} account
 * @returns {Promise<{hasAuth: boolean, savedEnv: Object, creds?: Object, accessToken?: string}>}
 */
export async function setupAuth(account) {
  const savedEnv = {
    M365_CLIENT_ID: process.env.M365_CLIENT_ID,
    M365_TENANT_ID: process.env.M365_TENANT_ID,
    M365_CREDS_PATH: process.env.M365_CREDS_PATH,
  };

  const resolvedCredsPath = account.credsPath.startsWith('~/')
    ? resolve(process.env.HOME, account.credsPath.slice(2))
    : resolve(account.credsPath);

  if (!existsSync(resolvedCredsPath)) {
    console.log(
      `⏭️  Credentials file not found at ${resolvedCredsPath} — skipping ${account.type} account tests`
    );
    return { hasAuth: false, savedEnv };
  }

  process.env.M365_CLIENT_ID = account.clientId;
  process.env.M365_TENANT_ID = account.tenantId;
  process.env.M365_CREDS_PATH = resolvedCredsPath;

  try {
    const creds = loadCreds();
    if (!creds || !creds.accessToken) {
      console.log(`⏭️  No valid credentials — skipping ${account.type} account tests`);
      return { hasAuth: false, savedEnv };
    }
    const accessToken = await getAccessToken();
    return { hasAuth: true, savedEnv, creds, accessToken };
  } catch (error) {
    console.log(`⏭️  Auth unavailable (${error.message}) — skipping ${account.type} account tests`);
    return { hasAuth: false, savedEnv };
  }
}

/**
 * Tear down auth — restore original env vars.
 *
 * @param {Object} savedEnv
 */
export function teardownAuth(savedEnv) {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
