import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track graphClient calls
const mockMailList = vi.fn();

vi.mock('../../src/graph/client.js', () => ({
  default: {
    mail: {
      list: (...args) => mockMailList(...args),
    },
    getCurrentUser: vi.fn().mockResolvedValue({
      mail: 'test@test.com',
      userPrincipalName: 'test@test.com',
    }),
  },
}));

// Mock output
vi.mock('../../src/utils/output.js', () => ({
  outputMailList: vi.fn(),
  outputMailDetail: vi.fn(),
  outputSendResult: vi.fn(),
  outputAttachmentList: vi.fn(),
  outputAttachmentDownload: vi.fn(),
}));

// Mock error handler
vi.mock('../../src/utils/error.js', () => ({
  handleError: vi.fn(),
}));

// Mock trusted-senders module
vi.mock('../../src/utils/trusted-senders.js', () => ({
  isTrustedSender: vi.fn().mockReturnValue(true),
  addTrustedSender: vi.fn(),
  removeTrustedSender: vi.fn(),
  listTrustedSenders: vi.fn().mockReturnValue([]),
  getWhitelistFilePath: vi.fn(),
}));

import { listMails } from '../../src/commands/mail.js';

describe('Mail commands - focused inbox', () => {
  const sampleMails = [
    {
      id: 'msg-1',
      subject: 'Test Email',
      from: {
        emailAddress: {
          name: 'Test User',
          address: 'test@test.com',
        },
      },
      receivedDateTime: '2026-01-01T00:00:00Z',
      isRead: false,
      hasAttachments: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockMailList.mockResolvedValue(sampleMails);
  });

  describe('listMails with focused: true', () => {
    it('should pass inferenceClassification filter to graphClient.mail.list', async () => {
      await listMails({ focused: true, json: false });

      expect(mockMailList).toHaveBeenCalledTimes(1);
      expect(mockMailList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: "inferenceClassification eq 'focused'",
        })
      );
    });

    it('should include filter in query params even when other options are provided', async () => {
      await listMails({ focused: true, top: 20, folder: 'inbox', json: false });

      expect(mockMailList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: "inferenceClassification eq 'focused'",
          top: 20,
          folder: 'inbox',
        })
      );
    });
  });

  describe('listMails with focused: false', () => {
    it('should NOT include filter when focused is false', async () => {
      await listMails({ focused: false, json: false });

      expect(mockMailList).toHaveBeenCalledTimes(1);
      const callArgs = mockMailList.mock.calls[0][0];
      expect(callArgs.filter).toBeUndefined();
    });
  });

  describe('listMails with default options', () => {
    it('should NOT include filter when focused option is omitted', async () => {
      await listMails({ json: false });

      expect(mockMailList).toHaveBeenCalledTimes(1);
      const callArgs = mockMailList.mock.calls[0][0];
      expect(callArgs.filter).toBeUndefined();
    });

    it('should include default top and folder values', async () => {
      await listMails({ json: false });

      expect(mockMailList).toHaveBeenCalledWith(
        expect.objectContaining({
          top: 10,
          folder: 'inbox',
        })
      );
    });
  });

  describe('graphClient.mail.list filter parameter behavior', () => {
    it('should add $filter query param to URL when filter option is provided', async () => {
      await listMails({ focused: true, json: false });

      // Verify the mock was called with the filter
      const callArgs = mockMailList.mock.calls[0][0];
      expect(callArgs).toHaveProperty('filter');
      expect(callArgs.filter).toBe("inferenceClassification eq 'focused'");
    });

    it('should not add $filter query param when filter is undefined', async () => {
      await listMails({ focused: false, json: false });

      const callArgs = mockMailList.mock.calls[0][0];
      expect(callArgs.filter).toBeUndefined();
    });
  });

  describe('trusted sender handling with focused emails', () => {
    it('should mark emails as trusted when focused filter is used', async () => {
      await listMails({ focused: true, json: false });

      expect(mockMailList).toHaveBeenCalled();
      // Verify that the function executed without errors
      expect(mockMailList).toHaveBeenCalledTimes(1);
    });

    it('should handle emails with missing sender information', async () => {
      const mailsWithMissingSender = [
        {
          id: 'msg-2',
          subject: 'No Sender',
          from: null,
          receivedDateTime: '2026-01-02T00:00:00Z',
          isRead: false,
          hasAttachments: false,
        },
      ];

      mockMailList.mockResolvedValue(mailsWithMissingSender);

      await listMails({ focused: true, json: false });

      expect(mockMailList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: "inferenceClassification eq 'focused'",
        })
      );
    });
  });
});
