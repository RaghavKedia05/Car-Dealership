# Project map

Start with the root [README](../README.md) to run Apex Auto. All npm commands run from the repository root; the frontend and API share one package manifest and lockfile.

## Directory layout

```text
Car_Dealership/
  src/                         React frontend
    main.jsx                   Browser entry point and global CSS import
    App.jsx                    Routing, session state, inventory workspace
    components/                Shared header and error notification
    features/
      account/                 Customer profile and order history
      admin/                   Operations dashboard and dashboard widgets
      ai-car-finder/           Search, recommendations, and comparison
      auth/                    Sign-in, registration, password recovery/reset
      checkout/                Vehicle order request dialog
      inventory/               Vehicle cards and inventory editor
      public/                  Landing, vehicle details, and contact pages
    hooks/                     Shared dialog accessibility hook
    lib/                       API, session, currency, and category helpers
    styles/                    Global responsive stylesheet
  backend/                     Express API (CommonJS)
    server.js                  Configuration, startup, cleanup, shutdown
    app.js                     Routes, authentication, validation, middleware
    seed-admin.js              Admin provisioning helper and CLI
    services/                  AI finder and order reservation logic
    database/
      database-adapters.js     SQLite/PostgreSQL adapters and migration runner
      postgres-schema.sql      PostgreSQL baseline schema
      migrations/
        sqlite/                Ordered SQLite upgrades
        postgres/              Ordered PostgreSQL upgrades
  tests/                       Node test runner API and database suites
  scripts/                     Database import and HTTP load-test utilities
  docs/                        Project documentation
    images/                    Recorded application screenshots
    history/                   Historical development prompts
  design/                      Design reference material; not runtime code
    references/                HTML mockups, screenshots, brand guidelines
    archives/                  Original frontend export ZIP
  .github/workflows/           CI, image validation, and container publishing
  data/                        Generated local SQLite database (gitignored)
  dist/                        Generated frontend build (gitignored)
  node_modules/                Installed dependencies (gitignored)
```

## Where to make a change

| Task | Start here |
| --- | --- |
| Add a page or change navigation | [App.jsx](../src/App.jsx), then the matching `src/features/` folder |
| Change the landing page | [PublicLanding.jsx](../src/features/public/PublicLanding.jsx) |
| Change registration or sign-in UI | [AuthForm.jsx](../src/features/auth/AuthForm.jsx) |
| Change customer details/order history | [CustomerDashboard.jsx](../src/features/account/CustomerDashboard.jsx) |
| Change admin reporting/order actions | [AdminDashboard.jsx](../src/features/admin/AdminDashboard.jsx) |
| Change vehicle editing | [VehicleEditor.jsx](../src/features/inventory/VehicleEditor.jsx) |
| Change checkout | [VehicleCheckout.jsx](../src/features/checkout/VehicleCheckout.jsx), [reservation service](../backend/services/order-reservations.js), and API routes |
| Change AI recommendations | [AICarFinder.jsx](../src/features/ai-car-finder/AICarFinder.jsx) and [AI service](../backend/services/ai-car-finder.js) |
| Change layout, colors, or responsive behavior | [dealership.css](../src/styles/dealership.css) |
| Change request handling or authorization | [backend/app.js](../backend/app.js), [API reference](api.md), and [OpenAPI](openapi.yaml) |
| Change persistence/schema | [database-adapters.js](../backend/database/database-adapters.js) and the database-specific migration folders |
| Import SQLite into PostgreSQL | [migrate-sqlite-to-postgres.js](../scripts/migrate-sqlite-to-postgres.js), via `npm run db:import:postgres` |
| Run HTTP load checks | [http-load-check.js](../scripts/http-load-check.js), via `npm run stress` |
| Change build/deployment | Root `vite.config.js`, `Dockerfile`, `compose.yaml`, `vercel.json`, and `.github/workflows/ci-cd.yml` |

## Request flow

`index.html` loads `src/main.jsx`, which renders `App`. App coordinates the current URL, authentication state, and feature components. Shared request parsing and error reporting live in `src/lib/api-client.js`.

During development, Vite forwards `/api` and `/healthz` to `backend/server.js`. The server creates the database adapter and Express application. `backend/app.js` handles routes and delegates AI and reservation work to services. In the combined production deployment, Express also serves `dist/`; a separate frontend deployment uses `VITE_API_BASE_URL`.

## Conventions and boundaries

- React components use PascalCase filenames matching their exported component. Related small private widgets may stay beside their parent in the same file.
- Backend services and utilities use descriptive kebab-case filenames. Runtime entry points retain the conventional `app.js` and `server.js` names.
- SQL migration numbers and filenames remain unchanged. SQLite and PostgreSQL have separate histories; the PostgreSQL baseline is version 1.
- Root configuration filenames remain conventional so npm, Vite, Docker, Vercel, and GitHub Actions can discover them.
- `data/` is runtime state, not source. `dist/` and `node_modules/` are generated. Do not edit these to change the application.
- `design/` and `docs/history/` are reference material. Their historical instructions and examples do not describe the current implementation.

## Previous locations

| Previous path | Current location |
| --- | --- |
| `src/dealership-app.jsx` | `src/main.jsx`, `src/App.jsx`, feature components, hooks, and helpers |
| `src/dealership-ui.css` | `src/styles/dealership.css` |
| `backend/database.js` | `backend/database/database-adapters.js` |
| `backend/migrations/` | `backend/database/migrations/sqlite/` |
| `backend/postgres-migrations/` | `backend/database/migrations/postgres/` |
| `backend/postgres-schema.sql` | `backend/database/postgres-schema.sql` |
| `backend/ai-car-finder.js`, `backend/order-reservations.js` | `backend/services/` |
| `scripts/load.js` | `scripts/http-load-check.js` |
| `screenshots/` | `docs/images/` |
| `PROMPTS.md` | `docs/history/prompts.md` |
| `stitch_dealership_inventory_system3/` | `design/references/`, grouped by screen |
| `landing_page_frontend.zip` | `design/archives/landing-page-frontend.zip` |
