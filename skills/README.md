# M365 CLI — AI Agent Skills

This folder contains **skill files** that teach AI coding agents how to use the `m365-cli` tool. Skills provide structured context — commands, conventions, and patterns — so agents can operate the CLI correctly without guessing.

## What Are Skills?

Skills are markdown-based instruction sets designed for AI coding agents. Instead of the agent reading through source code or generic documentation, a skill gives it exactly what it needs: command syntax, flags, defaults, common workflows, and gotchas.

**Compatible agents and platforms:**

| Platform | How to Use |
|----------|------------|
| [OpenCode](https://github.com/opencode-ai/opencode) | Place in `~/.config/opencode/skills/outlook/` or load the `.skill` package |
| [Claude Code](https://docs.anthropic.com/en/docs/build-with-claude/code) | Add to project context or CLAUDE.md references |
| [Codex](https://openai.com/index/codex/) | Include in system prompt or project knowledge |
| [OpenClaw](https://openclaw.ai) | Load as agent skill |
| Other agents | Include `SKILL.md` content in the agent's context window |

## Included Skills

### Outlook (`SKILL.md`)

Manages a personal Microsoft account (Outlook.com / Hotmail / Live) via the `m365` CLI:

- **Mail** — List, read, send, search, attachments, trusted senders
- **Calendar** — List, create, update, delete events
- **OneDrive** — List, upload, download, search, share files
- **User Search** — Find contacts and people

## File Structure

```
skills/
├── README.md              # This file
├── SKILL.md               # Main skill — quick reference with key conventions
└── references/
    └── commands.md        # Full command reference (every flag, argument, default)
```

- **`SKILL.md`** — Concise workflow reference. This is what the agent loads first. Covers authentication, common commands, patterns, and conventions.
- **`references/commands.md`** — Exhaustive command reference. The agent consults this for detailed flag options, edge cases, and advanced features.

## Quick Start

1. Install the CLI: `npm install -g m365-cli`
2. Authenticate: `m365 login --account-type personal`
3. Load the skill into your agent platform (see table above)
4. Ask your agent to manage your email, calendar, or files

## Example Agent Interactions

Once the skill is loaded, you can ask your agent things like:

- *"Check my inbox for unread emails"*
- *"Send an email to alice@example.com about tomorrow's meeting"*
- *"What's on my calendar this week?"*
- *"Upload report.pdf to my OneDrive Documents folder"*
- *"Search my emails for anything about the project update"*
