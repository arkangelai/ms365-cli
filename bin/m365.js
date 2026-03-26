#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { login, logout } from '../src/auth/token-manager.js';
import mailCommands from '../src/commands/mail.js';
import calendarCommands from '../src/commands/calendar.js';
import onedriveCommands from '../src/commands/onedrive.js';
import sharepointCommands from '../src/commands/sharepoint.js';
import userCommands from '../src/commands/user.js';
import { handleError } from '../src/utils/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('m365')
  .description('Microsoft 365 CLI - Manage Mail, Calendar, and OneDrive')
  .version(packageJson.version);

// Login command
program
  .command('login')
  .description('Authenticate with Microsoft 365')
  .option('--scopes <scopes>', 'Comma-separated list of scopes to request (overrides defaults)')
  .option('--exclude <scopes>', 'Comma-separated list of scopes to exclude from defaults')
  .option('--add-scopes <scopes>', 'Comma-separated list of scopes to add to defaults')
  .option('--account-type <type>', 'Account type: work (default) or personal')
  .action(async (options) => {
    try {
      await login({
        scopes: options.scopes,
        addScopes: options.addScopes,
        exclude: options.exclude,
        accountType: options.accountType,
      });
    } catch (error) {
      handleError(error);
    }
  });

// Logout command
program
  .command('logout')
  .description('Clear stored credentials')
  .action(async () => {
    try {
      await logout();
    } catch (error) {
      handleError(error);
    }
  });

// Mail commands
const mailCommand = program
  .command('mail')
  .description('Manage emails');

mailCommand
  .command('list')
  .description('List emails')
  .option('-t, --top <number>', 'Number of emails to list', '10')
  .option('-f, --folder <name>', 'Folder name (inbox, sent, drafts)', 'inbox')
  .option('--json', 'Output as JSON')
  .option('--focused', 'Show only Focused Inbox emails')
  .action(async (options) => {
    await mailCommands.list({
      top: parseInt(options.top),
      folder: options.folder,
      focused: options.focused || false,
      json: options.json,
    });
  });

mailCommand
  .command('read')
  .description('Read email by ID')
  .argument('<id>', 'Email ID')
  .option('--force', 'Skip whitelist check and show full content')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await mailCommands.read(id, {
      force: options.force,
      json: options.json,
    });
  });

mailCommand
  .command('send')
  .description('Send an email')
  .argument('<to>', 'Recipient email address(es) (comma-separated)')
  .argument('<subject>', 'Email subject')
  .argument('<body>', 'Email body (HTML supported)')
  .option('-a, --attach <files...>', 'Attach files')
  .option('--cc <emails>', 'CC recipients (comma-separated)')
  .option('--bcc <emails>', 'BCC recipients (comma-separated)')
  .option('--json', 'Output as JSON')
  .action(async (to, subject, body, options) => {
    await mailCommands.send(to, subject, body, {
      attach: options.attach || [],
      cc: options.cc,
      bcc: options.bcc,
      json: options.json,
    });
  });

mailCommand
  .command('search')
  .description('Search emails')
  .argument('<query>', 'Search query')
  .option('-t, --top <number>', 'Number of results', '10')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    await mailCommands.search(query, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

mailCommand
  .command('attachments')
  .description('List email attachments')
  .argument('<id>', 'Email ID')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await mailCommands.attachments(id, {
      json: options.json,
    });
  });

mailCommand
  .command('download-attachment')
  .description('Download email attachment')
  .argument('<message-id>', 'Email ID')
  .argument('<attachment-id>', 'Attachment ID')
  .argument('[local-path]', 'Local file path (default: attachment name)')
  .option('--force', 'Overwrite an existing local file')
  .option('--json', 'Output as JSON')
  .action(async (messageId, attachmentId, localPath, options) => {
    await mailCommands.downloadAttachment(messageId, attachmentId, localPath, {
      force: options.force,
      json: options.json,
    });
  });

mailCommand
  .command('trust')
  .description('Add email or domain to whitelist')
  .argument('<email>', 'Email address or domain (e.g., user@example.com or @example.com)')
  .option('--json', 'Output as JSON')
  .action(async (email, options) => {
    await mailCommands.trust(email, {
      json: options.json,
    });
  });

