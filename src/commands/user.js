import graphClient from '../graph/client.js';
import { outputUserSearchResults } from '../utils/output.js';
import { handleError } from '../utils/error.js';
import { getAccountType } from '../auth/token-manager.js';

/**
 * User commands
 */

/**
 * Search users by name across organization and personal contacts
 */
export async function searchUser(name, options) {
  try {
    const { top = 10, json = false } = options;
    
    if (!name) {
      throw new Error('Search name is required');
    }
    
    const accountType = getAccountType();
    
    let orgResult, contactsResult;
    
    if (accountType === 'personal') {
      // Personal accounts: only search contacts (no org directory)
      orgResult = { status: 'rejected', reason: new Error('Not available for personal accounts') };
      contactsResult = await Promise.allSettled([
        graphClient.user.searchContacts(name, { top }),
      ]).then(r => r[0]);
    } else {
      // Work accounts: search both sources in parallel
      [orgResult, contactsResult] = await Promise.allSettled([
        graphClient.user.searchUsers(name, { top }),
        graphClient.user.searchContacts(name, { top }),
      ]);
    }
    
    const results = [];
    
    // Normalize organization user results
    if (orgResult.status === 'fulfilled') {
      for (const user of orgResult.value) {
        const email = user.mail || user.userPrincipalName || '';
        results.push({
          source: 'organization',
          displayName: user.displayName || '',
          email,
          department: user.department || '',
          jobTitle: user.jobTitle || '',
        });
      }
    }
    
    // Normalize contact results
    if (contactsResult.status === 'fulfilled') {
      for (const contact of contactsResult.value) {
        const email = contact.emailAddresses?.[0]?.address || '';
        results.push({
          source: 'contacts',
          displayName: contact.displayName || '',
          email,
          department: contact.companyName || '',
          jobTitle: contact.jobTitle || '',
        });
      }
    }
    
    // Deduplicate by email (case-insensitive), prefer organization source
    const seen = new Map();
    const deduplicated = [];
    
    for (const result of results) {
      const key = result.email.toLowerCase();
      if (!key || !seen.has(key)) {
        if (key) seen.set(key, true);
        deduplicated.push(result);
      }
    }
    
    // If both searches failed, throw to trigger error handler
    if (orgResult.status === 'rejected' && contactsResult.status === 'rejected') {
      throw orgResult.reason;
    }
    
    outputUserSearchResults(deduplicated, { json, name });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export default {
  search: searchUser,
};
