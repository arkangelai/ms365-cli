import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchUsers = vi.fn();
const mockSearchContacts = vi.fn();

vi.mock('../../src/graph/client.js', () => ({
  default: {
    user: {
      searchUsers: (...args) => mockSearchUsers(...args),
      searchContacts: (...args) => mockSearchContacts(...args),
    },
  },
}));

const mockOutputUserSearchResults = vi.fn();

vi.mock('../../src/utils/output.js', () => ({
  outputUserSearchResults: (...args) => mockOutputUserSearchResults(...args),
}));

const mockHandleError = vi.fn();
vi.mock('../../src/utils/error.js', () => ({
  handleError: (...args) => mockHandleError(...args),
}));

const mockGetAccountType = vi.fn().mockReturnValue('work');
vi.mock('../../src/auth/token-manager.js', () => ({
  getAccountType: (...args) => mockGetAccountType(...args),
}));

import { searchUser } from '../../src/commands/user.js';

describe('User search command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountType.mockReturnValue('work');
  });

  it('should search both org users and contacts', async () => {
    mockSearchUsers.mockResolvedValue([]);
    mockSearchContacts.mockResolvedValue([]);

    await searchUser('Jerry', { top: 10, json: false });

    expect(mockSearchUsers).toHaveBeenCalledWith('Jerry', { top: 10 });
    expect(mockSearchContacts).toHaveBeenCalledWith('Jerry', { top: 10 });
  });

  it('should normalize org user results with mail field', async () => {
    mockSearchUsers.mockResolvedValue([
      {
        id: 'u1',
        displayName: 'Jerry Smith',
        mail: 'jerry@contoso.com',
        department: 'Engineering',
        jobTitle: 'Developer',
        userPrincipalName: 'jerry@contoso.onmicrosoft.com',
      },
    ]);
    mockSearchContacts.mockResolvedValue([]);

    await searchUser('Jerry', { top: 10, json: false });

    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      source: 'organization',
      displayName: 'Jerry Smith',
      email: 'jerry@contoso.com',
      department: 'Engineering',
      jobTitle: 'Developer',
    });
  });

  it('should use userPrincipalName when mail is missing', async () => {
    mockSearchUsers.mockResolvedValue([
      {
        id: 'u2',
        displayName: 'Jerry NoMail',
        mail: null,
        department: '',
        jobTitle: '',
        userPrincipalName: 'jerry.nomail@contoso.onmicrosoft.com',
      },
    ]);
    mockSearchContacts.mockResolvedValue([]);

    await searchUser('Jerry', { top: 10, json: false });

    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results[0].email).toBe('jerry.nomail@contoso.onmicrosoft.com');
  });

  it('should normalize contact results with emailAddresses', async () => {
    mockSearchUsers.mockResolvedValue([]);
    mockSearchContacts.mockResolvedValue([
      {
        id: 'c1',
        displayName: 'Jerry Friend',
        emailAddresses: [{ name: 'Jerry', address: 'jerry.friend@gmail.com' }],
        companyName: 'FriendCo',
        jobTitle: 'CEO',
      },
    ]);

    await searchUser('Jerry', { top: 10, json: false });

    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      source: 'contacts',
      displayName: 'Jerry Friend',
      email: 'jerry.friend@gmail.com',
      department: 'FriendCo',
      jobTitle: 'CEO',
    });
  });

  it('should deduplicate results by email (case-insensitive)', async () => {
    mockSearchUsers.mockResolvedValue([
      {
        id: 'u1',
        displayName: 'Jerry Smith',
        mail: 'Jerry@contoso.com',
        department: 'Engineering',
        jobTitle: 'Dev',
        userPrincipalName: 'jerry@contoso.com',
      },
    ]);
    mockSearchContacts.mockResolvedValue([
      {
        id: 'c1',
        displayName: 'Jerry Smith',
        emailAddresses: [{ address: 'jerry@contoso.com' }],
        companyName: 'Contoso',
        jobTitle: 'Dev',
      },
    ]);

    await searchUser('Jerry', { top: 10, json: false });

    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('organization');
  });

  it('should handle org user search failure gracefully', async () => {
    mockSearchUsers.mockRejectedValue(new Error('Forbidden'));
    mockSearchContacts.mockResolvedValue([
      {
        id: 'c1',
        displayName: 'Jerry Contact',
        emailAddresses: [{ address: 'jerry@personal.com' }],
        companyName: '',
        jobTitle: 'Friend',
      },
    ]);

    await searchUser('Jerry', { top: 10, json: false });

    expect(mockHandleError).not.toHaveBeenCalled();
    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('contacts');
  });

  it('should handle contacts search failure gracefully', async () => {
    mockSearchUsers.mockResolvedValue([
      {
        id: 'u1',
        displayName: 'Jerry Org',
        mail: 'jerry@org.com',
        department: 'Sales',
        jobTitle: '',
        userPrincipalName: 'jerry@org.com',
      },
    ]);
    mockSearchContacts.mockRejectedValue(new Error('Contacts not available'));

    await searchUser('Jerry', { top: 10, json: false });

    expect(mockHandleError).not.toHaveBeenCalled();
    const results = mockOutputUserSearchResults.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('organization');
  });

  it('should pass json option to output', async () => {
    mockSearchUsers.mockResolvedValue([]);
    mockSearchContacts.mockResolvedValue([]);

    await searchUser('Jerry', { top: 5, json: true });

    expect(mockOutputUserSearchResults).toHaveBeenCalledWith(
      [],
      { json: true, name: 'Jerry' }
    );
  });

  it('should call handleError when both searches fail', async () => {
    const orgError = new Error('Org search failed');
    mockSearchUsers.mockRejectedValue(orgError);
    mockSearchContacts.mockRejectedValue(new Error('Contacts search failed'));

    await searchUser('Jerry', { top: 10, json: false });

    expect(mockHandleError).toHaveBeenCalledWith(orgError, { json: false });
    expect(mockOutputUserSearchResults).not.toHaveBeenCalled();
  });

  describe('personal account', () => {
    beforeEach(() => {
      mockGetAccountType.mockReturnValue('personal');
    });

    it('should only search contacts for personal accounts', async () => {
      mockSearchContacts.mockResolvedValue([]);

      await searchUser('Jerry', { top: 10, json: false });

      expect(mockSearchUsers).not.toHaveBeenCalled();
      expect(mockSearchContacts).toHaveBeenCalledWith('Jerry', { top: 10 });
    });

    it('should return contact results for personal accounts', async () => {
      mockSearchContacts.mockResolvedValue([
        {
          id: 'c1',
          displayName: 'Jerry Friend',
          emailAddresses: [{ address: 'jerry@gmail.com' }],
          companyName: 'FriendCo',
          jobTitle: 'CEO',
        },
      ]);

      await searchUser('Jerry', { top: 10, json: false });

      const results = mockOutputUserSearchResults.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('contacts');
      expect(results[0].email).toBe('jerry@gmail.com');
    });

    it('should handle contacts failure for personal accounts', async () => {
      mockSearchContacts.mockRejectedValue(new Error('Contacts failed'));

      await searchUser('Jerry', { top: 10, json: false });

      // Contacts-only search can still output empty results since orgResult is manually rejected
      // The "both failed" check should trigger handleError
      expect(mockHandleError).toHaveBeenCalled();
    });
  });
});
