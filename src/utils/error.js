/**
 * Custom error classes for M365 CLI
 */

import { getAccountType } from '../auth/token-manager.js';

export class M365Error extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'M365Error';
    this.code = code;
    this.details = details;
  }
}

export class AuthError extends M365Error {
  constructor(message, details = null) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

export class ApiError extends M365Error {
  constructor(message, statusCode, details = null) {
    super(message, 'API_ERROR', details);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super('Token expired and refresh failed. Please run: m365 login');
    this.name = 'TokenExpiredError';
  }
}

export class InsufficientPrivilegesError extends ApiError {
  constructor(message, details = null) {
    super(message || 'Insufficient privileges. Additional permissions are required.', 403, details);
    this.name = 'InsufficientPrivilegesError';
    this.code = 'INSUFFICIENT_PRIVILEGES';
  }
}

export class ConsentRequiredError extends AuthError {
  constructor(message, details = null) {
    super(message || 'Admin consent is required for the permissions requested by this application.', details);
    this.name = 'ConsentRequiredError';
    this.code = 'CONSENT_REQUIRED';
  }
}

/**
 * Handle and format errors
 */
export function handleError(error, options = {}) {
  const { json = false } = options;
  
  if (json) {
    const errorObj = {
      error: true,
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
    };
    
    if (error.details) {
      errorObj.details = error.details;
    }
    
    if (error.statusCode) {
      errorObj.statusCode = error.statusCode;
    }
    
    console.error(JSON.stringify(errorObj, null, 2));
  } else {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (error.details) {
      console.error(`   Details: ${JSON.stringify(error.details, null, 2)}`);
    }
    
    // Show helpful suggestions for consent errors
    if (error instanceof ConsentRequiredError || error.code === 'CONSENT_REQUIRED') {
      console.error('');
      console.error('💡 Suggestions:');
      console.error('');
      console.error('   1. Login with fewer scopes (exclude blocked ones):');
      console.error('      m365 login --exclude Mail.ReadWrite,Calendars.ReadWrite,MailboxSettings.Read');
      console.error('');
      console.error('   2. Login with only non-blocked scopes:');
      console.error('      m365 login --scopes User.Read,User.ReadBasic.All,Contacts.Read,Mail.Send,Files.ReadWrite,offline_access');
      console.error('');
      console.error('   3. Ask your tenant admin to grant consent:');
      const clientId = '091b3d7b-e217-4410-868c-01c3ee6189b6';
      console.error(`      https://login.microsoftonline.com/{tenantId}/adminconsent?client_id=${clientId}`);
      console.error('      (Replace {tenantId} with your Azure AD tenant ID)');
      console.error('');
    }

    // Show helpful suggestions for insufficient privileges errors
    if (error instanceof InsufficientPrivilegesError || error.code === 'INSUFFICIENT_PRIVILEGES') {
      console.error('');
      console.error('💡 Suggestions:');
      console.error('');
      console.error('   This command requires additional permissions not included in the default scope set.');
      console.error('');
      console.error('   Re-login with the required scope:');
      console.error('      m365 login --add-scopes Sites.ReadWrite.All');
      console.error('');
      console.error('   Or login with a complete custom scope list:');
      console.error('      m365 login --scopes User.Read,Files.ReadWrite,Sites.ReadWrite.All,offline_access');
      console.error('');
    }

    // Personal account hint
    if (getAccountType() === 'personal') {
      console.error('');
      console.error('💡 You are logged in with a personal Microsoft account.');
      console.error('   Some features (SharePoint, organization user search) are not available.');
    }
  }
  
  process.exit(1);
}

/**
 * Parse Graph API error response
 */
export function parseGraphError(response, statusCode) {
  let message = `API Error (${statusCode})`;
  let details = null;
  
  if (response.error) {
    const errorCode = response.error.code;
    
    // Map common error codes to user-friendly messages
    const friendlyMessages = {
      'ErrorInvalidIdMalformed': '无效的 ID 格式。请检查您提供的 ID 是否正确。',
      'itemNotFound': '找不到指定的文件或文件夹。请检查路径是否存在。',
      'InvalidRequest': '无效的请求。请检查您的参数格式。',
      'invalidRequest': '无效的请求。请检查您的参数格式。',
      'InvalidHostname': '无效的站点主机名。请检查 SharePoint 站点格式。',
      'resourceNotFound': '找不到指定的资源。',
      'ErrorItemNotFound': '找不到指定的项目。',
      'mailboxNotFound': '找不到邮箱。',
      'folderNotFound': '找不到指定的文件夹。',
      'ErrorNonExistentMailbox': '邮箱不存在。',
      'ErrorCannotDeleteObject': '无法删除此对象。可能是系统文件夹或受保护项目。',
      'ErrorMoveCopyFailed': '移动或复制邮件失败。请检查目标文件夹是否存在。',
      'ErrorInvalidRecipients': '无效的收件人。请检查邮件地址格式。',
    };
    
    // Use friendly message if available, otherwise use original
    message = friendlyMessages[errorCode] || response.error.message || message;
    
    // Include error code in details for debugging
    details = {
      code: errorCode,
      originalMessage: response.error.message,
      innerError: response.error.innerError,
    };
  }
  
  // Detect insufficient privileges (scope issue) — return specialized error
  if (statusCode === 403 && response.error) {
    const errorCode = response.error.code;
    const innerCode = response.error.innerError?.code;
    const insufficientCodes = [
      'Authorization_RequestDenied',
      'AccessDenied',
      'ErrorAccessDenied',
      'InsufficientPrivileges',
    ];
    
    if (insufficientCodes.includes(errorCode) || insufficientCodes.includes(innerCode)) {
      return new InsufficientPrivilegesError(message, details);
    }
  }
  
  return new ApiError(message, statusCode, details);
}

export default {
  M365Error,
  AuthError,
  ApiError,
  TokenExpiredError,
  InsufficientPrivilegesError,
  ConsentRequiredError,
  handleError,
  parseGraphError,
};
