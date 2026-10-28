# Architecture

## Technology decision

This is a Node.js/Express and React/Vite application. SQLite remains the zero-configuration local and single-host option; setting `DATABASE_URL` selects PostgreSQL for a managed deployment such as Neon. The API uses the same routes and validation with either database.

## Runtime structure

```text
Browser
  └── React SPA built by Vite
       └── same-origin /api requests
            └── Express API (JWT auth, validation, authorization)
                 └── SQLite file or PostgreSQL service (selected by DATABASE_URL)
```

- `src/main.jsx` mounts React and loads the shared stylesheet.
- `src/App.jsx` owns application routing, session state, and the inventory workspace.
- `src/features/` groups page and feature components by business area; `src/components/` contains shared UI.
- `src/lib/` contains API, session, formatting, and vehicle category helpers; `src/hooks/` contains shared React hooks.
- `src/styles/dealership.css` holds the responsive Apex Auto visual system.
- `backend/app.js` creates the Express app and registers API routes/middleware.
- `backend/server.js` validates runtime configuration and starts the HTTP server.
- `backend/services/` contains AI finder and order reservation logic.
- `backend/database/database-adapters.js` provides the SQLite and PostgreSQL query adapters and schema setup.
- `backend/database/migrations/sqlite/` and `postgres/` contain ordered migrations; `backend/database/postgres-schema.sql` is the PostgreSQL baseline.
- `tests/api-endpoints.test.js` covers API behavior on isolated SQLite databases; `tests/postgres-integration.test.js` checks PostgreSQL behavior using embedded PostgreSQL.

See the [project map](project-structure.md) for task-based navigation.

The Docker image builds static frontend assets, then serves them and the API from one non-root Node.js process. Compose stores SQLite in a named volume. For a managed database, set `DATABASE_URL` on the API host.

## Data model

```text
users 1 ─── * checkout_orders * ─── 1 vehicles
users 1 ─── * purchases * ─── 1 vehicles
```

- `users`: account identity, bcrypt password hash, and `user`/`admin` role.
- `vehicles`: catalog identity, INR price, non-negative quantity, and nullable structured specifications.
- `purchases`: user and vehicle references, purchased quantity, INR unit-price snapshot, total, and timestamp.
- `checkout_orders`: buyer and delivery details, server-priced order request, selected payment arrangement, temporary stock reservation, and status.

Foreign keys preserve purchase and checkout history. A vehicle referenced by either record cannot be deleted; administrators can unlist it instead.

## Inventory invariants

Checkout reserves one unit inside a database transaction when the customer submits an order request. The reservation expires after 24 hours or is released when cancelled. The site does not process online payments: dealership staff confirm receipt of offline payment in the admin dashboard, which creates the purchase record. PostgreSQL transactions and SQLite's `BEGIN IMMEDIATE` protect against reserving the final unit twice.

Restock, reservation, and purchase quantities are constrained in request validation and SQL. SQLite upgrades use `user_version`; PostgreSQL schema setup tracks its version in `app_schema_migrations`. The SQLite-to-PostgreSQL importer copies current users, inventory, purchases, enquiries, and revoked tokens into an empty PostgreSQL database.

## Trade-offs and limitations

- Vehicle and purchase amounts use floating-point storage in both schemas; this is not a fixed-precision financial ledger. Use PostgreSQL `NUMERIC` or integer minor units before handling production financial accounting.
- The API records single-unit dealership orders and does not charge cards, UPI, or other online payment methods. Integrate a payment provider before accepting online payment.
- Authentication state is held in browser `localStorage`; see [security.md](./security.md) for its XSS trade-off.
- Frontend source is JavaScript/JSX, not TypeScript; no frontend unit/E2E test framework is configured.
- Filtering and sorting are database-backed. The current `LIKE` search is sufficient for the assignment's small catalog, not full-text search at large scale.
