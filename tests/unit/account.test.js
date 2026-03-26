import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock token-manager
const mockGetAccountType = vi.fn();
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccountType: (...args) => mockGetAccountType(...args),
}));

// Mock process.exit
const mockExit = vi.fn();
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
});

// Mock console.error
const mockConsoleError = vi.fn();
vi.stubGlobal('console', {
  ...console,
  error: mockConsoleError,
});

import { ensureWorkAccount } from '../../src/utils/account.js';

describe('ensureWorkAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing for work accounts', () => {
    mockGetAccountType.mockReturnValue('work');

    ensureWorkAccount('sharepoint');

    expect(mockExit).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should exit with error for personal accounts', () => {
    mockGetAccountType.mockReturnValue('personal');

    ensureWorkAccount('sharepoint');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('not available for personal Microsoft accounts'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should include the command name in the error message', () => {
    mockGetAccountType.mockReturnValue('personal');

    ensureWorkAccount('sharepoint');

    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join(' ');
    expect(allOutput).toContain('"sharepoint"');
  });

  it('should suggest logging in with a work account', () => {
    mockGetAccountType.mockReturnValue('personal');

    ensureWorkAccount('test-cmd');

    const allOutput = mockConsoleError.mock.calls.map(c => c[0]).join(' ');
    expect(allOutput).toContain('m365 login');
  });

  it('should do nothing when accountType is undefined (defaults to work)', () => {
    mockGetAccountType.mockReturnValue('work');

    ensureWorkAccount('sharepoint');

    expect(mockExit).not.toHaveBeenCalled();
  });
});
