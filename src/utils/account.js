import { getAccountType } from '../auth/token-manager.js';

/**
 * Ensure the current login is a work/school account.
 * If logged in with a personal Microsoft account, print error and exit.
 *
 * @param {string} commandName - The command name to show in the error message
 */
export function ensureWorkAccount(commandName) {
  if (getAccountType() === 'personal') {
    console.error(`\n❌ The "${commandName}" command is not available for personal Microsoft accounts.`);
    console.error('   This feature requires a Microsoft 365 work or school account.');
    console.error('   Please login with a work account: m365 login\n');
    process.exit(1);
  }
}

export default {
  ensureWorkAccount,
};
