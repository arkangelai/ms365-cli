import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReply = vi.fn();
const mockReplyAll = vi.fn();
const mockForward = vi.fn();
const mockCreateReply = vi.fn();
const mockCreateReplyAll = vi.fn();
const mockCreateForward = vi.fn();
const mockAddAttachment = vi.fn();
const mockSendDraft = vi.fn();
const mockUpdateMessage = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFileSync: vi.fn((filePath) => {
      if (filePath.includes('nonexistent')) throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      return Buffer.from('test file content');
    }),
  };
});

vi.mock('../../src/graph/client.js', () => ({
  default: {
    mail: {
      reply: (...args) => mockReply(...args),
      replyAll: (...args) => mockReplyAll(...args),
      forward: (...args) => mockForward(...args),
      createReply: (...args) => mockCreateReply(...args),
      createReplyAll: (...args) => mockCreateReplyAll(...args),
      createForward: (...args) => mockCreateForward(...args),
      addAttachment: (...args) => mockAddAttachment(...args),
      sendDraft: (...args) => mockSendDraft(...args),
      updateMessage: (...args) => mockUpdateMessage(...args),
    },
    getCurrentUser: vi.fn().mockResolvedValue({
      mail: 'test@test.com',
      userPrincipalName: 'test@test.com',
    }),
  },
}));

const mockOutputMailReplyResult = vi.fn();
const mockOutputMailForwardResult = vi.fn();

vi.mock('../../src/utils/output.js', () => ({
  outputMailList: vi.fn(),
  outputMailDetail: vi.fn(),
  outputSendResult: vi.fn(),
  outputAttachmentList: vi.fn(),
  outputAttachmentDownload: vi.fn(),
  outputMailDeleteResult: vi.fn(),
  outputMailMoveResult: vi.fn(),
  outputMailReplyResult: (...args) => mockOutputMailReplyResult(...args),
  outputMailForwardResult: (...args) => mockOutputMailForwardResult(...args),
  outputMailFolderList: vi.fn(),
  outputMailFolderResult: vi.fn(),
}));

const mockHandleError = vi.fn();
vi.mock('../../src/utils/error.js', () => ({
  handleError: (...args) => mockHandleError(...args),
}));

vi.mock('../../src/utils/trusted-senders.js', () => ({
  isTrustedSender: vi.fn().mockReturnValue(true),
  addTrustedSender: vi.fn(),
  removeTrustedSender: vi.fn(),
  listTrustedSenders: vi.fn().mockReturnValue([]),
  getWhitelistFilePath: vi.fn(),
}));

import { replyMail, replyAllMail, forwardMail } from '../../src/commands/mail.js';

