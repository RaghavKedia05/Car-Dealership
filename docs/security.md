# Security notes

## Implemented controls

- Passwords are hashed with bcryptjs at cost 12; plaintext passwords are not persisted.
- Registration normalizes email and cannot assign an administrator role.
- JWT access tokens are signed with the configured secret, include a subject, and expire after eight hours. Production startup requires a secret of at least 32 bytes.
- Protected API routes re-read the user role from the database; hiding administrator controls in the UI is not the authorization boundary.
- Helmet security headers and a 32 KB JSON body limit are enabled.
- Login and registration share a per-process rate limiter.
- SQL values are bound as parameters. Dynamic sort columns are selected only from a server-side allowlist.
- Production Docker runs as the non-root `node` user, with a read-only root filesystem and dropped Linux capabilities in Compose.
- Error responses avoid returning database stack traces.

## Operational requirements

- Set a unique, random `JWT_SECRET` in the deployment environment; do not commit `.env`.
- Serve production traffic through HTTPS. Configure `TRUST_PROXY_HOPS` only to the exact number of controlled proxies, not arbitrary client-provided forwarded headers.
- Back up the persistent SQLite volume. The supported deployment is one application instance; SQLite and the in-memory rate limiter are not shared across replicas.
- Rotate the JWT secret deliberately: existing tokens become invalid.

## Known risks and follow-up work

- The browser stores the bearer token in `localStorage`, which is readable by same-origin JavaScript. This project has a restrictive Helmet CSP, but any XSS can still steal the token. A production deployment should consider short-lived access tokens with a secure `HttpOnly`, `Secure`, `SameSite` cookie and appropriate CSRF protection, or another reviewed session design.
- The auth rate limiter uses in-memory counters and is not distributed; apply equivalent limits at a trusted edge if scaling.
- CORS is not enabled because the current frontend and API are same-origin. If deployed on separate origins, configure a strict allowlist before enabling cross-origin access.
- SQLite stores money as `REAL`; use integer cents or a fixed-precision database type before treating this as a financial system.
- No external dependency scanning report, penetration test, managed-secret integration, or live deployment is claimed by this document.
