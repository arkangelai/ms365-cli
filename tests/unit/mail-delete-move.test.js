import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track graphClient calls
const mockDeleteMessage = vi.fn();
const mockMove = vi.fn();
const mockListFolders = vi.fn();
const mockListChildFolders = vi.fn();
const mockCreateFolder = vi.fn();
const mockDeleteFolder = vi.fn();

vi.mock('../../src/graph/client.js', () => ({
  default: {
    mail: {
      deleteMessage: (...args) => mockDeleteMessage(...args),
      move: (...args) => mockMove(...args),
      listFolders: (...args) => mockListFolders(...args),
      listChildFolders: (...args) => mockListChildFolders(...args),
      createFolder: (...args) => mockCreateFolder(...args),
      deleteFolder: (...args) => mockDeleteFolder(...args),
    },
    getCurrentUser: vi.fn().mockResolvedValue({
      mail: 'test@test.com',
      userPrincipalName: 'test@test.com',
    }),
  },
}));

// Mock output functions
const mockOutputMailDeleteResult = vi.fn();
const mockOutputMailMoveResult = vi.fn();
const mockOutputMailFolderList = vi.fn();
const mockOutputMailFolderResult = vi.fn();

vi.mock('../../src/utils/output.js', () => ({
  outputMailList: vi.fn(),
  outputMailDetail: vi.fn(),
  outputSendResult: vi.fn(),
  outputAttachmentList: vi.fn(),
  outputAttachmentDownload: vi.fn(),
  outputMailDeleteResult: (...args) => mockOutputMailDeleteResult(...args),
  outputMailMoveResult: (...args) => mockOutputMailMoveResult(...args),
  outputMailFolderList: (...args) => mockOutputMailFolderList(...args),
  outputMailFolderResult: (...args) => mockOutputMailFolderResult(...args),
}));

// Mock error handler
const mockHandleError = vi.fn();
vi.mock('../../src/utils/error.js', () => ({
  handleError: (...args) => mockHandleError(...args),
}));

// Mock trusted-senders module
vi.mock('../../src/utils/trusted-senders.js', () => ({
  isTrustedSender: vi.fn().mockReturnValue(true),
  addTrustedSender: vi.fn(),
  removeTrustedSender: vi.fn(),
  listTrustedSenders: vi.fn().mockReturnValue([]),
  getWhitelistFilePath: vi.fn(),
}));

import { deleteMail, moveMail, listMailFolders, createMailFolder, deleteMailFolder } from '../../src/commands/mail.js';

describe('Mail delete command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMessage.mockResolvedValue({ success: true });
  });

  it('should delete a message with --force flag', async () => {
    await deleteMail('msg-123', { force: true, json: false });

    expect(mockDeleteMessage).toHaveBeenCalledTimes(1);
    expect(mockDeleteMessage).toHaveBeenCalledWith('msg-123');
    expect(mockOutputMailDeleteResult).toHaveBeenCalledWith(
      { status: 'deleted', id: 'msg-123' },
      { json: false }
    );
  });

  it('should delete a message with --json flag (skips confirmation)', async () => {
    await deleteMail('msg-456', { json: true });

    expect(mockDeleteMessage).toHaveBeenCalledTimes(1);
    expect(mockDeleteMessage).toHaveBeenCalledWith('msg-456');
    expect(mockOutputMailDeleteResult).toHaveBeenCalledWith(
      { status: 'deleted', id: 'msg-456' },
      { json: true }
    );
  });

  it('should handle errors when deleting', async () => {
    const error = new Error('Not found');
    mockDeleteMessage.mockRejectedValue(error);

    await deleteMail('bad-id', { force: true, json: false });

    expect(mockHandleError).toHaveBeenCalledWith(error, { json: false });
  });

  it('should throw error when no ID provided', async () => {
    await deleteMail(null, { force: true, json: false });

    expect(mockDeleteMessage).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledTimes(1);
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      { json: false }
    );
  });
});

describe('Mail move command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMove.mockResolvedValue({
      id: 'new-msg-id',
      subject: 'Test Email',
    });
  });

  it('should move a message to a folder', async () => {
    await moveMail('msg-123', 'archive', { json: false });

    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(mockMove).toHaveBeenCalledWith('msg-123', 'archive');
    expect(mockOutputMailMoveResult).toHaveBeenCalledWith(
      {
        status: 'moved',
        subject: 'Test Email',
        destination: 'archive',
        newId: 'new-msg-id',
      },
      { json: false }
    );
  });

  it('should move a message with --json output', async () => {
    await moveMail('msg-123', 'inbox', { json: true });

    expect(mockMove).toHaveBeenCalledWith('msg-123', 'inbox');
    expect(mockOutputMailMoveResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'moved' }),
      { json: true }
    );
  });

  it('should handle errors when moving', async () => {
    const error = new Error('Move failed');
    mockMove.mockRejectedValue(error);

    await moveMail('msg-123', 'archive', { json: false });

    expect(mockHandleError).toHaveBeenCalledWith(error, { json: false });
  });

  it('should throw error when no ID provided', async () => {
    await moveMail(null, 'archive', { json: false });

    expect(mockMove).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledTimes(1);
  });

  it('should throw error when no destination provided', async () => {
    await moveMail('msg-123', null, { json: false });

    expect(mockMove).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledTimes(1);
  });
});