describe('Mail reply/reply-all/forward commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReply.mockResolvedValue({});
    mockReplyAll.mockResolvedValue({});
    mockForward.mockResolvedValue({});
    mockCreateReply.mockResolvedValue({ id: 'draft-1' });
    mockCreateReplyAll.mockResolvedValue({ id: 'draft-1' });
    mockCreateForward.mockResolvedValue({ id: 'draft-1' });
    mockAddAttachment.mockResolvedValue({});
    mockSendDraft.mockResolvedValue({});
    mockUpdateMessage.mockResolvedValue({});
  });

  describe('replyMail', () => {
    it('should build comment payload by default', async () => {
      await replyMail('msg-1', 'Thanks for the update', { json: false });

      expect(mockReply).toHaveBeenCalledTimes(1);
      expect(mockReply).toHaveBeenCalledWith('msg-1', {
        comment: 'Thanks for the update',
      });
      expect(mockOutputMailReplyResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          action: 'reply',
          id: 'msg-1',
        }),
        { json: false }
      );
    });

    it('should build HTML payload when html is true', async () => {
      await replyMail('msg-1', '<b>Thanks</b>', { html: true, json: true });

      expect(mockReply).toHaveBeenCalledWith('msg-1', {
        message: {
          body: {
            contentType: 'HTML',
            content: '<b>Thanks</b>',
          },
        },
      });
      expect(mockOutputMailReplyResult).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reply' }),
        { json: true }
      );
    });

    it('should validate missing id', async () => {
      await replyMail('', 'content', { json: false });

      expect(mockReply).not.toHaveBeenCalled();
      expect(mockHandleError).toHaveBeenCalledTimes(1);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { json: false });
    });

    it('should validate missing content', async () => {
      await replyMail('msg-1', '', { json: false });

      expect(mockReply).not.toHaveBeenCalled();
      expect(mockHandleError).toHaveBeenCalledTimes(1);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { json: false });
    });

    it('should route graph errors through handleError', async () => {
      const error = new Error('Reply failed');
      mockReply.mockRejectedValue(error);

      await replyMail('msg-1', 'content', { json: true });

      expect(mockHandleError).toHaveBeenCalledWith(error, { json: true });
    });
  });

  describe('replyAllMail', () => {
    it('should build comment payload correctly', async () => {
      await replyAllMail('msg-2', 'Replying all', { json: false });

      expect(mockReplyAll).toHaveBeenCalledTimes(1);
      expect(mockReplyAll).toHaveBeenCalledWith('msg-2', {
        comment: 'Replying all',
      });
      expect(mockOutputMailReplyResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          action: 'reply-all',
          id: 'msg-2',
        }),
        { json: false }
      );
    });

    it('should validate missing id/content', async () => {
      await replyAllMail('', 'content', { json: false });
      await replyAllMail('msg-2', '', { json: false });

      expect(mockReplyAll).not.toHaveBeenCalled();
      expect(mockHandleError).toHaveBeenCalledTimes(2);
    });
  });

  describe('forwardMail', () => {
    it('should build forward payload with toRecipients', async () => {
      await forwardMail('msg-3', 'alice@example.com', 'FYI', { json: false });

      expect(mockForward).toHaveBeenCalledTimes(1);
      expect(mockForward).toHaveBeenCalledWith('msg-3', {
        comment: 'FYI',
        toRecipients: [
          {
            emailAddress: {
              address: 'alice@example.com',
            },
          },
        ],
      });
      expect(mockOutputMailForwardResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          action: 'forward',
          id: 'msg-3',
          to: 'alice@example.com',
          recipientCount: 1,
        }),
        { json: false }
      );
    });

    it('should handle comma-separated recipients', async () => {
      await forwardMail('msg-3', 'alice@example.com, bob@example.com', 'FYI', { json: false });

      expect(mockForward).toHaveBeenCalledWith('msg-3', {
        comment: 'FYI',
        toRecipients: [
          {
            emailAddress: {
              address: 'alice@example.com',
            },
          },
          {
            emailAddress: {
              address: 'bob@example.com',
            },
          },
        ],
      });
    });

    it('should send empty comment when no comment is provided', async () => {
      await forwardMail('msg-3', 'alice@example.com', '', { json: false });

      expect(mockForward).toHaveBeenCalledWith('msg-3', {
        comment: '',
        toRecipients: [
          {
            emailAddress: {
              address: 'alice@example.com',
            },
          },
        ],
      });
    });

    it('should build HTML payload when html is true', async () => {
      await forwardMail('msg-3', 'alice@example.com', '<p>FYI</p>', { html: true, json: true });

      expect(mockForward).toHaveBeenCalledWith('msg-3', {
        message: {
          body: {
            contentType: 'HTML',
            content: '<p>FYI</p>',
          },
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'alice@example.com',
            },
          },
        ],
      });
    });

    it('should validate missing id and recipients', async () => {
      await forwardMail('', 'alice@example.com', 'fwd', { json: false });
      await forwardMail('msg-3', '', 'fwd', { json: false });
      await forwardMail('msg-3', ' , ', 'fwd', { json: false });

      expect(mockForward).not.toHaveBeenCalled();
      expect(mockHandleError).toHaveBeenCalledTimes(3);
    });

    it('should route forward errors through handleError', async () => {
      const error = new Error('Forward failed');
      mockForward.mockRejectedValue(error);

      await forwardMail('msg-3', 'alice@example.com', 'fwd', { json: true });

      expect(mockHandleError).toHaveBeenCalledWith(error, { json: true });
    });
  });

  describe('Attachment support', () => {
    it('reply with attachments should use draft flow and include attachmentCount', async () => {
      await replyMail('msg-1', 'Thanks for the update', {
        json: false,
        attach: ['/tmp/a.txt'],
      });

      expect(mockReply).not.toHaveBeenCalled();
      expect(mockCreateReply).toHaveBeenCalledTimes(1);
      expect(mockCreateReply).toHaveBeenCalledWith('msg-1', {
        comment: 'Thanks for the update',
      });
      expect(mockAddAttachment).toHaveBeenCalledTimes(1);
      expect(mockAddAttachment).toHaveBeenCalledWith(
        'draft-1',
        expect.objectContaining({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: 'a.txt',
          contentBytes: Buffer.from('test file content').toString('base64'),
        })
      );
      expect(mockSendDraft).toHaveBeenCalledTimes(1);
      expect(mockSendDraft).toHaveBeenCalledWith('draft-1');
      expect(mockOutputMailReplyResult).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reply',
          status: 'sent',
          id: 'msg-1',
          attachmentCount: 1,
        }),
        { json: false }
      );
    });

    it('reply-all with attachments should use draft flow', async () => {
      await replyAllMail('msg-2', 'Replying all', {
        json: false,
        attach: ['/tmp/a.txt'],
      });

      expect(mockReplyAll).not.toHaveBeenCalled();
      expect(mockCreateReplyAll).toHaveBeenCalledTimes(1);
      expect(mockCreateReplyAll).toHaveBeenCalledWith('msg-2', {
        comment: 'Replying all',
      });
      expect(mockAddAttachment).toHaveBeenCalledTimes(1);
      expect(mockSendDraft).toHaveBeenCalledTimes(1);
      expect(mockSendDraft).toHaveBeenCalledWith('draft-1');
    });

    it('forward with attachments should use createForward/updateMessage/addAttachment/sendDraft', async () => {
      await forwardMail('msg-3', 'alice@example.com', 'FYI', {
        json: false,
        attach: ['/tmp/a.txt'],
      });

      expect(mockForward).not.toHaveBeenCalled();
      expect(mockCreateForward).toHaveBeenCalledTimes(1);
      expect(mockCreateForward).toHaveBeenCalledWith('msg-3');
      expect(mockUpdateMessage).toHaveBeenCalledTimes(1);
      expect(mockUpdateMessage).toHaveBeenCalledWith('draft-1', {
        body: {
          contentType: 'Text',
          content: 'FYI',
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'alice@example.com',
            },
          },
        ],
      });
      expect(mockAddAttachment).toHaveBeenCalledTimes(1);
      expect(mockSendDraft).toHaveBeenCalledTimes(1);
      expect(mockSendDraft).toHaveBeenCalledWith('draft-1');
      expect(mockOutputMailForwardResult).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'forward',
          status: 'sent',
          id: 'msg-3',
          attachmentCount: 1,
        }),
        { json: false }
      );
    });

    it('multiple attachments should call addAttachment for each file', async () => {
      await replyMail('msg-1', 'Thanks', {
        json: false,
        attach: ['/tmp/a.txt', '/tmp/b.txt', '/tmp/c.txt'],
      });

      expect(mockAddAttachment).toHaveBeenCalledTimes(3);
    });

    it('invalid attachment file path should be routed through handleError', async () => {
      await replyMail('msg-1', 'Thanks', {
        json: true,
        attach: ['/tmp/nonexistent-file.txt'],
      });

      expect(mockHandleError).toHaveBeenCalledTimes(1);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { json: true });
      expect(mockCreateReply).not.toHaveBeenCalled();
      expect(mockSendDraft).not.toHaveBeenCalled();
    });

    it('no attachments should continue using direct send endpoints', async () => {
      await replyMail('msg-1', 'Thanks for the update', { json: false });
      await replyAllMail('msg-2', 'Replying all', { json: false, attach: [] });
      await forwardMail('msg-3', 'alice@example.com', 'FYI', { json: false });

      expect(mockReply).toHaveBeenCalledTimes(1);
      expect(mockReplyAll).toHaveBeenCalledTimes(1);
      expect(mockForward).toHaveBeenCalledTimes(1);
      expect(mockCreateReply).not.toHaveBeenCalled();
      expect(mockCreateReplyAll).not.toHaveBeenCalled();
      expect(mockCreateForward).not.toHaveBeenCalled();
    });
  });
});
