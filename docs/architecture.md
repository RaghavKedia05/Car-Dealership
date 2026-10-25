# Architecture

## Technology decision

This repository is an established Node.js/Express, React/Vite, and SQLite application. It remains a JavaScript modular monolith rather than being rewritten to FastAPI/PostgreSQL: the existing code, database, deployment image, and repository history are built around this stack, and a full rewrite would risk losing verified behavior. SQLite is appropriate for this single-instance assignment deployment; use a client/server database before scaling to multiple application instances.

## Runtime structure

```text
Browser
  └── React SPA built by Vite
       └── same-origin /api requests
            └── Express API (JWT auth, validation, authorization)
                 └── SQLite database file (persistent Docker volume)
```

- `src/main.jsx` contains the current React application and API interaction.
- `src/styles.css` holds the responsive visual system.
- `backend/app.js` creates the Express app and registers API routes/middleware.
- `backend/server.js` validates runtime configuration and starts the HTTP server.
- `backend/database.js` opens SQLite and applies versioned SQL migrations.
- `backend/migrations/` contains the initial schema and purchase-record migrations.
- `tests/api.test.js` tests HTTP behavior against isolated in-memory or temporary SQLite databases.

The Docker image builds static frontend assets, then serves them and the API from one non-root Node.js process. Compose stores the SQLite file in a named volume.

## Data model

```text
users 1 ─── * purchases * ─── 1 vehicles
```

- `users`: account identity, bcrypt password hash, and `user`/`admin` role.
- `vehicles`: catalog identity, numeric price, and non-negative quantity.
- `purchases`: user and vehicle references, purchased quantity, unit-price snapshot, total, and timestamp.

Foreign keys preserve purchase history. A vehicle with a purchase record cannot be deleted; administrators must retain it in the catalog or use a future archival workflow.

## Inventory invariants

Purchasing runs inside a SQLite `BEGIN IMMEDIATE` transaction. The handler reads the vehicle price, conditionally decrements stock only when quantity is positive, and creates the purchase snapshot before committing. On missing/out-of-stock inventory it rolls back; errors are rethrown after rollback. SQLite serializes writers, preventing two requests from purchasing the final unit.

Restock and purchase quantities are constrained both in request validation and SQL. The database schema is upgraded in order using SQLite's `user_version`; each migration and version update are committed atomically.

## Trade-offs and limitations

- SQLite uses `REAL` for vehicle and purchase amounts; it is adequate for the current sample app but does not provide the fixed-precision guarantees expected of a production financial ledger. A production conversion should store integer minor units or use PostgreSQL `NUMERIC`.
- The API currently supports single-unit purchases and records a transaction, but does not expose purchase-history endpoints or refunds.
- Authentication state is held in browser `localStorage`; see [security.md](./security.md) for its XSS trade-off.
- Frontend source is JavaScript/JSX, not TypeScript; no frontend unit/E2E test framework is configured.
- Filtering and sorting are database-backed. The current `LIKE` search is sufficient for the assignment's small catalog, not full-text search at large scale.