describe('Mail folder list command', () => {
  const sampleFolders = [
    {
      id: 'folder-1',
      displayName: 'Inbox',
      parentFolderId: null,
      childFolderCount: 2,
      totalItemCount: 100,
      unreadItemCount: 5,
    },
    {
      id: 'folder-2',
      displayName: 'Sent Items',
      parentFolderId: null,
      childFolderCount: 0,
      totalItemCount: 50,
      unreadItemCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockListFolders.mockResolvedValue(sampleFolders);
    mockListChildFolders.mockResolvedValue(sampleFolders);
  });

  it('should list top-level mail folders', async () => {
    await listMailFolders({ json: false });

    expect(mockListFolders).toHaveBeenCalledTimes(1);
    expect(mockListFolders).toHaveBeenCalledWith({ top: 50 });
    expect(mockOutputMailFolderList).toHaveBeenCalledWith(sampleFolders, { json: false });
  });

  it('should list folders with custom top', async () => {
    await listMailFolders({ top: 10, json: false });

    expect(mockListFolders).toHaveBeenCalledWith({ top: 10 });
  });

  it('should list child folders when --parent is provided', async () => {
    await listMailFolders({ parent: 'inbox', json: false });

    expect(mockListChildFolders).toHaveBeenCalledTimes(1);
    expect(mockListChildFolders).toHaveBeenCalledWith('inbox', { top: 50 });
    expect(mockListFolders).not.toHaveBeenCalled();
  });

  it('should output as JSON', async () => {
    await listMailFolders({ json: true });

    expect(mockOutputMailFolderList).toHaveBeenCalledWith(sampleFolders, { json: true });
  });

  it('should handle errors', async () => {
    const error = new Error('API error');
    mockListFolders.mockRejectedValue(error);

    await listMailFolders({ json: false });

    expect(mockHandleError).toHaveBeenCalledWith(error, { json: false });
  });
});

describe('Mail folder create command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockResolvedValue({
      id: 'new-folder-id',
      displayName: 'My Folder',
    });
  });

  it('should create a top-level folder', async () => {
    await createMailFolder('My Folder', { json: false });

    expect(mockCreateFolder).toHaveBeenCalledTimes(1);
    expect(mockCreateFolder).toHaveBeenCalledWith('My Folder', null);
    expect(mockOutputMailFolderResult).toHaveBeenCalledWith(
      {
        status: 'created',
        displayName: 'My Folder',
        id: 'new-folder-id',
      },
      { json: false }
    );
  });

  it('should create a child folder when --parent is provided', async () => {
    await createMailFolder('Sub Folder', { parent: 'inbox', json: false });

    expect(mockCreateFolder).toHaveBeenCalledWith('Sub Folder', 'inbox');
  });

  it('should output as JSON', async () => {
    await createMailFolder('My Folder', { json: true });

    expect(mockOutputMailFolderResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'created' }),
      { json: true }
    );
  });

  it('should throw error when no name provided', async () => {
    await createMailFolder(null, { json: false });

    expect(mockCreateFolder).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    const error = new Error('Create failed');
    mockCreateFolder.mockRejectedValue(error);

    await createMailFolder('My Folder', { json: false });

    expect(mockHandleError).toHaveBeenCalledWith(error, { json: false });
  });
});

describe('Mail folder delete command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteFolder.mockResolvedValue({ success: true });
  });

  it('should delete a folder with --force flag', async () => {
    await deleteMailFolder('folder-123', { force: true, json: false });

    expect(mockDeleteFolder).toHaveBeenCalledTimes(1);
    expect(mockDeleteFolder).toHaveBeenCalledWith('folder-123');
    expect(mockOutputMailFolderResult).toHaveBeenCalledWith(
      { status: 'deleted', id: 'folder-123' },
      { json: false }
    );
  });

  it('should delete a folder with --json flag (skips confirmation)', async () => {
    await deleteMailFolder('folder-456', { json: true });

    expect(mockDeleteFolder).toHaveBeenCalledTimes(1);
    expect(mockDeleteFolder).toHaveBeenCalledWith('folder-456');
    expect(mockOutputMailFolderResult).toHaveBeenCalledWith(
      { status: 'deleted', id: 'folder-456' },
      { json: true }
    );
  });

  it('should handle errors when deleting', async () => {
    const error = new Error('Cannot delete');
    mockDeleteFolder.mockRejectedValue(error);

    await deleteMailFolder('folder-123', { force: true, json: false });

    expect(mockHandleError).toHaveBeenCalledWith(error, { json: false });
  });

  it('should throw error when no folder ID provided', async () => {
    await deleteMailFolder(null, { force: true, json: false });

    expect(mockDeleteFolder).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledTimes(1);
  });
});