mailCommand
  .command('untrust')
  .description('Remove email or domain from whitelist')
  .argument('<email>', 'Email address or domain to remove')
  .option('--json', 'Output as JSON')
  .action(async (email, options) => {
    await mailCommands.untrust(email, {
      json: options.json,
    });
  });

mailCommand
  .command('trusted')
  .description('List trusted senders whitelist')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await mailCommands.trusted({
      json: options.json,
    });
  });

mailCommand
  .command('delete')
  .description('Delete an email (moves to Deleted Items)')
  .argument('<id>', 'Message ID to delete')
  .option('--force', 'Skip confirmation prompt')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await mailCommands.delete(id, {
      force: options.force,
      json: options.json,
    });
  });

mailCommand
  .command('move')
  .description('Move an email to a different folder')
  .argument('<id>', 'Message ID to move')
  .argument('<destination>', 'Destination folder (name or ID)')
  .option('--json', 'Output as JSON')
  .action(async (id, destination, options) => {
    await mailCommands.move(id, destination, {
      json: options.json,
    });
  });

mailCommand
  .command('reply')
  .description('Reply to an email')
  .argument('<id>', 'Message ID to reply to')
  .argument('<content>', 'Reply message content')
  .option('-a, --attach <files...>', 'Attach files to the message')
  .option('--html', 'Treat content as HTML')
  .option('--json', 'Output as JSON')
  .action(async (id, content, options) => {
    await mailCommands.reply(id, content, {
      attach: options.attach || [],
      html: options.html || false,
      json: options.json,
    });
  });

mailCommand
  .command('reply-all')
  .description('Reply to all recipients of an email')
  .argument('<id>', 'Message ID to reply to')
  .argument('<content>', 'Reply message content')
  .option('-a, --attach <files...>', 'Attach files to the message')
  .option('--html', 'Treat content as HTML')
  .option('--json', 'Output as JSON')
  .action(async (id, content, options) => {
    await mailCommands.replyAll(id, content, {
      attach: options.attach || [],
      html: options.html || false,
      json: options.json,
    });
  });

mailCommand
  .command('forward')
  .description('Forward an email')
  .argument('<id>', 'Message ID to forward')
  .argument('<to>', 'Recipient email(s), comma-separated')
  .argument('[comment]', 'Optional comment to include')
  .option('-a, --attach <files...>', 'Attach files to the message')
  .option('--html', 'Treat comment as HTML')
  .option('--json', 'Output as JSON')
  .action(async (id, to, comment, options) => {
    await mailCommands.forward(id, to, comment || '', {
      attach: options.attach || [],
      html: options.html || false,
      json: options.json,
    });
  });

// Mail folder subcommands
const mailFolderCommand = mailCommand
  .command('folder')
  .description('Manage mail folders');

mailFolderCommand
  .command('list')
  .description('List mail folders')
  .option('-t, --top <number>', 'Maximum number of folders', '50')
  .option('--parent <folder>', 'List child folders of this folder (name or ID)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await mailCommands.folderList({
      top: parseInt(options.top),
      parent: options.parent,
      json: options.json,
    });
  });

mailFolderCommand
  .command('create')
  .description('Create a new mail folder')
  .argument('<name>', 'Folder name')
  .option('--parent <folder>', 'Create as child of this folder (name or ID)')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    await mailCommands.folderCreate(name, {
      parent: options.parent,
      json: options.json,
    });
  });

mailFolderCommand
  .command('delete')
  .description('Delete a mail folder and all its contents')
  .argument('<id>', 'Folder ID to delete')
  .option('--force', 'Skip confirmation prompt')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await mailCommands.folderDelete(id, {
      force: options.force,
      json: options.json,
    });
  });

// Calendar commands
const calendarCommand = program
  .command('calendar')
  .alias('cal')
  .description('Manage calendar events');

calendarCommand
  .command('list')
  .description('List calendar events')
  .option('-d, --days <number>', 'Number of days to look ahead', '7')
  .option('-t, --top <number>', 'Maximum number of events', '50')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await calendarCommands.list({
      days: parseInt(options.days),
      top: parseInt(options.top),
      json: options.json,
    });
  });

