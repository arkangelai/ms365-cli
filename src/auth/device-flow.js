import config from '../utils/config.js';
import { AuthError, ConsentRequiredError } from '../utils/error.js';

/**
 * Device Code Flow authentication
 * https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code
 */

/**
 * Request device code from Microsoft
 * @param {Object} [options]
 * @param {string[]} [options.overrideScopes] - Complete scope list (replaces defaults entirely)
 * @param {string} [options.overrideTenant] - Tenant ID override (e.g. 'consumers' for personal accounts)
 */
export async function requestDeviceCode({ overrideScopes, overrideTenant } = {}) {
  const tenantId = overrideTenant || config.get('tenantId');
  const clientId = config.get('clientId');
  const authUrl = config.get('authUrl');

  let allScopes;
  if (overrideScopes) {
    // Complete replacement — user specified exact scopes via --scopes, --add-scopes, or --exclude
    allScopes = overrideScopes;
  } else {
    allScopes = config.get('workScopes');
  }
  const scopes = allScopes.join(' ');
  
  const url = `${authUrl}/${tenantId}/oauth2/v2.0/devicecode`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: scopes,
    }),
  });
  
  if (!response.ok) {
    throw new AuthError('Failed to request device code', await response.json());
  }
  
  const data = await response.json();
  
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in || 900,
    interval: data.interval || 5,
    message: data.message,
  };
}

/**
 * Poll for access token
 * @param {string} deviceCode - The device code to poll with
 * @param {Object} [options]
 * @param {string} [options.overrideTenant] - Tenant ID override (e.g. 'consumers' for personal accounts)
 */
export async function pollForToken(deviceCode, { overrideTenant } = {}) {
  const tenantId = overrideTenant || config.get('tenantId');
  const clientId = config.get('clientId');
  const authUrl = config.get('authUrl');
  
  const url = `${authUrl}/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
    }),
  });
  
  const data = await response.json();
  
  // Check for errors
  if (data.error) {
    if (data.error === 'authorization_pending') {
      return { pending: true };
    }
    
    if (data.error === 'slow_down') {
      return { slowDown: true };
    }
    
    // Detect admin consent required (error 90094)
    const errorDesc = data.error_description || '';
    if (
      errorDesc.includes('90094') ||
      errorDesc.includes('admin consent') ||
      errorDesc.toLowerCase().includes('admin approval') ||
      data.error === 'consent_required'
    ) {
      throw new ConsentRequiredError(
        data.error_description || 'Admin consent is required for the requested permissions.',
        { error: data.error, suberror: data.suberror }
      );
    }

    throw new AuthError(
      data.error_description || data.error,
      { error: data.error }
    );
  }
  
  // Success - return token data
  return {
    success: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Full device code flow
 * @param {Object} [options]
 * @param {string[]} [options.overrideScopes] - Complete scope list (replaces defaults entirely)
 * @param {string} [options.overrideTenant] - Tenant ID override (e.g. 'consumers' for personal accounts)
 */
export async function deviceCodeFlow({ overrideScopes, overrideTenant } = {}) {
  // Step 1: Request device code
  if (overrideScopes) {
    console.log('🔐 Starting authentication with custom scopes...\n');
  } else {
    console.log('🔐 Starting authentication...\n');
  }
  const deviceCodeData = await requestDeviceCode({ overrideScopes, overrideTenant });
  
  // Step 2: Show user instructions
  // Always use /devicelogin — the shortened /link URL can reject valid codes
  const authPageUrl = 'https://microsoft.com/devicelogin';
  console.log('━'.repeat(60));
  console.log('📱 Please authenticate:');
  console.log('');
  console.log(`   1. Open: ${authPageUrl}`);
  console.log(`   2. Enter code: ${deviceCodeData.userCode}`);
  console.log('');
  console.log('━'.repeat(60));
  console.log('\n⏳ Waiting for authentication...\n');
  
  // Step 3: Poll for token
  const startTime = Date.now();
  const expiresAt = startTime + deviceCodeData.expiresIn * 1000;
  let interval = deviceCodeData.interval * 1000;
  
  while (Date.now() < expiresAt) {
    await new Promise(resolve => setTimeout(resolve, interval));
    
    try {
      const result = await pollForToken(deviceCodeData.deviceCode, { overrideTenant });
      
      if (result.success) {
        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        };
      }
      
      if (result.slowDown) {
        // Increase polling interval
        interval += 1000;
      }
      
      // Keep waiting if pending
      if (result.pending) {
        continue;
      }
    } catch (error) {
      throw error;
    }
  }
  
  throw new AuthError('Authentication timed out. Please try again.');
}

export default {
  requestDeviceCode,
  pollForToken,
  deviceCodeFlow,
};
