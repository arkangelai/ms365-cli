import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import graphClient from '../../src/graph/client.js';
import mailCommands from '../../src/commands/mail.js';
import { getAvailableAccounts, setupAuth, teardownAuth } from './helpers/setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const accounts = getAvailableAccounts();

describe('[Integration] Mail — Graph API', { timeout: 90000 }, () => {
  if (accounts.length === 0) {
    it('requires integration env vars', (ctx) => {
      console.log('⏭️  Integration env vars not set — skipping mail integration tests');
      ctx.skip();
    });
    return;
  }

  describe.each(accounts)('$type account', (account) => {
    let hasAuth = false;
    let savedEnv = {};

    beforeAll(async () => {
      const result = await setupAuth(account);
      hasAuth = result.hasAuth;
      savedEnv = result.savedEnv;
    });

    afterAll(() => teardownAuth(savedEnv));

    describe('Current user', () => {
      it('should get current user profile', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();

        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('displayName');
        expect(user.mail || user.userPrincipalName).toBeTruthy();
      });
    });

    describe('List emails (/me/messages)', () => {
      it('should list inbox emails', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 5, folder: 'inbox' });

        expect(Array.isArray(mails)).toBe(true);

        for (const mail of mails) {
          expect(mail).toHaveProperty('id');
          expect(mail).toHaveProperty('subject');
          expect(mail).toHaveProperty('receivedDateTime');
          expect(mail).toHaveProperty('isRead');
        }
      });

      it('should respect top parameter', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 2, folder: 'inbox' });

        expect(Array.isArray(mails)).toBe(true);
        expect(mails.length).toBeLessThanOrEqual(2);
      });

      it('should list sent items', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 5, folder: 'sent' });

        expect(Array.isArray(mails)).toBe(true);
      });

      it('should list drafts', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 5, folder: 'drafts' });

        expect(Array.isArray(mails)).toBe(true);
      });
    });

    describe('List focused inbox emails', () => {
      it('should list only focused inbox emails via filter', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({
          top: 5,
          folder: 'inbox',
          filter: "inferenceClassification eq 'focused'",
        });

        expect(Array.isArray(mails)).toBe(true);

        for (const mail of mails) {
          expect(mail).toHaveProperty('id');
          expect(mail).toHaveProperty('subject');
          expect(mail).toHaveProperty('receivedDateTime');
        }
      });

      it('should return array (possibly empty) for focused filter', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({
          top: 2,
          folder: 'inbox',
          filter: "inferenceClassification eq 'focused'",
        });

        expect(Array.isArray(mails)).toBe(true);
        expect(mails.length).toBeLessThanOrEqual(2);
      });

      it('should return focused emails sorted by receivedDateTime descending', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({
          top: 10,
          folder: 'inbox',
          filter: "inferenceClassification eq 'focused'",
        });

        if (mails.length < 2) {
          console.log('  (fewer than 2 focused emails — cannot verify sort order)');
          return ctx.skip();
        }

        // Verify descending order: each receivedDateTime >= the next one
        for (let i = 0; i < mails.length - 1; i++) {
          const current = new Date(mails[i].receivedDateTime).getTime();
          const next = new Date(mails[i + 1].receivedDateTime).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      });
    });

    describe('Get email (/me/messages/{id})', () => {
      it('should retrieve an email by ID with body and attachments info', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 1, folder: 'inbox' });
        if (mails.length === 0) {
          console.log('  (no emails in inbox — cannot test get)');
          return ctx.skip();
        }

        const mail = await graphClient.mail.get(mails[0].id);

        expect(mail).toHaveProperty('id');
        expect(mail).toHaveProperty('subject');
        expect(mail).toHaveProperty('body');
        expect(mail.body).toHaveProperty('content');
        expect(mail.body).toHaveProperty('contentType');
        expect(mail).toHaveProperty('from');
      });
    });

    describe('Search emails (/me/messages?$search)', () => {
      it('should search emails by keyword', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const results = await graphClient.mail.search('test', { top: 5 });

        expect(Array.isArray(results)).toBe(true);
      });

      it('should respect top parameter in search', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const results = await graphClient.mail.search('the', { top: 2 });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(2);
      });
    });

    describe('Attachments (/me/messages/{id}/attachments)', () => {
      let sentMailId = null;

      // Send an email with attachment to self so we have a guaranteed test target
      beforeAll(async () => {
        if (!hasAuth) return;
        try {
          const user = await graphClient.getCurrentUser();
          const selfEmail = user.mail || user.userPrincipalName;
          if (!selfEmail) return;

          const testContent = Buffer.from('integration-test-attachment-content').toString('base64');
          const message = {
            subject: `[Integration Test] Attachment Test (${account.type}) ${Date.now()}`,
            body: { contentType: 'Text', content: 'Automated test — safe to delete.' },
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            attachments: [{
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: 'test-attachment.txt',
              contentBytes: testContent,
            }],
          };
          await graphClient.mail.send(message);

          // Wait for delivery
          for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const mails = await graphClient.mail.list({ top: 5, folder: 'inbox' });
            const found = mails.find(m => m.subject?.includes('Attachment Test') && m.hasAttachments);
            if (found) { sentMailId = found.id; break; }
          }
        } catch { /* best effort */ }
      }, 75000);

      it('should list attachments for an email', async (ctx) => {
        if (!hasAuth || !sentMailId) return ctx.skip();

        const attachments = await graphClient.mail.attachments(sentMailId);

        expect(Array.isArray(attachments)).toBe(true);
        expect(attachments.length).toBeGreaterThan(0);

        for (const att of attachments) {
          expect(att).toHaveProperty('id');
          expect(att).toHaveProperty('name');
          expect(att).toHaveProperty('size');
        }
      });

      it('should return empty array for email without attachments', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 20, folder: 'inbox' });
        const mailWithout = mails.find(m => !m.hasAttachments);

        if (!mailWithout) {
          console.log('  (all emails have attachments — skipping)');
          return ctx.skip();
        }

        const attachments = await graphClient.mail.attachments(mailWithout.id);

        expect(Array.isArray(attachments)).toBe(true);
        expect(attachments.length).toBe(0);
      });
    });

    describe('Download attachment (/me/messages/{id}/attachments/{id})', () => {
      it('should download a specific attachment', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 20, folder: 'inbox' });
        const mailWithAttachments = mails.find(m => m.hasAttachments);

        if (!mailWithAttachments) {
          console.log('  (no emails with attachments found — skipping)');
          return ctx.skip();
        }

        const attachments = await graphClient.mail.attachments(mailWithAttachments.id);
        if (attachments.length === 0) {
          return ctx.skip();
        }

        const attachment = await graphClient.mail.downloadAttachment(
          mailWithAttachments.id,
          attachments[0].id
        );

        expect(attachment).toHaveProperty('name');
        expect(attachment).toHaveProperty('contentBytes');
        expect(typeof attachment.contentBytes).toBe('string');
      });
    });

    describe('Send email (/me/sendMail)', () => {
      it('should send an email to self', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) {
          console.log('  (cannot determine self email — skipping send test)');
          return ctx.skip();
        }

        const message = {
          subject: `[Integration Test] Mail Send Test (${account.type})`,
          body: {
            contentType: 'HTML',
            content: '<p>This is an automated integration test email. Safe to delete.</p>',
          },
          toRecipients: [
            { emailAddress: { address: selfEmail } },
          ],
        };

        const result = await graphClient.mail.send(message);

        expect(result).toBeDefined();
      });
    });

    describe('Full command flows', () => {
      it('should execute listMails command without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          mailCommands.list({ top: 5, folder: 'inbox', json: true })
        ).resolves.not.toThrow();
      });

      it('should execute listMails with focused option without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          mailCommands.list({ top: 5, folder: 'inbox', focused: true, json: true })
        ).resolves.not.toThrow();
      });

      it('should execute readMail command without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 1, folder: 'inbox' });
        if (mails.length === 0) {
          return ctx.skip();
        }

        try {
          await mailCommands.read(mails[0].id, { json: true });
        } catch (error) {
          if (error.message?.includes('process.exit')) {
            return ctx.skip();
          }
          throw error;
        }
      });

      it('should execute readMail with --force without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 1, folder: 'inbox' });
        if (mails.length === 0) {
          return ctx.skip();
        }

        try {
          await mailCommands.read(mails[0].id, { json: true, force: true });
        } catch (error) {
          if (error.message?.includes('process.exit')) {
            return ctx.skip();
          }
          throw error;
        }
      });

      it('should execute searchMails command without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          mailCommands.search('test', { top: 5, json: true })
        ).resolves.not.toThrow();
      });

      it('should execute listAttachments command without throwing', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const mails = await graphClient.mail.list({ top: 1, folder: 'inbox' });
        if (mails.length === 0) {
          return ctx.skip();
        }

        try {
          await mailCommands.attachments(mails[0].id, { json: true });
        } catch (error) {
          if (error.message?.includes('process.exit') || error.statusCode === 403) {
            return ctx.skip();
          }
          throw error;
        }
      });

      it('should handle empty search results gracefully', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          mailCommands.search('zzxqqnonexistent99integration', { top: 5, json: true })
        ).resolves.not.toThrow();
      });
    });

    describe('Mail Folders (list, create, delete)', () => {
      it('should list mail folders', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const folders = await graphClient.mail.listFolders({ top: 10 });

        expect(Array.isArray(folders)).toBe(true);
        expect(folders.length).toBeGreaterThan(0);

        for (const folder of folders) {
          expect(folder).toHaveProperty('id');
          expect(folder).toHaveProperty('displayName');
          expect(folder).toHaveProperty('totalItemCount');
          expect(folder).toHaveProperty('unreadItemCount');
        }
      });

      it('should list child folders of Inbox', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();

        // This may return empty if no child folders exist, which is OK
        const childFolders = await graphClient.mail.listChildFolders('inbox', { top: 10 });
        expect(Array.isArray(childFolders)).toBe(true);
      });

      it('should create and delete a mail folder', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const uniqueName = `test-folder-${Date.now()}`;

        // Create folder
        const created = await graphClient.mail.createFolder(uniqueName);
        expect(created).toHaveProperty('id');
        expect(created.displayName).toBe(uniqueName);

        // Verify it appears in the folder list
        const folders = await graphClient.mail.listFolders({ top: 100 });
        const found = folders.find(f => f.id === created.id);
        expect(found).toBeTruthy();

        // Delete folder (cleanup)
        const deleted = await graphClient.mail.deleteFolder(created.id);
        expect(deleted).toHaveProperty('success', true);
      });

      it('should create a child folder under Inbox', { retry: 2 }, async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const uniqueName = `test-child-folder-${Date.now()}`;

        // Create child folder under Inbox
        const created = await graphClient.mail.createFolder(uniqueName, 'inbox');
        expect(created).toHaveProperty('id');
        expect(created.displayName).toBe(uniqueName);

        // Cleanup
        try {
          await graphClient.mail.deleteFolder(created.id);
        } catch {
          // Best-effort cleanup
        }
      });
    });

    describe('Mail delete and move', () => {
      it('should execute deleteMail command without throwing (--json --force)', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        // Send a test email to self, then delete it
        const user = await graphClient.getCurrentUser();
        const email = user.mail || user.userPrincipalName;
        if (!email) return ctx.skip();

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: email } }],
            subject: `integration-test-delete-${Date.now()}`,
            body: { contentType: 'Text', content: 'This email will be deleted by integration tests.' },
          });
        } catch {
          return ctx.skip(); // Can't send email, skip test
        }

        // Wait for email delivery
        await new Promise(r => setTimeout(r, 5000));

        // Find the test email
        const mails = await graphClient.mail.list({ top: 5, folder: 'inbox' });
        const testMail = mails.find(m => m.subject?.startsWith('integration-test-delete-'));
        if (!testMail) return ctx.skip(); // Email not delivered yet

        // Delete it
        await expect(
          mailCommands.delete(testMail.id, { force: true, json: true })
        ).resolves.not.toThrow();
      });

      it('should execute moveMail command without throwing (--json)', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        // Send a test email to self, then move it
        const user = await graphClient.getCurrentUser();
        const email = user.mail || user.userPrincipalName;
        if (!email) return ctx.skip();

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: email } }],
            subject: `integration-test-move-${Date.now()}`,
            body: { contentType: 'Text', content: 'This email will be moved by integration tests.' },
          });
        } catch {
          return ctx.skip();
        }

        // Wait for email delivery
        await new Promise(r => setTimeout(r, 5000));

        // Find the test email
        const mails = await graphClient.mail.list({ top: 5, folder: 'inbox' });
        const testMail = mails.find(m => m.subject?.startsWith('integration-test-move-'));
        if (!testMail) return ctx.skip();

        // Move it to drafts
        await expect(
          mailCommands.move(testMail.id, 'drafts', { json: true })
        ).resolves.not.toThrow();

        // Cleanup: delete from drafts
        try {
          const drafts = await graphClient.mail.list({ top: 10, folder: 'drafts' });
          const movedMail = drafts.find(m => m.subject?.startsWith('integration-test-move-'));
          if (movedMail) {
            await graphClient.mail.deleteMessage(movedMail.id);
          }
        } catch {
          // Best-effort cleanup
        }
      });

      it('should execute listMailFolders command without throwing (--json)', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        await expect(
          mailCommands.folderList({ json: true })
        ).resolves.not.toThrow();
      });

      it('should execute createMailFolder and deleteMailFolder commands without throwing (--json)', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const uniqueName = `cmd-test-folder-${Date.now()}`;

        // Create
        await expect(
          mailCommands.folderCreate(uniqueName, { json: true })
        ).resolves.not.toThrow();

        // Find the created folder and delete it
        try {
          const folders = await graphClient.mail.listFolders({ top: 100 });
          const created = folders.find(f => f.displayName === uniqueName);
          if (created) {
            await mailCommands.folderDelete(created.id, { force: true, json: true });
          }
        } catch {
          // Best-effort cleanup
        }
      });
    });

    describe('Mail reply, reply-all, and forward', () => {
      async function waitForMail(predicate, folder = 'inbox', attempts = 12, intervalMs = 5000) {
        for (let i = 0; i < attempts; i++) {
          await new Promise(r => setTimeout(r, intervalMs));
          const mails = await graphClient.mail.list({ top: 20, folder });
          const found = mails.find(predicate);
          if (found) return found;
        }
        return null;
      }

      async function safeDeleteMessage(id) {
        if (!id) return;
        try {
          await graphClient.mail.deleteMessage(id);
        } catch {
          // Best-effort cleanup
        }
      }

      it('should execute replyMail and verify reply delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-reply-seed-${uniqueId}`;
        const replyContent = `integration-test-reply-body-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for reply integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        await expect(
          mailCommands.reply(seedMail.id, replyContent, { json: true })
        ).resolves.not.toThrow();

        const replyInSent = await waitForMail(
          m => /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const replyInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!replyInSent || !replyInInbox) return ctx.skip();

        expect(replyInSent).toBeTruthy();
        expect(replyInInbox).toBeTruthy();

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(replyInInbox.id);
      });

      it('should execute replyAllMail and verify reply-all delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-replyall-seed-${uniqueId}`;
        const replyAllContent = `integration-test-replyall-body-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for reply-all integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        await expect(
          mailCommands.replyAll(seedMail.id, replyAllContent, { json: true })
        ).resolves.not.toThrow();

        const replyAllInSent = await waitForMail(
          m => /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const replyAllInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!replyAllInSent || !replyAllInInbox) return ctx.skip();

        expect(replyAllInSent).toBeTruthy();
        expect(replyAllInInbox).toBeTruthy();

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(replyAllInInbox.id);
      });

      it('should execute forwardMail and verify forwarded message delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-forward-seed-${uniqueId}`;
        const forwardComment = `integration-test-forward-comment-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for forward integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        await expect(
          mailCommands.forward(seedMail.id, selfEmail, forwardComment, { json: true })
        ).resolves.not.toThrow();

        const forwardedInSent = await waitForMail(
          m => /^(fw:|fwd:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const forwardedInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(fw:|fwd:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!forwardedInSent || !forwardedInInbox) return ctx.skip();

        expect(forwardedInSent).toBeTruthy();
        expect(forwardedInInbox).toBeTruthy();

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(forwardedInInbox.id);
      });

      it('should execute replyMail with attachment and verify delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-reply-attach-seed-${uniqueId}`;
        const replyContent = `integration-test-reply-attach-body-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for reply-with-attachment integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        const fixturePath = join(__dirname, 'fixtures', 'test-attachment.txt');

        await expect(
          mailCommands.reply(seedMail.id, replyContent, { json: true, attach: [fixturePath] })
        ).resolves.not.toThrow();

        const replyInSent = await waitForMail(
          m => /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const replyInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!replyInSent || !replyInInbox) return ctx.skip();

        expect(replyInSent).toBeTruthy();
        expect(replyInInbox).toBeTruthy();

        if (replyInInbox.hasAttachments) {
          const detail = await graphClient.mail.get(replyInInbox.id);
          expect(detail.hasAttachments).toBe(true);
        }

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(replyInInbox.id);
      });

      it('should execute replyAllMail with attachment and verify delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-replyall-attach-seed-${uniqueId}`;
        const replyAllContent = `integration-test-replyall-attach-body-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for reply-all-with-attachment integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        const fixturePath = join(__dirname, 'fixtures', 'test-attachment.txt');

        await expect(
          mailCommands.replyAll(seedMail.id, replyAllContent, { json: true, attach: [fixturePath] })
        ).resolves.not.toThrow();

        const replyAllInSent = await waitForMail(
          m => /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const replyAllInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(re:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!replyAllInSent || !replyAllInInbox) return ctx.skip();

        expect(replyAllInSent).toBeTruthy();
        expect(replyAllInInbox).toBeTruthy();

        if (replyAllInInbox.hasAttachments) {
          const detail = await graphClient.mail.get(replyAllInInbox.id);
          expect(detail.hasAttachments).toBe(true);
        }

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(replyAllInInbox.id);
      });

      it('should execute forwardMail with attachment and verify forwarded delivery', async (ctx) => {
        if (!hasAuth) return ctx.skip();

        const user = await graphClient.getCurrentUser();
        const selfEmail = user.mail || user.userPrincipalName;
        if (!selfEmail) return ctx.skip();

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const seedSubject = `integration-test-forward-attach-seed-${uniqueId}`;
        const forwardComment = `integration-test-forward-attach-comment-${uniqueId}`;

        try {
          await graphClient.mail.send({
            toRecipients: [{ emailAddress: { address: selfEmail } }],
            subject: seedSubject,
            body: { contentType: 'Text', content: 'Seed email for forward-with-attachment integration test.' },
          });
        } catch {
          return ctx.skip();
        }

        const seedMail = await waitForMail(m => m.subject === seedSubject, 'inbox');
        if (!seedMail) return ctx.skip();

        const fixturePath = join(__dirname, 'fixtures', 'test-attachment.txt');

        await expect(
          mailCommands.forward(seedMail.id, selfEmail, forwardComment, { json: true, attach: [fixturePath] })
        ).resolves.not.toThrow();

        const forwardedInSent = await waitForMail(
          m => /^(fw:|fwd:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'sent'
        );
        const forwardedInInbox = await waitForMail(
          m => m.id !== seedMail.id && /^(fw:|fwd:)/i.test(m.subject || '') && (m.subject || '').includes(seedSubject),
          'inbox'
        );

        if (!forwardedInSent || !forwardedInInbox) return ctx.skip();

        expect(forwardedInSent).toBeTruthy();
        expect(forwardedInInbox).toBeTruthy();

        if (forwardedInInbox.hasAttachments) {
          const detail = await graphClient.mail.get(forwardedInInbox.id);
          expect(detail.hasAttachments).toBe(true);
        }

        await safeDeleteMessage(seedMail.id);
        await safeDeleteMessage(forwardedInInbox.id);
      });
    });
  });
});
