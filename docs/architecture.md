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

- `src/dealership-app.jsx` contains the React application and API interaction.
- `src/dealership-ui.css` holds the responsive Apex Auto visual system.
- `backend/app.js` creates the Express app and registers API routes/middleware.
- `backend/server.js` validates runtime configuration and starts the HTTP server.
- `backend/database.js` provides the SQLite and PostgreSQL query adapters and schema setup.
- `backend/migrations/` contains ordered SQLite migrations; `backend/postgres-schema.sql` defines the current PostgreSQL schema.
- `tests/api-endpoints.test.js` covers API behavior on isolated SQLite databases; `tests/postgres.test.js` checks PostgreSQL behavior using embedded PostgreSQL.

The Docker image builds static frontend assets, then serves them and the API from one non-root Node.js process. Compose stores SQLite in a named volume. For a managed database, set `DATABASE_URL` on the API host.

## Data model

```text
users 1 ─── * checkout_orders * ─── 1 vehicles
users 1 ─── * purchases * ─── 1 vehicles
```

- `users`: account identity, bcrypt password hash, and `user`/`admin` role.
- `vehicles`: catalog identity, INR price, non-negative quantity, and nullable structured specifications.
- `purchases`: user and vehicle references, purchased quantity, INR unit-price snapshot, total, and timestamp.
- `checkout_orders`: buyer and delivery details, server-priced Razorpay order, temporary stock reservation, and payment state.

Foreign keys preserve purchase and checkout history. A vehicle referenced by either record cannot be deleted; administrators can unlist it instead.

## Inventory invariants

Checkout reserves one unit inside a database transaction before creating a Razorpay order. The reservation expires after 15 minutes or is released when checkout is cancelled or payment fails. A purchase record is created only after the server verifies the Razorpay signature and confirms the captured amount and currency. PostgreSQL row locking and SQLite's `BEGIN IMMEDIATE` protect against reserving the final unit twice.

Restock, reservation, and purchase quantities are constrained in request validation and SQL. SQLite upgrades use `user_version`; PostgreSQL schema setup tracks its version in `app_schema_migrations`. The SQLite-to-PostgreSQL importer copies current users, inventory, purchases, enquiries, and revoked tokens into an empty PostgreSQL database.

## Trade-offs and limitations

- Vehicle and purchase amounts use floating-point storage in both schemas; this is not a fixed-precision financial ledger. Use PostgreSQL `NUMERIC` or integer minor units before handling production financial accounting.
- The API supports single-unit online purchases through Razorpay; customer purchase-history endpoints are not exposed.
- Authentication state is held in browser `localStorage`; see [security.md](./security.md) for its XSS trade-off.
- Frontend source is JavaScript/JSX, not TypeScript; no frontend unit/E2E test framework is configured.
- Filtering and sorting are database-backed. The current `LIKE` search is sufficient for the assignment's small catalog, not full-text search at large scale.
