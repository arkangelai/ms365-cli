import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock token-manager
const { mockGetAccountType } = vi.hoisted(() => {
  const mockGetAccountType = vi.fn().mockReturnValue('work');
  return { mockGetAccountType };
});
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccountType: mockGetAccountType,
  default: { getAccountType: mockGetAccountType },
}));

// Mock console.log and console.error
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

vi.stubGlobal('console', {
  ...console,
  log: mockConsoleLog,
  error: mockConsoleError,
});

// Mock process.exit
const mockExit = vi.fn();
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
});

import { M365Error, AuthError, ApiError, TokenExpiredError, InsufficientPrivilegesError, ConsentRequiredError, handleError, parseGraphError } from '../../src/utils/error.js';

describe('Error Classes', () => {
  describe('M365Error', () => {
    it('should create error with message, code and details', () => {
      const error = new M365Error('Test error', 'TEST_CODE', { extra: 'data' });
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('M365Error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ extra: 'data' });
    });

    it('should have default details as null', () => {
      const error = new M365Error('Test error', 'TEST_CODE');
      expect(error.details).toBeNull();
    });
  });

  describe('AuthError', () => {
    it('should create auth error with default AUTH_ERROR code', () => {
      const error = new AuthError('Auth failed', { reason: 'invalid_token' });
      
      expect(error.message).toBe('Auth failed');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.name).toBe('AuthError');
      expect(error.details).toEqual({ reason: 'invalid_token' });
    });
  });

  describe('ApiError', () => {
    it('should create API error with status code', () => {
      const error = new ApiError('API failed', 500, { traceId: 'abc123' });
      
      expect(error.message).toBe('API failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('API_ERROR');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('TokenExpiredError', () => {
    it('should create token expired error with default message', () => {
      const error = new TokenExpiredError();
      
      expect(error.message).toBe('Token expired and refresh failed. Please run: m365 login');
      expect(error.name).toBe('TokenExpiredError');
      expect(error.code).toBe('AUTH_ERROR');
    });
  });
});

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountType.mockReturnValue('work');
  });

  it('should output JSON format when json option is true', () => {
    const error = new M365Error('Test error', 'TEST_CODE', { extra: 'data' });
    
    handleError(error, { json: true });
    
    expect(mockConsoleError).toHaveBeenCalledWith(
      JSON.stringify({
        error: true,
        message: 'Test error',
        code: 'TEST_CODE',
        details: { extra: 'data' }
      }, null, 2)
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should output user-friendly format when json is false', () => {
    const error = new M365Error('Test error', 'TEST_CODE', { extra: 'data' });
    
    handleError(error, { json: false });
    
    expect(mockConsoleError).toHaveBeenCalledWith('\n❌ Error: Test error');
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Details:')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle error without details', () => {
    const error = new M365Error('Simple error', 'SIMPLE_CODE');
    
    handleError(error, { json: false });
    
    expect(mockConsoleError).toHaveBeenCalledWith('\n❌ Error: Simple error');
  });

  it('should show --add-scopes suggestion for InsufficientPrivilegesError', () => {
    const error = new InsufficientPrivilegesError('Insufficient privileges');
    
    handleError(error);
    
    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('💡 Suggestions');
    expect(allOutput).toContain('--add-scopes');
    expect(allOutput).toContain('Sites.ReadWrite.All');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should NOT show --add-scopes suggestion for regular ApiError', () => {
    const error = new ApiError('Some error', 500);
    
    handleError(error);
    
    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).not.toContain('--add-scopes');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should show personal account hint when logged in with personal account', () => {
    mockGetAccountType.mockReturnValue('personal');
    const error = new M365Error('Some error', 'SOME_CODE');
    
    handleError(error);
    
    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('personal Microsoft account');
    expect(allOutput).toContain('SharePoint');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should NOT show personal account hint for work accounts', () => {
    mockGetAccountType.mockReturnValue('work');
    const error = new M365Error('Some error', 'SOME_CODE');
    
    handleError(error);
    
    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).not.toContain('personal Microsoft account');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should show both consent suggestions and personal hint for personal account with ConsentRequiredError', () => {
    mockGetAccountType.mockReturnValue('personal');
    const error = new ConsentRequiredError('Admin consent required');
    
    handleError(error);
    
    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('💡 Suggestions');
    expect(allOutput).toContain('personal Microsoft account');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe('parseGraphError', () => {
  it('should parse known error code to friendly message', () => {
    const response = {
      error: {
        code: 'ErrorInvalidIdMalformed',
        message: 'Id is malformed.'
      }
    };
    
    const error = parseGraphError(response, 400);
    
    expect(error.message).toBe('无效的 ID 格式。请检查您提供的 ID 是否正确。');
    expect(error.statusCode).toBe(400);
    expect(error.details.code).toBe('ErrorInvalidIdMalformed');
  });

  it('should parse itemNotFound error', () => {
    const response = {
      error: {
        code: 'itemNotFound',
        message: 'The resource could not be found.'
      }
    };
    
    const error = parseGraphError(response, 404);
    
    expect(error.message).toBe('找不到指定的文件或文件夹。请检查路径是否存在。');
  });

  it('should handle unknown error code with fallback message', () => {
    const response = {
      error: {
        code: 'UnknownErrorCode',
        message: 'Some unknown error occurred.'
      }
    };
    
    const error = parseGraphError(response, 500);
    
    expect(error.message).toBe('Some unknown error occurred.');
    expect(error.details.code).toBe('UnknownErrorCode');
  });

  it('should handle error without error property', () => {
    const response = {};
    
    const error = parseGraphError(response, 500);
    
    expect(error.message).toBe('API Error (500)');
    expect(error.statusCode).toBe(500);
  });

  it('should handle lowercase error codes', () => {
    const response = {
      error: {
        code: 'invalidRequest',
        message: 'Invalid request.'
      }
    };
    
    const error = parseGraphError(response, 400);
    
    expect(error.message).toBe('无效的请求。请检查您的参数格式。');
  });
});
