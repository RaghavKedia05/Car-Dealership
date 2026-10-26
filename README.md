# Apex Auto

A responsive dealership website with a public storefront, customer showroom, and administrator workspace. The Stitch-inspired interface uses live inventory from the existing Express API and supports SQLite locally or managed PostgreSQL such as Neon.

## Features

- Public landing page, featured vehicles, and guest enquiries.
- Customer registration, sign-in, live inventory, AI Car Finder, and vehicle comparison.
- Admin dashboard, inventory management, and enquiry processing.
- Role-checked API, input validation, password hashing, and persistent database storage.
- Keyboard-accessible navigation and responsive desktop/mobile layouts.

## Run locally

Requires Node.js 22.13 or later.

```powershell
npm.cmd install
$env:JWT_SECRET = "use-a-unique-secret-of-at-least-32-characters"
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies API and health requests to Express on port 3001. The database is created at `data\dealership.db`; migrations run automatically. No demo inventory is seeded.

To create the first administrator, set credentials and run:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm.cmd run seed:admin
```

## Pages and API

`/` is the public landing page; `/login` handles customer and admin sign-in. Customers land in `/showroom`; admins land in `/admin/dashboard` and can manage stock at `/admin/inventory`. `/contact` accepts public enquiries.

The API is served at `/api`; `/healthz` reports readiness. See [API documentation](docs/api.md) and [OpenAPI schema](docs/openapi.yaml) for endpoint details.

## Connect Neon PostgreSQL

The app uses SQLite locally unless `DATABASE_URL` is set. In Neon, create a project and copy the pooled connection string from the project's **Connect** dialog. Use the pooled endpoint (the hostname includes `-pooler`) for the hosted API, and keep the connection string private because it contains the database password.

To import an existing local SQLite database, first stop the app and back up `data\dealership.db`. From PowerShell, set the Neon connection string and run:

```powershell
$env:DATABASE_URL = Read-Host "Paste the Neon PostgreSQL connection string"
npm.cmd run db:import:postgres
```

The importer initializes the PostgreSQL schema and refuses to copy into non-empty target tables. To import a different SQLite file, set `SQLITE_SOURCE_PATH` before running it. Verify the copied users, vehicles, purchases, and enquiries in Neon SQL Editor before switching production.

For deployment, set `DATABASE_URL` and `JWT_SECRET` on the **Express API host**, plus `CORS_ORIGINS` for the exact website origin. Set Vercel's build-time `VITE_API_BASE_URL` to the API's HTTPS origin and redeploy. Never put `DATABASE_URL` in a `VITE_` variable or browser code. The DB pool defaults to 5 connections; tune `DATABASE_POOL_MAX` within your Neon plan's limits.

## Verify

```powershell
npm.cmd test
npm.cmd run build
```

Tests cover authentication and roles, vehicle listings and filters, admin operations, enquiries, purchases and stock limits, database migrations, AI finder/comparison, and CORS preflight behavior. See [testing notes](docs/testing.md).

## Deploy

### Deploy the frontend to Vercel

Vercel serves the Vite frontend. Run the Express API as a separate Node service and use PostgreSQL for production data. The root `vercel.json` rewrites frontend routes to `index.html`, so direct visits and refreshes on routes such as `/login` work.

1. Push the project to GitHub, including `package-lock.json`. Do not commit `.env` or production credentials.
2. Create a PostgreSQL project in Neon. In the project's **Connect** dialog, select the database, branch, and role, then copy the pooled connection string (the hostname includes `-pooler`). Keep this credential private.
3. In Render, create a **Web Service** from the repository. Leave the root directory blank when `package.json` is at the repository root. Set the build command to `npm ci --omit=dev`, the start command to `npm start`, and the health check path to `/healthz`.
4. Add these environment variables to the Render service:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `22.22.0` (or another Node 22 version at least 22.13) |
   | `DATABASE_URL` | Neon pooled PostgreSQL connection string |
   | `DATABASE_POOL_MAX` | `5` (adjust to fit the database connection limit) |
   | `JWT_SECRET` | Unique random secret with at least 32 bytes |
   | `AI_PROVIDER` | `deterministic` |

   Let Render provide `PORT`. Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. The API runs database migrations at startup. After deploying, verify `https://YOUR-API.onrender.com/healthz` responds successfully and note the API origin.
5. In Vercel, import the same GitHub repository. Use the repository root, select the **Vite** framework preset, set the build command to `npm run build`, the output directory to `dist`, and the install command to `npm ci`. Use Node.js 22.x.
6. In Vercel project environment variables, set `VITE_API_BASE_URL` to the API's HTTPS origin, for example `https://YOUR-API.onrender.com` (do not append `/api`). Enable it for Production and any Preview environment you intend to use, then deploy.
7. Copy the Vercel production origin, such as `https://YOUR-PROJECT.vercel.app`, into Render's `CORS_ORIGINS`. It must be an exact origin with no path or trailing slash. Separate multiple origins with commas. Save and redeploy the API.
8. Create the first administrator against the same production database by running `npm run seed:admin` locally with `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` set in the shell. Use a unique password of at least 12 characters. The seed command creates the account or grants admin access to an existing account with that email.
9. Verify the production site by refreshing `/login`, registering and signing in as a customer, signing in as the administrator, adding a vehicle, and submitting a contact enquiry.

`VITE_API_BASE_URL` is embedded into the frontend at build time, so redeploy Vercel after changing it. `DATABASE_URL`, `JWT_SECRET`, and other secrets belong only on the API host; never expose them through `VITE_` variables. Vercel preview deployments use different origins, so add their exact origins to `CORS_ORIGINS` only if those previews need API access.

### Run locally or deploy as one service

For local/single-host deployment, Docker Compose serves the frontend and API together and persists SQLite in a named volume:

```powershell
Copy-Item .env.example .env
# Set a unique JWT_SECRET in .env
docker compose up --build -d
```

More detailed deployment and security notes: [Dockerfile](Dockerfile), [Compose config](compose.yaml), and [security notes](docs/security.md).
