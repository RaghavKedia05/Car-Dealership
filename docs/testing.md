# Testing and verification

## Commands

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd audit --audit-level=high
```

`tests/api-endpoints.test.js` and `tests/ai-car-finder.test.js` use isolated SQLite databases. `tests/postgres.test.js` runs core API scenarios on PostgreSQL through PGlite, an embedded PostgreSQL engine. Coverage is reported by Node's experimental built-in coverage option.

## Latest recorded verification

Coverage is a measurement, not a claim that every route or branch is tested. There are no frontend unit or browser end-to-end tests. PGlite verifies PostgreSQL schema and core query behavior but is not a live Neon connection test; production connection, TLS, pool limits, and provider configuration must be checked after credentials are configured. Docker image validation runs in CI; local Docker availability varies by environment.

The API suite covers registration/password hashing, login and role checks, input validation, filters, sorting/pagination, migrations, purchases and stock limits, restock, historical-delete protection, and persistence. The AI finder suite covers query parsing, hard filters, alternatives, comparisons, authentication, inventory-backed recommendations, and provider fallback.
