# Contributing

Thanks for contributing to `m365-cli`.

## Before You Start

- Open an issue or discussion for significant changes before investing in a large PR.
- Keep PRs focused. Separate refactors from behavioral changes.
- Do not commit real credentials, access tokens, refresh tokens, or local credential files.

## Development Setup

```bash
npm install
npm run test:unit
```

To use the CLI locally:

```bash
npm link
m365 --help
```

## Testing

Run the smallest useful test scope first:

```bash
npm run test:unit
```

Integration tests require your own Microsoft 365 test credentials. Start from [.env.integration.example](./.env.integration.example) and use dedicated test tenants or accounts rather than your daily-use credentials.

```bash
npm run test:integration
```

## Pull Requests

- Describe the user-visible behavior change clearly.
- Add or update tests when behavior changes.
- Update the README when flags, auth behavior, or command semantics change.
- Preserve least-privilege defaults for scopes.
- Avoid logging or exposing token material in code, tests, or screenshots.

## Security-Sensitive Changes

Take extra care with changes in:

- `src/auth/`
- `src/utils/security.js`
- `src/utils/trusted-senders.js`
- GitHub Actions workflows

If your change affects auth, token storage, refresh semantics, scope handling, or secret redaction, call that out explicitly in the PR description.

## Style

- Prefer small, readable functions over abstraction-heavy changes.
- Match the existing CLI behavior and output style unless the PR intentionally changes UX.
- Keep documentation accurate to the current implementation.
