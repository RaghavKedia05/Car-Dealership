# Testing and verification

## Commands

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd audit --audit-level=high
```

All database tests use PostgreSQL. Locally, PGlite runs an isolated embedded PostgreSQL database per test. In CI, `TEST_DATABASE_URL` selects a real PostgreSQL service; each test gets a separate schema, which is dropped on cleanup. Set this variable only to a disposable test database with schema creation permissions. Registration fixtures capture verification emails in memory and complete the real OTP verification endpoint. `tests/postgres-migrations.test.js` covers initialization, upgrades, idempotency, version rejection, and rollback. Coverage is reported by Node's experimental built-in coverage option.

## Latest recorded verification

Coverage is a measurement, not a claim that every route or branch is tested. There are no frontend unit or browser end-to-end tests. PGlite verifies PostgreSQL schema and core query behavior but is not a live Neon connection test; production connection, TLS, pool limits, and provider configuration must be checked after credentials are configured. Docker image validation runs in CI; local Docker availability varies by environment.

The API suite covers registration/password hashing, login and role checks, input validation, filters, sorting/pagination, migrations, purchases and stock limits, restock, historical-delete protection, and persistence. The AI finder suite covers query parsing, hard filters, alternatives, comparisons, authentication, inventory-backed recommendations, and provider fallback.
