# Security Policy

## Supported Versions

Orchard is self-hosted software. Security fixes are released against the latest
version only. Operators are expected to update to the most recent
[release](https://github.com/cashubtc/orchard/releases).

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report security issues send an email to **support@orchard.space**.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept
- The Orchard version and, where relevant, the backend configuration
  (lnd/cln, cdk/nutshell, tapd, reverse proxy, etc.)

You will receive an acknowledgement as soon as possible. Please give us a
reasonable window to ship a fix and let operators update before disclosing
publicly.

## Scope

Orchard is a management interface that talks to Bitcoin, Lightning, Cashu mint,
and Taproot Assets backends. Vulnerabilities in those upstream projects should
be reported to their respective maintainers.