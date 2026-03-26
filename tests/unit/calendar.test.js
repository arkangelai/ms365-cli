import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track graphClient calls
const mockCalendarCreate = vi.fn();
const mockCalendarUpdate = vi.fn();
const mockCalendarGet = vi.fn();
const mockCalendarList = vi.fn();
const mockCalendarDelete = vi.fn();
const mockGetTimezone = vi.fn();

vi.mock('../../src/graph/client.js', () => ({
  default: {
    getTimezone: (...args) => mockGetTimezone(...args),
    calendar: {
      create: (...args) => mockCalendarCreate(...args),
      update: (...args) => mockCalendarUpdate(...args),
      get: (...args) => mockCalendarGet(...args),
      list: (...args) => mockCalendarList(...args),
      delete: (...args) => mockCalendarDelete(...args),
    },
  },
}));

// Mock output
const mockOutputCalendarList = vi.fn();
const mockOutputCalendarDetail = vi.fn();
const mockOutputCalendarResult = vi.fn();

vi.mock('../../src/utils/output.js', () => ({
  outputCalendarList: (...args) => mockOutputCalendarList(...args),
  outputCalendarDetail: (...args) => mockOutputCalendarDetail(...args),
  outputCalendarResult: (...args) => mockOutputCalendarResult(...args),
}));

// Mock error handler
const mockHandleError = vi.fn();
vi.mock('../../src/utils/error.js', () => ({
  handleError: (...args) => mockHandleError(...args),
}));

import { createEvent, updateEvent } from '../../src/commands/calendar.js';

describe('Calendar commands - dynamic timezone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimezone.mockResolvedValue('China Standard Time');
  });

  describe('createEvent', () => {
    it('should use dynamic timezone in event start/end', async () => {
      mockGetTimezone.mockResolvedValue('Eastern Standard Time');
      mockCalendarCreate.mockResolvedValue({
        id: 'event-123',
        subject: 'Test Meeting',
        start: { dateTime: '2026-03-04T10:00:00', timeZone: 'Eastern Standard Time' },
        end: { dateTime: '2026-03-04T11:00:00', timeZone: 'Eastern Standard Time' },
      });

      await createEvent('Test Meeting', {
        start: '2026-03-04T10:00:00',
        end: '2026-03-04T11:00:00',
        json: false,
      });

      // Verify getTimezone was called
      expect(mockGetTimezone).toHaveBeenCalled();

      // Verify the event sent to Graph API has correct timezone
      expect(mockCalendarCreate).toHaveBeenCalledTimes(1);
      const eventPayload = mockCalendarCreate.mock.calls[0][0];
      expect(eventPayload.start.timeZone).toBe('Eastern Standard Time');
      expect(eventPayload.end.timeZone).toBe('Eastern Standard Time');
      expect(eventPayload.start.dateTime).toBe('2026-03-04T10:00:00');
      expect(eventPayload.end.dateTime).toBe('2026-03-04T11:00:00');
    });

    it('should include timeZone in result output', async () => {
      mockGetTimezone.mockResolvedValue('China Standard Time');
      mockCalendarCreate.mockResolvedValue({
        id: 'event-456',
        subject: 'Lunch',
        start: { dateTime: '2026-03-04T12:00:00', timeZone: 'China Standard Time' },
        end: { dateTime: '2026-03-04T13:00:00', timeZone: 'China Standard Time' },
      });

      await createEvent('Lunch', {
        start: '2026-03-04T12:00:00',
        end: '2026-03-04T13:00:00',
        json: false,
      });

      expect(mockOutputCalendarResult).toHaveBeenCalledTimes(1);
      const result = mockOutputCalendarResult.mock.calls[0][0];
      expect(result.status).toBe('created');
      expect(result.timeZone).toBe('China Standard Time');
      expect(result.start).toContain('China Standard Time');
      expect(result.end).toContain('China Standard Time');
    });

    it('should use timezone for all-day events too', async () => {
      mockGetTimezone.mockResolvedValue('Pacific Standard Time');
      mockCalendarCreate.mockResolvedValue({
        id: 'event-789',
        subject: 'Holiday',
        start: { dateTime: '2026-03-04', timeZone: 'Pacific Standard Time' },
        end: { dateTime: '2026-03-05', timeZone: 'Pacific Standard Time' },
      });

      await createEvent('Holiday', {
        start: '2026-03-04',
        end: '2026-03-05',
        allday: true,
        json: false,
      });

      const eventPayload = mockCalendarCreate.mock.calls[0][0];
      expect(eventPayload.start.timeZone).toBe('Pacific Standard Time');
      expect(eventPayload.end.timeZone).toBe('Pacific Standard Time');
      expect(eventPayload.isAllDay).toBe(true);
    });
  });

  describe('updateEvent', () => {
    it('should use dynamic timezone when updating start/end', async () => {
      mockGetTimezone.mockResolvedValue('Tokyo Standard Time');
      mockCalendarUpdate.mockResolvedValue({
        id: 'event-123',
        subject: 'Updated Meeting',
        start: { dateTime: '2026-03-04T14:00:00', timeZone: 'Tokyo Standard Time' },
        end: { dateTime: '2026-03-04T15:00:00', timeZone: 'Tokyo Standard Time' },
      });

      await updateEvent('event-123', {
        start: '2026-03-04T14:00:00',
        end: '2026-03-04T15:00:00',
        json: false,
      });

      expect(mockGetTimezone).toHaveBeenCalled();
      const updates = mockCalendarUpdate.mock.calls[0][1];
      expect(updates.start.timeZone).toBe('Tokyo Standard Time');
      expect(updates.end.timeZone).toBe('Tokyo Standard Time');
    });

    it('should include timeZone in update result output', async () => {
      mockGetTimezone.mockResolvedValue('W. Europe Standard Time');
      mockCalendarUpdate.mockResolvedValue({
        id: 'event-999',
        subject: 'Standup',
        start: { dateTime: '2026-03-04T09:00:00', timeZone: 'W. Europe Standard Time' },
        end: { dateTime: '2026-03-04T09:30:00', timeZone: 'W. Europe Standard Time' },
      });

      await updateEvent('event-999', {
        title: 'Standup',
        json: false,
      });

      const result = mockOutputCalendarResult.mock.calls[0][0];
      expect(result.status).toBe('updated');
      expect(result.timeZone).toBe('W. Europe Standard Time');
    });

    it('should still call getTimezone even when only updating title', async () => {
      mockGetTimezone.mockResolvedValue('UTC');
      mockCalendarUpdate.mockResolvedValue({
        id: 'event-111',
        subject: 'New Title',
        start: { dateTime: '2026-03-04T10:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-03-04T11:00:00', timeZone: 'UTC' },
      });

      await updateEvent('event-111', {
        title: 'New Title',
        json: false,
      });

      // getTimezone is called for the result display even if not updating time
      expect(mockGetTimezone).toHaveBeenCalled();
    });
  });
});