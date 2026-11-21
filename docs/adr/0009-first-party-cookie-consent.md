# ADR-0009: Server-set first-party cookie and consent gating in the SDK

- Status: Accepted
- Date: 2026-11-20
- Tags: privacy, gdpr, consent, cookies, pii

## Context

Safari ITP caps JS-set cookies at 7 days, which cuts long journeys. The project runs in the EU: ePrivacy and GDPR require consent for non-essential cookies.

## Decision

The `attribution_key` comes from an HttpOnly cookie set by the collector served on the site's own domain (`/t/*` via reverse proxy). The SDK only sends events after consent. IPs are truncated before storage. No personal data beyond an opaque `user_id` after `Identified`.

## Alternatives considered

- JS-set cookie: 7-day cap.
- Subdomain CNAMEd to another cloud: also hits the ITP restriction.

## Consequences

Test apps need a consent banner. Retention is defined in M5.
