# Apex Auto

A responsive dealership website with a public storefront, customer showroom, and administrator workspace. The Stitch-inspired interface uses live inventory from the existing Express API and supports SQLite locally or managed PostgreSQL such as Neon.

## Features

- Public landing page, featured vehicles, and guest enquiries.
- Customer registration, sign-in, live inventory, AI Car Finder, and vehicle comparison.
- Customer account dashboard with saved contact and delivery details, purchase history, and password recovery.
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

Email verification is required to create customer accounts. Set `RESEND_API_KEY` and `PASSWORD_RESET_FROM` in the API environment using a verified sender domain before registering locally or in production. `APP_ORIGIN` is also required for password reset links.

To create the first administrator, set credentials and run:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm.cmd run seed:admin
```

## Pages and API

`/` is the public landing page; `/login` is the single sign-in page for both customer and administrator accounts. The app routes accounts by their assigned role after sign-in: customers land in `/showroom`, admins land in `/admin/dashboard`. New customer accounts must verify their email with a one-time code before they can sign in. `/contact` accepts public enquiries.

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
   | `TRUST_PROXY_HOPS` | `1` for Render's reverse proxy |
   | `AI_PROVIDER` | `deterministic` |
   | `RAZORPAY_KEY_ID` | Razorpay API key ID (use Test Mode keys first) |
   | `RAZORPAY_KEY_SECRET` | Matching Razorpay API key secret |
   | `RAZORPAY_WEBHOOK_SECRET` | A strong secret you choose and also enter in the Razorpay webhook settings |
   | `RESEND_API_KEY` | Resend API key for registration verification and account recovery emails |
   | `PASSWORD_RESET_FROM` | Verified sender, for example `Apex Auto <accounts@your-domain.com>` |
   | `APP_ORIGIN` | Exact HTTPS Vercel origin, for example `https://YOUR-PROJECT.vercel.app` |

   Let Render provide `PORT`. Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. The API runs database migrations at startup. After deploying, verify `https://YOUR-API.onrender.com/healthz` responds successfully and note the API origin.
5. In Vercel, import the same GitHub repository. Use the repository root, select the **Vite** framework preset, set the build command to `npm run build`, the output directory to `dist`, and the install command to `npm ci`. Use Node.js 22.x.
6. In Vercel project environment variables, set `VITE_API_BASE_URL` to the API's HTTPS origin, for example `https://YOUR-API.onrender.com` (do not append `/api`). Enable it for Production and any Preview environment you intend to use, then deploy.
7. Copy the Vercel production origin, such as `https://YOUR-PROJECT.vercel.app`, into Render's `CORS_ORIGINS`. It must be an exact origin with no path or trailing slash. Separate multiple origins with commas. Save and redeploy the API.
8. In the Razorpay Dashboard, start in Test Mode and enable automatic payment capture. Add a webhook pointing to `https://YOUR-API.onrender.com/api/payments/razorpay/webhook`, subscribe to `payment.captured` and `payment.failed`, and set the same webhook secret as `RAZORPAY_WEBHOOK_SECRET` in Render. Use test keys to complete a test checkout before switching to live keys.
9. To create the first administrator without a shell, add `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` to the Render service's Environment settings. Use an email that has not already registered; if it exists, the API promotes it and keeps its current password. The API creates or promotes the account when it starts. Redeploy the API, confirm the account can sign in at `/login`, then remove `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from Render and redeploy again. The `npm run seed:admin` command remains available for local use.
10. Verify the production site by refreshing `/login`, registering a customer and confirming the emailed code is required before sign-in, completing a test payment, confirming stock changes only after capture, signing in to the same page with the administrator account, adding a vehicle, and submitting a contact enquiry.

Before customer registration verification or password recovery can send email, verify a sending domain in Resend and set the email variables on the **Render API service**. `PASSWORD_RESET_FROM` must use a sender on that verified domain, and `APP_ORIGIN` must be the exact Vercel production origin (scheme and hostname only) for password reset links. Save and redeploy Render after setting them. Registration codes expire after 10 minutes and can be resent after one minute. Password reset links expire after 30 minutes and can only be used once. Signed-in customers can update their name, phone, and delivery address, review paid and pending orders, and change their password from `/account`.

`VITE_API_BASE_URL` is embedded into the frontend at build time, so redeploy Vercel after changing it. `DATABASE_URL`, `JWT_SECRET`, and other secrets belong only on the API host; never expose them through `VITE_` variables. Vercel preview deployments use different origins, so add their exact origins to `CORS_ORIGINS` only if those previews need API access.

Checkout uses Razorpay Standard Checkout. The API creates each order using the current server-side price, reserves one unit for 15 minutes, verifies the payment signature and captured amount, and records the purchase only after confirmation. Failed, dismissed, or expired reservations release stock. Keep Razorpay credentials server-side; the key secret and webhook secret must never be added to Vercel or frontend variables.

### Run locally or deploy as one service

For local/single-host deployment, Docker Compose serves the frontend and API together and persists SQLite in a named volume:

```powershell
Copy-Item .env.example .env
# Set a unique JWT_SECRET in .env
docker compose up --build -d
```

More detailed deployment and security notes: [Dockerfile](Dockerfile), [Compose config](compose.yaml), and [security notes](docs/security.md).
