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
- The auth layer continues to expose one logical credential record to callers, even if secrets and metadata are stored separately underneath

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
- Preserve the current `token-manager` contract for callers:
  - `loadCreds()` returns the same logical shape used today by auth flows
  - `saveCreds()` accepts that same logical shape and decides where secret vs non-secret fields live
  - `deleteCreds()` clears both secure-store secrets and local metadata
  - `listAccounts()` can remain optional unless multi-account support expands
- Keep call sites such as `getAccountType()`, token refresh, and command routing unaware of provider-specific storage details

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
- document the minimum platform behavior when secure storage is unavailable so the CLI fails predictably

4. Add migration path
- detect existing `credentials.json`
- migrate on first successful authenticated read/startup, not only on a new login
- allow an explicit migration command for recovery and support workflows
- make migration idempotent so repeated reads/logins are safe
- remove or reduce plaintext fields after successful migration
- ensure existing users do not remain on plaintext storage indefinitely just because they never rerun `login`

5. Update logout semantics
- clear secure storage entry
- remove local metadata
- clean stale lock files

6. Add tests
- contract tests that verify `loadCreds()` still returns the shape current callers expect
- provider contract tests
- migration tests from file storage
- migration-on-read tests for existing users with old `credentials.json`
- logout/removal tests
- multi-account isolation tests

## Acceptance Criteria

- No tokens stored plaintext by default on supported platforms
- Existing plaintext credentials are migrated during normal authenticated use, without requiring a fresh login
- Existing users can migrate without rearchitecting commands
- Login, refresh, and logout flows still pass automated tests
- Errors do not leak secret material

## Open Questions

- Which Node package is the best-maintained cross-platform secret store for this repo?
- Should unsupported Linux environments fail closed, or allow an explicit insecure fallback?
- Do we want account aliases before implementing secure multi-account storage?