calendarCommand
  .command('get')
  .description('Get calendar event by ID')
  .argument('<id>', 'Event ID')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await calendarCommands.get(id, {
      json: options.json,
    });
  });

calendarCommand
  .command('create')
  .description('Create calendar event')
  .argument('<title>', 'Event title')
  .requiredOption('-s, --start <datetime>', 'Start date/time (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD)')
  .requiredOption('-e, --end <datetime>', 'End date/time (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD)')
  .option('-l, --location <location>', 'Event location')
  .option('-b, --body <body>', 'Event description')
  .option('-a, --attendees <emails>', 'Attendee emails (comma-separated)', (val) => val.split(','))
  .option('--allday', 'All-day event')
  .option('--json', 'Output as JSON')
  .action(async (title, options) => {
    await calendarCommands.create(title, {
      start: options.start,
      end: options.end,
      location: options.location,
      body: options.body,
      attendees: options.attendees || [],
      allday: options.allday || false,
      json: options.json,
    });
  });

calendarCommand
  .command('update')
  .description('Update calendar event')
  .argument('<id>', 'Event ID')
  .option('-t, --title <title>', 'Event title')
  .option('-s, --start <datetime>', 'Start date/time (YYYY-MM-DDTHH:MM:SS)')
  .option('-e, --end <datetime>', 'End date/time (YYYY-MM-DDTHH:MM:SS)')
  .option('-l, --location <location>', 'Event location')
  .option('-b, --body <body>', 'Event description')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await calendarCommands.update(id, {
      title: options.title,
      start: options.start,
      end: options.end,
      location: options.location,
      body: options.body,
      json: options.json,
    });
  });

calendarCommand
  .command('delete')
  .description('Delete calendar event')
  .argument('<id>', 'Event ID')
  .option('--force', 'Skip confirmation prompt')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await calendarCommands.delete(id, {
      force: options.force,
      json: options.json,
    });
  });

// OneDrive commands
const onedriveCommand = program
  .command('onedrive')
  .alias('od')
  .description('Manage OneDrive files and folders');

