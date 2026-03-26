import { describe, it, expect } from 'vitest';
import {
  parseGraphError,
  InsufficientPrivilegesError,
  ApiError,
} from '../../src/utils/error.js';

// ============================================================
// parseGraphError — InsufficientPrivilegesError detection
// Tests the real (unmocked) error module
// ============================================================

describe('parseGraphError — InsufficientPrivilegesError', () => {
  it('should return InsufficientPrivilegesError for 403 with Authorization_RequestDenied', () => {
    const response = {
      error: {
        code: 'Authorization_RequestDenied',
        message: 'Insufficient privileges to complete the operation.',
      },
    };

    const error = parseGraphError(response, 403);

    expect(error).toBeInstanceOf(InsufficientPrivilegesError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('INSUFFICIENT_PRIVILEGES');
  });

  it('should return InsufficientPrivilegesError for 403 with AccessDenied', () => {
    const response = {
      error: {
        code: 'AccessDenied',
        message: 'Access denied.',
      },
    };

    const error = parseGraphError(response, 403);
    expect(error).toBeInstanceOf(InsufficientPrivilegesError);
  });

  it('should return InsufficientPrivilegesError for 403 with ErrorAccessDenied', () => {
    const response = {
      error: {
        code: 'ErrorAccessDenied',
        message: 'Access is denied.',
      },
    };

    const error = parseGraphError(response, 403);
    expect(error).toBeInstanceOf(InsufficientPrivilegesError);
  });

  it('should return InsufficientPrivilegesError for 403 with InsufficientPrivileges code', () => {
    const response = {
      error: {
        code: 'InsufficientPrivileges',
        message: 'Insufficient privileges.',
      },
    };

    const error = parseGraphError(response, 403);
    expect(error).toBeInstanceOf(InsufficientPrivilegesError);
  });

  it('should return InsufficientPrivilegesError for 403 with innerError code match', () => {
    const response = {
      error: {
        code: 'SomeOtherCode',
        message: 'Some message',
        innerError: {
          code: 'Authorization_RequestDenied',
        },
      },
    };

    const error = parseGraphError(response, 403);
    expect(error).toBeInstanceOf(InsufficientPrivilegesError);
  });

  it('should return regular ApiError for 403 with non-privilege error code', () => {
    const response = {
      error: {
        code: 'Forbidden',
        message: 'You do not have permission.',
      },
    };

    const error = parseGraphError(response, 403);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(InsufficientPrivilegesError);
  });

  it('should return regular ApiError for non-403 status with privilege error code', () => {
    const response = {
      error: {
        code: 'Authorization_RequestDenied',
        message: 'Not found.',
      },
    };

    // Status 404, not 403 — should NOT return InsufficientPrivilegesError
    const error = parseGraphError(response, 404);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(InsufficientPrivilegesError);
  });
});

// ============================================================
// InsufficientPrivilegesError class
// ============================================================

describe('InsufficientPrivilegesError', () => {
  it('should have correct properties', () => {
    const error = new InsufficientPrivilegesError('Test message', { info: 'details' });

    expect(error.name).toBe('InsufficientPrivilegesError');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('INSUFFICIENT_PRIVILEGES');
    expect(error.details).toEqual({ info: 'details' });
  });

  it('should have default message when none provided', () => {
    const error = new InsufficientPrivilegesError();

    expect(error.message).toBe('Insufficient privileges. Additional permissions are required.');
  });

  it('should be instanceof ApiError', () => {
    const error = new InsufficientPrivilegesError();
    expect(error).toBeInstanceOf(ApiError);
  });
});
