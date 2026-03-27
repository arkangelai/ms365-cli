# Security Policy

## Supported Versions

This project is maintained on the default branch and the latest published npm release.

Security fixes are applied on a best-effort basis. If you rely on this CLI in production or agent workflows, keep the package updated and review release notes before upgrading.

## Reporting a Vulnerability

Do not open a public GitHub issue for a suspected vulnerability.

Instead:

1. Use GitHub private vulnerability reporting for this repository if it is enabled.
2. If private reporting is not available, contact the repository maintainers privately and include:
   - a short description of the issue
   - impact and affected commands or files
   - reproduction steps or proof of concept
   - any suggested mitigation

Please avoid including live tokens, refresh tokens, credential files, or other secrets in your report.

## Scope

Reports are especially useful for issues involving:

- token or credential handling
- auth flow weaknesses
- scope escalation bugs
- secret leakage in logs, errors, or test fixtures
- unsafe file permissions
- command injection or path traversal

## Response Expectations

The maintainers will triage reports as time allows, validate impact, prepare a fix, and disclose the issue responsibly once users have a reasonable path to update.
