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

- `npm.cmd test`: 20 passed, 0 failed, 0 skipped.
- `npm.cmd run test:coverage`: 20 passed; 86.96% lines, 76.60% branches, 83.87% functions overall.
- Backend-only coverage: `app.js` 94.26% lines, 82.28% branches, 88.89% functions; `database.js` 83.33% lines, 66.67% branches, 100% functions.
- `npm.cmd run build`: passed.
- `npm.cmd audit --audit-level=high`: 0 vulnerabilities.

Coverage is a measurement, not a claim that every route or branch is tested. In particular, frontend unit tests, browser end-to-end tests, actual PostgreSQL tests, and production deployment verification are not configured or claimed. Docker is not installed in the current environment, so the image was not rebuilt locally; the GitHub Actions workflow was not rerun for these uncommitted changes.

The API suite covers registration/password hashing, login and role checks, input validation, filters, sorting/pagination, persistent schema migrations, purchase snapshots, no-oversell behavior, restock, historical-delete protection, and file-backed persistence.
