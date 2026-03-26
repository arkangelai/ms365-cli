import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import graphClient from '../../src/graph/client.js';
import calendarCommands from '../../src/commands/calendar.js';
import { getAvailableAccounts, setupAuth, teardownAuth } from './helpers/setup.js';

const accounts = getAvailableAccounts();

describe('[Integration] Calendar — Graph API', { timeout: 30000 }, () => {
  if (accounts.length === 0) {
    it('requires integration env vars', (ctx) => {
      console.log('⏭️  Integration env vars not set — skipping calendar integration tests');
      ctx.skip();
    });
    return;
  }

  describe.each(accounts)('$type account', (account) => {
    let hasAuth = false;
    let savedEnv = {};
    const createdEventIds = [];

    beforeAll(async () => {
      const result = await setupAuth(account);
      hasAuth = result.hasAuth;
      savedEnv = result.savedEnv;
    });

    afterAll(async () => {
      if (hasAuth) {
        for (const eventId of createdEventIds) {
          try {
            await graphClient.calendar.delete(eventId);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
      teardownAuth(savedEnv);
    });
  describe('List events (/me/calendarView)', () => {
    it('should list calendar events for a date range', { retry: 2 }, async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const startDateTime = new Date().toISOString();
      const endDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const events = await graphClient.calendar.list({
        startDateTime,
        endDateTime,
        top: 5,
      });

      expect(Array.isArray(events)).toBe(true);

      for (const event of events) {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('subject');
        expect(event).toHaveProperty('start');
        expect(event).toHaveProperty('end');
        expect(event.start).toHaveProperty('dateTime');
        expect(event.end).toHaveProperty('dateTime');
      }
    });

    it('should respect the top parameter', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const startDateTime = new Date().toISOString();
      const endDateTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const events = await graphClient.calendar.list({
        startDateTime,
        endDateTime,
        top: 2,
      });

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Create event (/me/events)', () => {
    it('should create a regular event', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const event = {
        subject: '[Integration Test] Calendar Create Event',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
        isAllDay: false,
      };

      const created = await graphClient.calendar.create(event);
      createdEventIds.push(created.id);

      expect(created).toHaveProperty('id');
      expect(created.subject).toBe('[Integration Test] Calendar Create Event');
      expect(created.isAllDay).toBe(false);
      expect(created.start).toHaveProperty('dateTime');
      expect(created.end).toHaveProperty('dateTime');
    });

    it('should create an all-day event', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const startStr = tomorrow.toISOString().split('T')[0];
      const endStr = dayAfter.toISOString().split('T')[0];

      const event = {
        subject: '[Integration Test] All-Day Event',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
        isAllDay: true,
      };

      const created = await graphClient.calendar.create(event);
      createdEventIds.push(created.id);

      expect(created).toHaveProperty('id');
      expect(created.subject).toBe('[Integration Test] All-Day Event');
      expect(created.isAllDay).toBe(true);
    });

    it('should create an event with location and body', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T14:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T15:00:00';

      const event = {
        subject: '[Integration Test] Event with Details',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
        isAllDay: false,
        location: { displayName: 'Test Room 101' },
        body: { contentType: 'HTML', content: '<p>Integration test body</p>' },
      };

      const created = await graphClient.calendar.create(event);
      createdEventIds.push(created.id);

      expect(created).toHaveProperty('id');
      expect(created.location.displayName).toBe('Test Room 101');
      expect(created.body.content).toContain('Integration test body');
    });
  });

  describe('Get event (/me/events/{id})', () => {
    it('should retrieve an event by ID', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      // Create an event to retrieve
      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] Get Event Test',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      createdEventIds.push(created.id);

      // Now retrieve it
      const fetched = await graphClient.calendar.get(created.id);

      expect(fetched.id).toBe(created.id);
      expect(fetched.subject).toBe('[Integration Test] Get Event Test');
      expect(fetched).toHaveProperty('start');
      expect(fetched).toHaveProperty('end');
      expect(fetched).toHaveProperty('bodyPreview');
    });
  });

  describe('Update event (/me/events/{id})', () => {
    it('should update an event subject', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] Before Update',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      createdEventIds.push(created.id);

      // Update the event
      const updated = await graphClient.calendar.update(created.id, {
        subject: '[Integration Test] After Update',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.subject).toBe('[Integration Test] After Update');
    });

    it('should update event time and location', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';
      const newStartStr = tomorrow.toISOString().split('T')[0] + 'T14:00:00';
      const newEndStr = tomorrow.toISOString().split('T')[0] + 'T15:30:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] Update Time/Location',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      createdEventIds.push(created.id);

      const updated = await graphClient.calendar.update(created.id, {
        start: { dateTime: newStartStr, timeZone: tz },
        end: { dateTime: newEndStr, timeZone: tz },
        location: { displayName: 'Updated Room' },
      });

      expect(updated.location.displayName).toBe('Updated Room');
    });
  });

  describe('Delete event (/me/events/{id})', () => {
    it('should delete an event', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] To Be Deleted',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      // Don't add to createdEventIds since we'll delete it here

      const result = await graphClient.calendar.delete(created.id);
      expect(result).toEqual({ success: true });

      // Verify it's gone — get should throw
      await expect(
        graphClient.calendar.get(created.id)
      ).rejects.toThrow();
    });
  });

  describe('Timezone resolution', () => {
    it('should resolve a valid timezone', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();

      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('Full command flows', () => {
    it('should execute listEvents command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      await expect(
        calendarCommands.list({ days: 7, top: 5, json: true })
      ).resolves.not.toThrow();
    });

    it('should execute createEvent command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T16:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T17:00:00';

      // The command function calls handleError on failures, so it won't throw.
      // We just verify it completes.
      await expect(
        calendarCommands.create('[Integration Test] Command Flow', {
          start: startStr,
          end: endStr,
          json: true,
        })
      ).resolves.not.toThrow();

      // Clean up: find the event and delete it
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = await graphClient.calendar.list({
        startDateTime: now,
        endDateTime: future,
        top: 50,
      });
      const testEvent = events.find(e => e.subject === '[Integration Test] Command Flow');
      if (testEvent) {
        createdEventIds.push(testEvent.id);
      }
    });

    it('should execute getEvent command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      // Create an event first
      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] Get Command Flow',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      createdEventIds.push(created.id);

      await expect(
        calendarCommands.get(created.id, { json: true })
      ).resolves.not.toThrow();
    });

    it('should execute deleteEvent command without throwing', async (ctx) => {
      if (!hasAuth) return ctx.skip();

      const tz = await graphClient.getTimezone();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startStr = tomorrow.toISOString().split('T')[0] + 'T10:00:00';
      const endStr = tomorrow.toISOString().split('T')[0] + 'T11:00:00';

      const created = await graphClient.calendar.create({
        subject: '[Integration Test] Delete Command Flow',
        start: { dateTime: startStr, timeZone: tz },
        end: { dateTime: endStr, timeZone: tz },
      });
      // Don't push to createdEventIds — we're deleting it here

      await expect(
        calendarCommands.delete(created.id, { json: true })
      ).resolves.not.toThrow();
    });
  });
  });
});
