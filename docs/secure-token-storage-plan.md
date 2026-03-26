# Secure Token Storage Plan

## Goal

Replace plaintext local token storage with OS-backed secure storage while preserving the current CLI UX.

## Current State

- Credentials are stored at `~/.m365-cli/credentials.json`
- Directory permissions are restricted to `700`
- File permissions are restricted to `600`
- Refresh lock files are created with restrictive permissions
- This is hardened enough for local development, but not the desired long-term model

## Target State

- Access tokens and refresh tokens are stored in OS-backed secure storage
- Non-secret metadata can remain in a local config file if needed
- Account switching remains explicit and isolated
- Logout fully clears both secure storage entries and local metadata

## Platform Targets

### macOS

- Use Keychain
- Store secrets under a stable service name such as `ms365-cli`
- Key accounts by tenant/account identifier

### Windows

- Use Credential Manager
- Keep the same account-keying model as macOS

### Linux

- Use libsecret / Secret Service
- Fallback behavior must be explicit if a secret service is unavailable

## Implementation Outline

1. Introduce a storage interface
- `loadCreds()`
- `saveCreds()`
- `deleteCreds()`
- `listAccounts()` if multi-account support expands later

2. Split secret vs non-secret state
- Secret:
  - access token
  - refresh token
- Non-secret:
  - account type
  - granted scopes
  - expiry timestamp
  - client/tenant metadata

3. Add provider implementations
- `keychain` provider for macOS
- `credential-manager` provider for Windows
- `libsecret` provider for Linux
- optional `file` provider only as explicit fallback for unsupported systems

4. Add migration path
- detect existing `credentials.json`
- migrate secrets into secure storage on successful login or explicit migration command
- remove or reduce plaintext fields after successful migration

5. Update logout semantics
- clear secure storage entry
- remove local metadata
- clean stale lock files

6. Add tests
- provider contract tests
- migration tests from file storage
- logout/removal tests
- multi-account isolation tests

## Acceptance Criteria

- No tokens stored plaintext by default on supported platforms
- Existing users can migrate without rearchitecting commands
- Login, refresh, and logout flows still pass automated tests
- Errors do not leak secret material

## Open Questions

- Which Node package is the best-maintained cross-platform secret store for this repo?
- Should unsupported Linux environments fail closed, or allow an explicit insecure fallback?
- Do we want account aliases before implementing secure multi-account storage?
