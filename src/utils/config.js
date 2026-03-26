import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load default config
const configPath = join(__dirname, '../../config/default.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

/**
 * Expand ~ to home directory
 */
function expandHome(filepath) {
  if (filepath.startsWith('~/')) {
    return join(homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Get configuration value
 * Priority: ENV > default config
 */
export function getConfig(key) {
  // Convert camelCase to UPPER_SNAKE_CASE for env var lookup
  // e.g., 'clientId' -> 'M365_CLIENT_ID', 'tenantId' -> 'M365_TENANT_ID'
  const snakeKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/\./g, '_').toUpperCase();
  const envKey = `M365_${snakeKey}`;
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  
  // Return default config
  return defaultConfig[key];
}

/**
 * Get credentials file path
 */
export function getCredsPath() {
  const path = getConfig('credsPath');
  return expandHome(path);
}


/**
 * Get all config as object
 */
export function getAllConfig() {
  return {
    ...defaultConfig,
    credsPath: getCredsPath(),
  };
}

export default {
  get: getConfig,
  getCredsPath,
  getAll: getAllConfig,
};
