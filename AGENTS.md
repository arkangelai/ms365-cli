# AGENTS.md

## Purpose

MS365 CLI is a command-line interface for Microsoft 365 covering mail, calendar, OneDrive, and SharePoint workflows, with explicit support for AI-agent-driven use cases.

## Stack

- Node.js
- JavaScript
- Commander
- Vitest
- npm

## Important Paths

- `bin/`: CLI entrypoints
- `src/`: command and integration logic
- `config/`: configuration files
- `tests/`: unit and integration tests
- `docs/`: supporting documentation

## Common Commands

- `npm install`
- `npm test`
- `npm run test:run`
- `npm run test:unit`
- `npm run test:integration`

## Agent Notes

- Keep CLI behavior script-friendly and stable.
- Prefer additive command changes over breaking flag or output changes.
- Be careful with auth and token handling; do not log secrets.
