# Testing and verification

## Commands

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd audit --audit-level=high
```

`tests/api.test.js` uses Node's built-in test runner and Supertest with isolated SQLite databases. Coverage is reported by Node's experimental built-in coverage option; the report includes runtime startup code that is only partly exercised by API tests.

## Latest recorded verification

Results from the current implementation session:

- `npm.cmd run test:coverage`: 34 passed, 0 failed, 0 skipped; 84.45% lines, 76.95% branches, 90.24% functions overall.
- Backend coverage: `app.js` 95.71% lines, 87.96% branches, 87.88% functions; `database.js` 84.00% lines, 66.67% branches, 100% functions.
- `npm.cmd run build`: passed.
- `npm.cmd audit --audit-level=high`: 0 vulnerabilities.

Coverage is a measurement, not a claim that every route or branch is tested. In particular, frontend unit tests, browser end-to-end tests, actual PostgreSQL tests, and production deployment verification are not configured or claimed. Docker is not installed in the local environment, so the image was not rebuilt locally. GitHub Actions is configured to run tests, audit, frontend build, Docker build/scan, container smoke/stress tests, and image publishing on pushes to `main`; check the repository Actions page for the current run status.

The API suite covers registration/password hashing, login and role checks, input validation, filters, sorting/pagination, persistent schema migrations, USD-to-INR conversion of inventory and purchase snapshots, purchase snapshots, no-oversell behavior, restock, historical-delete protection, and file-backed persistence. The AI finder suite covers query parsing and exclusions, hard filters, alternatives, grounded comparisons, authentication, inventory-backed recommendations, and provider fallback.