onedriveCommand
  .command('ls')
  .description('List files and folders')
  .argument('[path]', 'Path to list (default: root)', '')
  .option('-t, --top <number>', 'Maximum number of items', '100')
  .option('--json', 'Output as JSON')
  .action(async (path, options) => {
    await onedriveCommands.ls(path, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

onedriveCommand
  .command('get')
  .description('Get file/folder metadata')
  .argument('<path>', 'Path to file or folder')
  .option('--json', 'Output as JSON')
  .action(async (path, options) => {
    await onedriveCommands.get(path, {
      json: options.json,
    });
  });

onedriveCommand
  .command('download')
  .description('Download file from OneDrive')
  .argument('<remote-path>', 'Remote file path')
  .argument('[local-path]', 'Local destination path (default: current directory)')
  .option('--force', 'Overwrite an existing local file')
  .option('--json', 'Output as JSON')
  .action(async (remotePath, localPath, options) => {
    await onedriveCommands.download(remotePath, localPath, {
      force: options.force,
      json: options.json,
    });
  });

onedriveCommand
  .command('upload')
  .description('Upload file to OneDrive')
  .argument('<local-path>', 'Local file path')
  .argument('[remote-path]', 'Remote destination path (default: root with same name)')
  .option('--json', 'Output as JSON')
  .action(async (localPath, remotePath, options) => {
    await onedriveCommands.upload(localPath, remotePath, {
      json: options.json,
    });
  });

onedriveCommand
  .command('search')
  .description('Search files in OneDrive')
  .argument('<query>', 'Search query')
  .option('-t, --top <number>', 'Maximum number of results', '50')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    await onedriveCommands.search(query, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

onedriveCommand
  .command('share')
  .description('Create sharing link')
  .argument('<path>', 'Path to file or folder')
  .option('--type <type>', 'Link type: view or edit', 'view')
  .option('--scope <scope>', 'Share scope: organization, anonymous, or users', 'organization')
  .option('--json', 'Output as JSON')
  .action(async (path, options) => {
    await onedriveCommands.share(path, {
      type: options.type,
      scope: options.scope,
      json: options.json,
    });
  });

onedriveCommand
  .command('invite')
  .description('Invite users to access file (external sharing)')
  .argument('<path>', 'Path to file')
  .argument('<email>', 'Email address(es), comma-separated')
  .option('--role <role>', 'Permission: read or write', 'read')
  .option('--message <msg>', 'Invitation message')
  .option('--no-notify', 'Do not send email notification')
  .option('--json', 'Output as JSON')
  .action(async (path, email, options) => {
    await onedriveCommands.invite(path, email, {
      role: options.role,
      message: options.message,
      notify: options.notify,
      json: options.json,
    });
  });

onedriveCommand
  .command('mkdir')
  .description('Create folder')
  .argument('<path>', 'Folder path')
  .option('--json', 'Output as JSON')
  .action(async (path, options) => {
    await onedriveCommands.mkdir(path, {
      json: options.json,
    });
  });

onedriveCommand
  .command('rm')
  .description('Delete file or folder')
  .argument('<path>', 'Path to file or folder')
  .option('--force', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (path, options) => {
    await onedriveCommands.rm(path, {
      force: options.force,
      json: options.json,
    });
  });

// SharePoint commands
const sharepointCommand = program
  .command('sharepoint')
  .alias('sp')
  .description('Manage SharePoint sites and content');

sharepointCommand
  .command('sites')
  .description('List accessible SharePoint sites')
  .option('--search <query>', 'Search for sites')
  .option('-t, --top <number>', 'Maximum number of sites', '50')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await sharepointCommands.sites({
      search: options.search,
      top: parseInt(options.top),
      json: options.json,
    });
  });

sharepointCommand
  .command('lists')
  .description('List site lists and document libraries')
  .argument('<site>', 'Site URL (hostname:/path) or site ID')
  .option('-t, --top <number>', 'Maximum number of lists', '100')
  .option('--json', 'Output as JSON')
  .action(async (site, options) => {
    await sharepointCommands.lists(site, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

sharepointCommand
  .command('items')
  .description('List items in a SharePoint list')
  .argument('<site>', 'Site URL (hostname:/path) or site ID')
  .argument('<list>', 'List ID')
  .option('-t, --top <number>', 'Maximum number of items', '100')
  .option('--json', 'Output as JSON')
  .action(async (site, list, options) => {
    await sharepointCommands.items(site, list, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

sharepointCommand
  .command('files')
  .description('List files in site document library')
  .argument('<site>', 'Site URL (hostname:/path) or site ID')
  .argument('[path]', 'Path in document library (default: root)', '')
  .option('-t, --top <number>', 'Maximum number of files', '100')
  .option('--json', 'Output as JSON')
  .action(async (site, path, options) => {
    await sharepointCommands.files(site, path, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

sharepointCommand
  .command('download')
  .description('Download file from SharePoint')
  .argument('<site>', 'Site URL (hostname:/path) or site ID')
  .argument('<file-path>', 'Remote file path')
  .argument('[local-path]', 'Local destination path (default: current directory)')
  .option('--force', 'Overwrite an existing local file')
  .option('--json', 'Output as JSON')
  .action(async (site, filePath, localPath, options) => {
    await sharepointCommands.download(site, filePath, localPath, {
      force: options.force,
      json: options.json,
    });
  });

sharepointCommand
  .command('upload')
  .description('Upload file to SharePoint')
  .argument('<site>', 'Site URL (hostname:/path) or site ID')
  .argument('<local-path>', 'Local file path')
  .argument('[remote-path]', 'Remote destination path (default: root with same name)')
  .option('--json', 'Output as JSON')
  .action(async (site, localPath, remotePath, options) => {
    await sharepointCommands.upload(site, localPath, remotePath, {
      json: options.json,
    });
  });

sharepointCommand
  .command('search')
  .description('Search SharePoint content')
  .argument('<query>', 'Search query')
  .option('-t, --top <number>', 'Maximum number of results', '50')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    await sharepointCommands.search(query, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

// User commands
const userCommand = program
  .command('user')
  .description('Search and resolve users');

userCommand
  .command('search')
  .description('Search users by name (organization + contacts)')
  .argument('<name>', 'Name to search for')
  .option('-t, --top <number>', 'Maximum results per source', '10')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    await userCommands.search(name, {
      top: parseInt(options.top),
      json: options.json,
    });
  });

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
