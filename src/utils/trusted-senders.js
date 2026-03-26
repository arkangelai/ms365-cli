import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Trusted senders whitelist manager
 * Protects against phishing by filtering email content from untrusted senders
 */

// Whitelist file paths (check in order)
const WHITELIST_PATHS = [
  join(homedir(), '.m365-cli/trusted-senders.txt'),
];

function getWhitelistPath() {
  // Return first existing path
  for (const path of WHITELIST_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // Default to first path if none exist (will be created on first add)
  return WHITELIST_PATHS[0];
}

/**
 * Load trusted senders from file
 * @returns {Array<string>} List of trusted email addresses and domains
 */
export function loadTrustedSenders() {
  const path = getWhitelistPath();
  
  if (!existsSync(path)) {
    return [];
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Skip comments and empty lines
  } catch (error) {
    console.error(`Warning: Failed to read whitelist from ${path}:`, error.message);
    return [];
  }
}

/**
 * Check if a sender is trusted
 * @param {string} senderEmail - Email address to check
 * @param {string} [currentUserEmail] - Current user's email address (to trust own emails)
 * @returns {boolean} True if sender is trusted
 */
export function isTrustedSender(senderEmail, currentUserEmail) {
  if (!senderEmail) {
    return false;
  }
  
  // Check if sender is the current user (own emails are trusted)
  if (currentUserEmail) {
    const normalizedSender = senderEmail.toLowerCase().trim();
    const normalizedCurrentUser = currentUserEmail.toLowerCase().trim();
    if (normalizedSender === normalizedCurrentUser) {
      return true;
    }
  }
  
  // Handle Exchange DN format (internal mail)
  // These are formatted like: /O=EXCHANGELABS/OU=.../CN=RECIPIENTS/CN=...
  if (senderEmail.startsWith('/O=EXCHANGELABS') || senderEmail.startsWith('/O=EXCHANGE')) {
    // Internal organization mail - consider trusted
    return true;
  }
  
  const trustedSenders = loadTrustedSenders();
  const normalizedEmail = senderEmail.toLowerCase().trim();
  
  for (const entry of trustedSenders) {
    const normalized = entry.toLowerCase();
    
    // Domain match (e.g., @example.com)
    if (normalized.startsWith('@')) {
      const domain = normalized.substring(1);
      if (normalizedEmail.endsWith(`@${domain}`)) {
        return true;
      }
    }
    // Exact email match
    else if (normalized === normalizedEmail) {
      return true;
    }
  }
  
  return false;
}

/**
 * Add a sender to the whitelist
 * @param {string} email - Email address or domain to trust
 */
export function addTrustedSender(email) {
  const path = getWhitelistPath();
  const trustedSenders = loadTrustedSenders();
  
  // Normalize input
  const normalized = email.toLowerCase().trim();
  
  // Check if already trusted
  if (trustedSenders.some(entry => entry.toLowerCase() === normalized)) {
    throw new Error(`Already trusted: ${email}`);
  }
  
  // Ensure directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // Append to file
  const line = `\n${email}`;
  
  try {
    if (existsSync(path)) {
      writeFileSync(path, readFileSync(path, 'utf-8') + line, 'utf-8');
    } else {
      // Create new file with header
      const header = `# M365 Trusted Senders Whitelist
# One email address or domain per line
# Lines starting with @ match entire domains (e.g. @example.com)
# Senders not in this list will have their email body filtered out

`;
      writeFileSync(path, header + email + '\n', 'utf-8');
    }
  } catch (error) {
    throw new Error(`Failed to add trusted sender: ${error.message}`);
  }
}

/**
 * Remove a sender from the whitelist
 * @param {string} email - Email address or domain to untrust
 */
export function removeTrustedSender(email) {
  const path = getWhitelistPath();
  
  if (!existsSync(path)) {
    throw new Error('Whitelist file does not exist');
  }
  
  const trustedSenders = loadTrustedSenders();
  const normalized = email.toLowerCase().trim();
  
  // Find matching entry (case-insensitive)
  const matchingEntry = trustedSenders.find(
    entry => entry.toLowerCase() === normalized
  );
  
  if (!matchingEntry) {
    throw new Error(`Not in whitelist: ${email}`);
  }
  
  try {
    // Read full content
    const content = readFileSync(path, 'utf-8');
    
    // Remove the matching line
    const lines = content.split('\n');
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed !== matchingEntry;
    });
    
    writeFileSync(path, filtered.join('\n'), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to remove trusted sender: ${error.message}`);
  }
}

/**
 * List all trusted senders
 * @returns {Array<string>} List of trusted entries
 */
export function listTrustedSenders() {
  return loadTrustedSenders();
}

/**
 * Get whitelist file path (for display purposes)
 * @returns {string} Path to whitelist file
 */
export function getWhitelistFilePath() {
  return getWhitelistPath();
}
