# M365 CLI

Modern command-line interface for Microsoft 365 — supports both **work/school accounts** and **personal Microsoft accounts** (Outlook.com, Hotmail, Live). Manage Mail, Calendar, OneDrive, and SharePoint from the terminal.

## Who is this for?

This CLI is primarily designed for **AI agents** (e.g., [OpenClaw](https://openclaw.ai), and similar agent frameworks) to interact with Microsoft 365 on behalf of users — reading emails, managing calendars, and handling files through natural language workflows.

That said, it works perfectly as a standalone CLI tool for power users who prefer managing M365 from the terminal.

**Agent use cases:**
- Let your AI assistant read, summarize, and reply to emails
- Automate calendar management through agent workflows
- Enable agents to upload/download files on OneDrive
- Integrate M365 data into multi-step agent pipelines

**Human use cases:**
- Quick email triage from the terminal
- Script-friendly JSON output for automation
- Lightweight M365 access without a heavy GUI

## Features

- 📧 **Mail**: List, read, send, search emails (with attachments)
- 📅 **Calendar**: Manage events (list, create, update, delete)
- 📁 **OneDrive**: File management (upload, download, search, share)
- 🌐 **SharePoint**: Site and document management (work accounts only)
- 👤 **Personal accounts**: Outlook.com / Hotmail / Live mail, calendar, and OneDrive
- 🔐 **Secure**: OAuth 2.0 Device Code Flow authentication
- 🚀 **Fast**: Minimal dependencies, uses native Node.js fetch
- 🤖 **AI-friendly**: Clean text output + JSON option

## Installation

```bash
npm install -g m365-cli
```

If you prefer to install from source:
```bash
git clone <repo>
cd m365-cli
npm install
npm link
```

After linking, the `m365` command will be available globally.

## Quick Start

### 1. Login

```bash
# Work or school account (default)
m365 login

# Personal Microsoft account (Outlook.com, Hotmail, Live)
m365 login --account-type personal
```

Follow the prompts to authenticate using Device Code Flow.

### 2. List Emails

```bash
m365 mail list --top 5
```

### 3. View Calendar

```bash
m365 calendar list --days 7
```

### 4. Browse OneDrive

```bash
m365 onedrive ls
```

## Security Notes

- Credentials are currently stored in a local JSON file with restrictive permissions.
- The current hardening sets the credentials directory to `700` and the credentials file to `600`.
- This is acceptable for local development, but it is not the end state for a production-grade CLI.
- The next security milestone is migrating token storage to OS-backed secure storage:
  - macOS Keychain
  - Windows Credential Manager
  - libsecret/keyring on Linux
- If you need mutating operations after the least-privilege defaults, request the extra scopes explicitly with `m365 login --add-scopes ...`.

## Commands Reference

### Authentication

```bash
m365 login [options]           # Login with Device Code Flow
  --account-type <type>        # Account type: 'work' (default) or 'personal'
  --scopes <scopes>            # Comma-separated scopes to request (overrides defaults)
  --add-scopes <scopes>        # Comma-separated scopes to add to defaults
  --exclude <scopes>           # Comma-separated scopes to exclude from defaults
m365 logout                    # Clear stored credentials
```

> **Personal accounts** support Mail, Calendar, OneDrive, and User commands. SharePoint requires a work/school account.

### Mail Commands

```bash
# List emails
m365 mail list [options]
  --top <n>                         # Number of emails (default: 10)
  --folder <name>                   # Folder to list (default: inbox)
  --json                            # Output as JSON
  --focused                         # Show only Focused Inbox emails

# Supported folders:
#   inbox       - Inbox (default)
#   sent        - Sent Items
#   drafts      - Drafts
#   deleted     - Deleted Items
#   junk        - Junk Email
#   Or use a folder ID directly

# Read email
m365 mail read <id> [options]
  --force                           # Skip whitelist check
  --json                            # Output as JSON

# Send email
m365 mail send <to> <subject> <body> [options]
  --attach <file1> <file2> ...      # Attach files
  --cc <emails>                       # CC recipients (comma-separated)
  --bcc <emails>                      # BCC recipients (comma-separated)
  --json                            # Output as JSON

# Search emails
m365 mail search <query> [options]
  --top <n>                         # Number of results (default: 10)
  --json                            # Output as JSON

# Manage trusted senders whitelist
m365 mail trust <email>             # Add to whitelist
m365 mail untrust <email>           # Remove from whitelist
m365 mail trusted [options]         # List whitelist
  --json                            # Output as JSON

# List attachments
m365 mail attachments <id> [options]
  --json                            # Output as JSON

# Download attachment
m365 mail download-attachment <message-id> <attachment-id> [local-path] [options]
  --json                            # Output as JSON

# Delete email
m365 mail delete <id> [options]
  --force                           # Skip confirmation prompt
  --json                            # Output as JSON

# Move email to another folder
m365 mail move <id> <destination> [options]
  --json                            # Output as JSON
# Destination: folder name (inbox, sent, drafts, deleted, junk, archive) or folder ID
# Note: Moving a message creates a new copy — the returned ID is the new message ID

# Reply to email
m365 mail reply <id> <content> [options]
  --html                            # Treat content as HTML
  -a, --attach <files...>           # Attach files to the reply
  --json                            # Output as JSON

# Reply to all recipients
m365 mail reply-all <id> <content> [options]
  --html                            # Treat content as HTML
  -a, --attach <files...>           # Attach files to the reply
  --json                            # Output as JSON

# Forward email
m365 mail forward <id> <to> [comment] [options]
  --html                            # Treat comment as HTML
  -a, --attach <files...>           # Attach files to the forwarded message
  --json                            # Output as JSON
# To: comma-separated recipient emails

# Mail folder management
m365 mail folder list [options]
  --top <n>                         # Maximum folders (default: 50)
  --parent <folder>                 # List child folders of this folder
  --json                            # Output as JSON

m365 mail folder create <name> [options]
  --parent <folder>                 # Create as child of this folder
  --json                            # Output as JSON

m365 mail folder delete <id> [options]
  --force                           # Skip confirmation prompt
  --json                            # Output as JSON
```

**Examples:**
```bash
m365 mail list --top 5
m365 mail list --folder sent --top 10    # List sent emails
m365 mail list --folder drafts           # List draft emails
m365 mail read AAMkADA5ZDE2Njk2...
m365 mail read AAMkADA5ZDE2Njk2... --force   # Skip whitelist check
m365 mail send "user@example.com" "Meeting" "Let's meet tomorrow" --attach report.pdf
m365 mail search "project update" --top 20

# Whitelist management
m365 mail trusted                        # List trusted senders
m365 mail trust user@example.com         # Trust specific sender
m365 mail trust @example.com             # Trust entire domain
m365 mail untrust user@example.com       # Remove from whitelist

# Attachment examples
m365 mail attachments AAMkADA5ZDE2Njk2...      # List all attachments in an email
m365 mail download-attachment AAMkADA5... AAMkAGQ...   # Download using attachment's original filename
m365 mail download-attachment AAMkADA5... AAMkAGQ... ~/Downloads/file.pdf  # Specify output path

# Delete and move emails
m365 mail delete AAMkADA5ZDE2Njk2... --force
m365 mail move AAMkADA5ZDE2Njk2... archive
m365 mail move AAMkADA5ZDE2Njk2... drafts

# Reply and forward emails
m365 mail reply AAMkADA5ZDE2Njk2... "Thanks for the update"
m365 mail reply-all AAMkADA5ZDE2Njk2... "Thanks everyone"
m365 mail reply AAMkADA5ZDE2Njk2... "<p>Thanks</p>" --html
m365 mail forward AAMkADA5ZDE2Njk2... "alice@example.com,bob@example.com" "FYI"
m365 mail forward AAMkADA5ZDE2Njk2... "alice@example.com" "<p>Please review</p>" --html
m365 mail reply AAMkADA5ZDE2Njk2... "Thanks" --attach report.pdf
m365 mail reply-all AAMkADA5ZDE2Njk2... "See attached" --attach notes.pdf slides.pptx
m365 mail forward AAMkADA5ZDE2Njk2... "alice@example.com" "FYI" --attach report.pdf

# Folder management
m365 mail folder list
m365 mail folder list --parent inbox
m365 mail folder create "My Projects"
m365 mail folder create "Subfolder" --parent inbox
m365 mail folder delete AAMkAGQ... --force
```

### Security: Trusted Senders Whitelist

The CLI includes a **phishing protection feature** that filters email content from untrusted senders.

**How it works:**
- When reading emails with `m365 mail read`, the sender is checked against a whitelist
- If the sender is not trusted, only metadata (sender, subject, date) is shown
- Email body is replaced with: `[Content filtered - sender not in trusted senders list]`
- Use `--force` to bypass the check when needed

1. `~/.m365-cli/trusted-senders.txt`

**Whitelist format:**
```
# Trust specific email addresses
user@example.com
other@example.com
user@example.com

# Trust entire domains (prefix with @)
@example.com
@microsoft.com
```

**Management commands:**
```bash
m365 mail trusted                # View current whitelist
m365 mail trust user@example.com # Add to whitelist
m365 mail trust @example.com     # Trust entire domain
m365 mail untrust user@example.com  # Remove from whitelist
```

**Special handling:**
- Internal organization emails (Exchange DN format) are automatically trusted
- Marked emails in lists show a ⚠️ warning indicator for untrusted senders

### Calendar Commands

```bash
# List events
m365 calendar list [options]
m365 cal list [options]             # Alias
  --days <n>                        # Look ahead N days (default: 7)
  --top <n>                         # Maximum events (default: 50)
  --json                            # Output as JSON

# Get event details
m365 calendar get <id> [options]
  --json                            # Output as JSON

# Create event
m365 calendar create <title> [options]
  --start <datetime>                # Start time (required)
  --end <datetime>                  # End time (required)
  --location <location>             # Event location
  --body <description>              # Event description
  --attendees <email1,email2>       # Attendee emails (comma-separated)
  --allday                          # All-day event
  --json                            # Output as JSON

# Update event
m365 calendar update <id> [options]
  --title <title>                   # New title
  --start <datetime>                # New start time
  --end <datetime>                  # New end time
  --location <location>             # New location
  --body <description>              # New description
  --json                            # Output as JSON

# Delete event
m365 calendar delete <id> [options]
  --json                            # Output as JSON
```

**Datetime formats:**
- Full datetime: `2026-02-17T14:00:00`
- Date only (for all-day events): `2026-02-17`

**Examples:**
```bash
m365 cal list --days 5
m365 cal get AAMkADA5ZDE2Njk2...
m365 cal create "Team Meeting" --start "2026-02-17T14:00:00" --end "2026-02-17T15:00:00" --location "Room A"
m365 cal create "Holiday" --start "2026-02-20" --end "2026-02-21" --allday
m365 cal update AAMkADA5... --location "Room B"
m365 cal delete AAMkADA5...
```

### OneDrive Commands

```bash
# List files
m365 onedrive ls [path] [options]
m365 od ls [path] [options]         # Alias
  --top <n>                         # Maximum items (default: 100)
  --json                            # Output as JSON

# Get file/folder metadata
m365 onedrive get <path> [options]
  --json                            # Output as JSON

# Download file
m365 onedrive download <remote-path> [local-path] [options]
  --json                            # Output as JSON

# Upload file
m365 onedrive upload <local-path> [remote-path] [options]
  --json                            # Output as JSON

# Search files
m365 onedrive search <query> [options]
  --top <n>                         # Maximum results (default: 50)
  --json                            # Output as JSON

# Create sharing link
m365 onedrive share <path> [options]
  --type <view|edit>                # Link type (default: view)
  --scope <organization|anonymous|users>  # Sharing scope (default: anonymous)
  --json                            # Output as JSON

# Create folder
m365 onedrive mkdir <path> [options]
  --json                            # Output as JSON

# Invite user to share file/folder
m365 onedrive invite <path> <email> [options]
  --role <read|write>               # Permission level (default: read)
  --message <msg>                   # Invitation message
  --no-notify                       # Do not send email notification
  --json                            # Output as JSON

# Delete file/folder
m365 onedrive rm <path> [options]
  --force                           # Skip confirmation
  --json                            # Output as JSON
```

**Examples:**
```bash
m365 od ls
m365 od ls Documents
m365 od get "Documents/report.pdf"
m365 od download "Documents/report.pdf" ~/Downloads/
m365 od upload ~/Desktop/photo.jpg "Photos/vacation.jpg"
m365 od search "budget" --top 20
m365 od share "Documents/report.pdf" --type edit
m365 od mkdir "Projects/New Project"
m365 od rm "old-file.txt" --force
```

**Features:**
- 🚀 Large file upload support (automatic chunking for files ≥4MB)
- 📊 Progress display for downloads and uploads
- 💾 Human-readable file sizes (B/KB/MB/GB/TB)
- ⚠️ Confirmation prompt before deletion (unless `--force`)

### SharePoint Commands

```bash
# List sites
m365 sharepoint sites [options]
m365 sp sites [options]             # Alias
  --search <query>                  # Search for sites
  --top <n>                         # Maximum sites (default: 50)
  --json                            # Output as JSON

# List site lists
m365 sharepoint lists <site> [options]
  --top <n>                         # Maximum lists (default: 100)
  --json                            # Output as JSON

# List list items
m365 sharepoint items <site> <list> [options]
  --top <n>                         # Maximum items (default: 100)
  --json                            # Output as JSON

# List files in document library
m365 sharepoint files <site> [path] [options]
  --top <n>                         # Maximum files (default: 100)
  --json                            # Output as JSON

# Download file
m365 sharepoint download <site> <file-path> [local-path] [options]
  --json                            # Output as JSON

# Upload file
m365 sharepoint upload <site> <local-path> [remote-path] [options]
  --json                            # Output as JSON

# Search content
m365 sharepoint search <query> [options]
  --top <n>                         # Maximum results (default: 50)
  --json                            # Output as JSON
```

**Site identifier formats:**

SharePoint commands accept sites in multiple formats:

1. **Path format** (recommended):
   ```
   hostname:/sites/sitename
   # Example: contoso.sharepoint.com:/sites/team
   ```

2. **Site ID format** (from `m365 sp sites` output):
   ```
   hostname,siteId,webId
   # Example: contoso.sharepoint.com,8bfb5166-...,ea772c4f-...
   ```

3. **URL format** (for some commands):
   ```
   https://hostname/sites/sitename
   # Example: https://contoso.sharepoint.com/sites/team
   ```

**Tip:** Run `m365 sp sites --json` to get the exact site ID for any site.

**Examples:**
```bash
m365 sp sites
m365 sp sites --search "marketing"

# Using path format (recommended)
m365 sp lists "contoso.sharepoint.com:/sites/team"

# Using site ID from sites list output
m365 sp lists "contoso.sharepoint.com,8bfb5166-7dff-4f15-8d44-3417d68f519a,ea772c4f-..."

m365 sp files "contoso.sharepoint.com:/sites/team" "Documents"
m365 sp download "contoso.sharepoint.com:/sites/team" "Documents/file.pdf"
m365 sp upload "contoso.sharepoint.com:/sites/team" ~/report.pdf "Documents/report.pdf"
m365 sp search "quarterly report" --top 20
```

**Note:** SharePoint requires the `Sites.ReadWrite.All` permission, which is **not** included in the default login scopes because it requires tenant administrator approval (admin consent). To use SharePoint commands, re-login with the additional scope: `m365 login --add-scopes Sites.ReadWrite.All`. You must have admin consent for this permission in your tenant.

### User Commands

```bash
# Search for users
m365 user search <name> [options]
  --top <n>                         # Maximum results per source (default: 10)
  --json                            # Output as JSON
```

**Examples:**
```bash
m365 user search "John"
m365 user search "John" --top 5 --json
```

## Configuration

### Credentials Location

Credentials are stored at: `~/.m365-cli/credentials.json`

**Security:** File permissions are set to `600` (owner read/write only). Do not share this file.

### Timezone

Calendar events use a timezone for scheduling. The CLI detects the timezone automatically using the following fallback chain:

1. **`M365_TIMEZONE` environment variable** — Set this to override all other detection. Accepts both IANA (e.g., `Asia/Shanghai`) and Windows (e.g., `China Standard Time`) timezone names.
2. **Graph API mailbox settings** — Reads the timezone configured in your Microsoft 365 mailbox settings (`/me/mailboxSettings`). Requires the `MailboxSettings.Read` permission.
3. **System timezone** — Falls back to the operating system's timezone via the `Intl` API.
4. **UTC** — Final fallback if none of the above are available.

To explicitly set a timezone:

```bash
export M365_TIMEZONE="Asia/Shanghai"
```

Or in `config/default.json`:

```json
{
  "timezone": "Asia/Shanghai"
}
```

The detected timezone is cached for the duration of each CLI invocation, so the Graph API is called at most once per command.
### Azure AD Application

#### Option 1: Use Existing Application (Quick Start)

This tool comes pre-configured with a shared Azure AD application:
- **Tenant ID**: `5b4c4b46-4279-4f19-9e5d-84ea285f9b9c`
- **Client ID**: `091b3d7b-e217-4410-868c-01c3ee6189b6`

No additional setup required — just run `m365 login` and you're ready to go.

#### Option 2: Create Your Own Azure AD Application

For production use or organizational requirements, you can register your own Azure AD application.

##### Prerequisites

- Access to **Azure Portal** or **Azure CLI**
- Azure AD / Microsoft Entra ID tenant
- **Permissions**: Global Administrator or Application Administrator role

##### Method 1: Azure Portal (Recommended for First-Time Setup)

**Step 1: Create the Application**

1. Sign in to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Microsoft Entra ID** > **App registrations** > **New registration**
3. Configure the application:
   - **Name**: `M365 CLI` (or your preferred name)
   - **Supported account types**: Select **"Accounts in this organizational directory only (Single tenant)"**
   - **Redirect URI**: Leave empty (not needed for Device Code Flow)
4. Click **Register**

**Step 2: Enable Public Client Flow**

1. In your app's page, go to **Authentication** (left sidebar)
2. Scroll down to **Advanced settings** > **Allow public client flows**
3. Set **"Enable the following mobile and desktop flows"** to **Yes**
4. Click **Save** at the top

> ⚠️ **Important**: This setting is required for Device Code Flow authentication.

**Step 3: Configure API Permissions**

1. Go to **API permissions** (left sidebar)
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**
3. Add the following permissions:
   - `Mail.ReadWrite` - Read and write mail
   - `Mail.Send` - Send mail as the user
   - `Calendars.ReadWrite` - Read and write calendar events
   - `MailboxSettings.Read` - Read user mailbox settings (used for timezone detection)
   - `Files.ReadWrite` - Read and write files in OneDrive
   - `Sites.ReadWrite.All` - Read and write SharePoint sites (**requires admin consent**; not included in default login — use `--add-scopes` to add)
   - `User.Read` - Sign in and read user profile (added by default)
   - `User.ReadBasic.All` - Read basic profiles of other users
   - `Contacts.Read` - Read user contacts
4. Click **Add permissions**
5. Click **Grant admin consent for [Your Organization]** (admin approval required)
6. Confirm by clicking **Yes**

> 💡 **Tip**: Admin consent allows all users in your organization to use the app without individual approval.

**Configure the CLI**

```bash
export M365_TENANT_ID="your-tenant-id"
export M365_CLIENT_ID="your-client-id"
```

Add these to your `~/.bashrc` or `~/.zshrc` to make them permanent.

##### Method 2: Azure CLI (One-Command Setup)

If you have [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed:

```bash
# Login to Azure
az login

# Create the application
APP_ID=$(az ad app create \
  --display-name "M365 CLI" \
  --sign-in-audience AzureADMyOrg \
  --enable-access-token-issuance true \
  --query appId -o tsv)

echo "Created app with ID: $APP_ID"

# Enable public client flow
az ad app update --id $APP_ID --is-fallback-public-client true

# Add Microsoft Graph permissions
# Permission IDs for Microsoft Graph (00000003-0000-0000-c000-000000000000):
#   User.Read: e1fe6dd8-ba31-4d61-89e7-88639da4683d
#   Mail.ReadWrite: e2a3a72e-5f79-4c64-b1b1-878b674786c9
#   Mail.Send: e383f46e-2787-4529-855e-0e479a3ffac0
#   Calendars.ReadWrite: 1ec239c2-d7c9-4623-a91a-a9775856bb36
#   MailboxSettings.Read: 87f447af-9fa4-4c32-9dfa-4a57a73d18ce
#   Files.ReadWrite: 5c28f0bf-8a70-41f1-8ab2-9032436ddb65
#   Sites.ReadWrite.All: 89fe6a52-be36-487e-b7d8-d061c450a026
#   User.ReadBasic.All: b340eb25-3456-403f-be2f-af7a0d370277
#   Contacts.Read: ff74d97f-43af-4b68-9f2a-b77ee6968c5d

az ad app permission add --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
    e2a3a72e-5f79-4c64-b1b1-878b674786c9=Scope \
    e383f46e-2787-4529-855e-0e479a3ffac0=Scope \
    1ec239c2-d7c9-4623-a91a-a9775856bb36=Scope \
    87f447af-9fa4-4c32-9dfa-4a57a73d18ce=Scope \
    5c28f0bf-8a70-41f1-8ab2-9032436ddb65=Scope \
    b340eb25-3456-403f-be2f-af7a0d370277=Scope \
    ff74d97f-43af-4b68-9f2a-b77ee6968c5d=Scope \
    89fe6a52-be36-487e-b7d8-d061c450a026=Scope

# Grant admin consent
az ad app permission admin-consent --id $APP_ID

# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

# Display configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Azure AD Application Created Successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tenant ID:  $TENANT_ID"
echo "Client ID:  $APP_ID"
echo ""
echo "Configure the CLI with:"
echo "export M365_TENANT_ID=\"$TENANT_ID\""
echo "export M365_CLIENT_ID=\"$APP_ID\""
```

Copy the output values and configure them as shown in Step 5 above.

##### Verification

After configuration, test the setup:

```bash
# Login with your custom app
m365 login

# Test basic functionality
m365 mail list --top 3
```

You should see the Device Code Flow prompt. Follow the authentication steps in your browser.

### Permissions

The application requests the following Microsoft Graph permissions at login:
- `Mail.ReadWrite` - Read and write mail
- `Mail.Send` - Send mail
- `Calendars.ReadWrite` - Read and write calendar events
- `MailboxSettings.Read` - Read user mailbox settings (timezone auto-detection)
- `Files.ReadWrite` - Read and write files in OneDrive
- `User.Read` - Sign in and read user profile
- `User.ReadBasic.All` - Read basic profiles of other users
- `Contacts.Read` - Read user contacts
- `offline_access` - Maintain access with refresh tokens (enables persistent login)

> **Note:** `Sites.ReadWrite.All` requires tenant administrator approval (admin consent). It is not included in the default login scopes to avoid authentication failures for users whose tenant admin has not yet approved this permission. To use SharePoint commands, re-login with the scope added:
>
> ```bash
> m365 login --add-scopes Sites.ReadWrite.All
> ```
## Output Formats

### Default (Text)

Clean, human-readable output with emoji icons:

```
📧 Mail List (top 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] 📩 Meeting Reminder
    From: alice@example.com
    Date: 2026-02-16 09:30
    ID: AAMkAG...
```

### JSON (--json)

Structured output for scripting and AI consumption:

```json
[
  {
    "id": "AAMkAG...",
    "subject": "Meeting Reminder",
    "from": {
      "emailAddress": {
        "name": "Alice",
        "address": "alice@example.com"
      }
    },
    "receivedDateTime": "2026-02-16T09:30:00Z",
    "isRead": false
  }
]
```

## Project Structure

```
m365-cli/
├── bin/
│   └── m365.js              # CLI entry point
├── src/
│   ├── auth/                # Authentication
│   │   ├── token-manager.js # Token storage & refresh
│   │   └── device-flow.js   # Device Code Flow
│   ├── graph/               # Graph API client
│   │   └── client.js        # HTTP client with auto-refresh
│   ├── commands/            # Command implementations
│   │   ├── mail.js          # Mail commands
│   │   ├── calendar.js      # Calendar commands
│   │   ├── onedrive.js      # OneDrive commands
│   │   ├── sharepoint.js    # SharePoint commands
│   │   └── user.js          # User commands
│   └── utils/               # Utilities
│       ├── config.js        # Config management
│       ├── output.js        # Output formatting
│       ├── error.js         # Error handling
│       └── trusted-senders.js  # Trusted senders whitelist
├── config/
│   └── default.json         # Default configuration
├── skills/                 # AI agent skill files
│   ├── SKILL.md            # Outlook skill (quick reference)
│   └── references/
│       └── commands.md     # Full command reference
├── package.json             # Project metadata
├── README.md                # This file
```

## AI Agent Skills

The `skills/` folder contains instruction sets that teach AI coding agents how to use this CLI. Skills provide structured context — commands, conventions, and common patterns — so agents can operate the CLI correctly.

Compatible with [OpenCode](https://github.com/opencode-ai/opencode), [Claude Code](https://docs.anthropic.com/en/docs/build-with-claude/code), [Codex](https://openai.com/index/codex/), [OpenClaw](https://openclaw.ai), and other agent frameworks.

See [`skills/README.md`](skills/README.md) for setup instructions.

## Development

### Tech Stack

- **Node.js 18+** - ESM modules, native fetch API
- **commander.js** - CLI framework
- **Microsoft Graph API** - M365 services

### Local Testing

```bash
# Link for local development
npm link

# Test commands
m365 --help
m365 mail --help
m365 mail list --top 3
```

## Troubleshooting

### "Not authenticated" error

Run `m365 login` to authenticate.

### Token expired

Tokens refresh automatically. If refresh fails, run `m365 login` again.

### Permission denied (SharePoint)

SharePoint requires the `Sites.ReadWrite.All` permission, which is **not** included in the default login scopes because it requires **tenant administrator approval** (admin consent). If you encounter a permission error:

1. Re-login with the required scope:
   ```bash
   m365 login --add-scopes Sites.ReadWrite.All
   ```
2. If that fails, ensure your tenant admin has granted admin consent for `Sites.ReadWrite.All` on the Azure AD app registration.
3. You can also login with a complete custom scope list:
   ```bash
   m365 login --scopes User.Read,Files.ReadWrite,Sites.ReadWrite.All,offline_access
   ```

### Network errors

- Check internet connection
- Verify firewall settings
- Ensure Microsoft Graph API is accessible

## Security

- Explicit scope management — SharePoint permissions (`Sites.ReadWrite.All`) added via `--add-scopes` when needed, since they require tenant admin approval
- Credentials stored with `600` permissions
- OAuth 2.0 Device Code Flow
- Automatic token refresh
- No sensitive data in logs
- HTTPS-only communication

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please open an issue or PR.

---

**Current Version**: 0.1.0  
**Updated**: 2026-03-15
