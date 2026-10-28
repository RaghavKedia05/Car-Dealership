# Apex Auto

A full-stack car dealership web app. Customers browse the showroom, describe the car they want in plain English, compare models side by side and reserve a car online with no payment. Dealership staff manage inventory, orders and customer enquiries from an admin dashboard.

**Stack:** React 19 · Vite 7 · Node.js 22 · Express 5 · PostgreSQL · Zod · JWT · Docker · GitHub Actions

![Apex Auto home page](docs/images/home.png)

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Testing and test report](#testing-and-test-report)
- [Deployment](#deployment)
- [Security](#security)
- [Known limitations](#known-limitations)
- [My AI Usage](#my-ai-usage)
- [Documentation](#documentation)

## Features

### For customers

- **Showroom:** browse every listed car without signing in. Filter by make, model, body style and price range, sort by newest, price or name, with server-side pagination.
- **Smart car finder:** type something like *"family SUV under ₹20 lakh with 5 seats, automatic"* and get ranked matches with the reasons they fit. When nothing matches exactly, it suggests close alternatives and says what differs ("slightly over budget").
- **Compare:** pick 2–3 cars and see their specs side by side.
- **Car detail pages:** full specifications, stock status and a link to ask a question.
- **Online reservation:** reserve a car for 24 hours. Choose to pay at the dealership or request a call back. No card details are collected.
- **Account:** order history, saved contact and delivery details, password change, and forgot/reset password by email.
- **Contact form:** guests and signed-in users can send enquiries, optionally about a specific car.

### For dealership admins

- **Dashboard:** orders awaiting action, new enquiries, vehicle count, sold-out count and stock value, plus stock levels and an inventory breakdown by make and fuel.
- **Order handling:** mark an order paid (records the sale) or cancel it (returns the car to stock), with a confirmation step.
- **Inventory:** add, edit, restock and remove vehicles, or hide a listing without deleting it.
- **Enquiry inbox:** search, filter by status and update each enquiry (New → Contacted → In progress → Resolved).

### Under the hood

- Role-based access checked on the server on every request.
- Overselling prevented with an atomic database update inside a transaction.
- Request validation with Zod, bcrypt password hashing, token revocation on logout, and rate limiting.
- Responsive layout for desktop, tablet and phone, plus keyboard-accessible dialogs.

## Screenshots

| Showroom | Smart car finder |
| --- | --- |
| ![Showroom with filters](docs/images/showroom.png) | ![Car finder results](docs/images/car-finder.png) |
| **Car details** | **Admin dashboard** |
| ![Car detail page](docs/images/vehicle-details.png) | ![Admin dashboard](docs/images/admin-dashboard.png) |

<p align="center"><img src="docs/images/mobile.png" alt="Mobile home page" width="260" /></p>

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 7, lucide-react icons, plain CSS with design tokens |
| Backend | Node.js 22.13+, Express 5 |
| Database | PostgreSQL (`pg` driver, hand-written parameterised SQL, ordered migrations) |
| Validation | Zod |
| Auth | JSON Web Tokens (`jsonwebtoken`), bcryptjs |
| Security | Helmet (CSP and security headers), express-rate-limit, CORS allowlist |
| Email | Resend HTTP API (password reset links) |
| Testing | Node.js test runner, Supertest, PGlite (in-process PostgreSQL) |
| DevOps | Docker (multi-stage), Docker Compose, GitHub Actions, Trivy image scanning |
| Hosting | One container, or Vercel (frontend) + Render (API) + Neon (PostgreSQL) |

## Architecture

```text
Browser (React SPA, built by Vite)
   │  JSON over HTTPS · Authorization: Bearer <JWT>
   ▼
Express API
   helmet → CORS → 32 KB body limit → rate limiter
   → requireAuth (JWT + revocation + auth_version)
   → requireAdmin (admin routes) → Zod validation → route handler
   │  parameterised SQL, transactions
   ▼
PostgreSQL
   users · vehicles · checkout_orders · purchases · enquiries
   revoked_tokens · password_reset_tokens

Optional services: Resend (reset emails) · OpenAI-compatible LLM (car finder parsing)
```

- In production one Node process serves both the API (`/api/*`) and the built frontend (`dist/`), so everything is same-origin.
- The API is stateless (JWT), so it can run as several instances behind a load balancer.
- Reservations hold one unit for 24 hours. Expired reservations return to stock automatically (a job runs every 60 seconds).
- The smart car finder uses a built-in rule-based parser by default. An LLM can be enabled, but its output is validated against a strict schema and never becomes SQL.

More detail: [docs/architecture.md](docs/architecture.md).

## Getting started

### Prerequisites

- **Node.js 22.13 or later**
- **PostgreSQL**: a local install, the bundled Docker Compose file, or a hosted database such as [Neon](https://neon.tech)

### 1. Install

```bash
git clone https://github.com/RaghavKedia05/Car-Dealership.git
cd Car-Dealership
npm ci
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

### 2. Set up the database

**Option A, hosted (Neon):** create a project and paste its connection string into `.env` as `DATABASE_URL`.

**Option B, local with Docker:** set `POSTGRES_PASSWORD` in `.env`, then:

```bash
docker compose -f compose.postgres.yaml up -d --wait
```

and set:

```env
DATABASE_URL=postgresql://dealership:YOUR_PASSWORD@localhost:5432/dealership
```

Migrations run automatically when the API starts. To run them on their own, use `npm run db:migrate`.

### 3. Configure secrets

In `.env`, set `JWT_SECRET` to a long random string. You can generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

### 4. Create the first admin

Add these to `.env`, then run the seed script:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
ADMIN_NAME=Dealership Admin
```

```bash
npm run seed:admin
```

If the email already belongs to a customer, that account is promoted to admin and keeps its password.

### 5. Run

```bash
npm run dev
```

- Frontend: http://localhost:5173 (Vite, hot reload)
- API: http://localhost:3001 (Vite proxies `/api` and `/healthz` to it)

Sign in at `/login` with the admin account and add a few vehicles from **Inventory**. No demo data is seeded. Customers can create accounts from the sign-in page.

> On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is blocked.

## Environment variables

All variables are documented in [`.env.example`](.env.example). The API, seed and migration scripts read `.env` automatically; real environment variables take precedence.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signs access tokens; at least 32 bytes in production |
| `DATABASE_POOL_MAX` | No | Connection pool size (default 5) |
| `PORT` | No | API port (default 3001) |
| `CORS_ORIGINS` | When split-hosted | Comma-separated exact frontend origins allowed to call the API |
| `VITE_API_BASE_URL` | When split-hosted | API origin baked into the frontend build (no `/api` suffix) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First run only | Create or promote the first admin |
| `RESEND_API_KEY`, `PASSWORD_RESET_FROM`, `APP_ORIGIN` | For password reset | Email provider key, verified sender, and the frontend origin used in reset links |
| `AI_PROVIDER` | No | `deterministic` (default) or `openai-compatible` |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | With an AI provider | LLM credentials and endpoint for the car finder |
| `TRUST_PROXY_HOPS` | Behind a proxy | Exact number of trusted reverse proxies (e.g. `1` on Render) |

Never put `DATABASE_URL`, `JWT_SECRET` or API keys in a `VITE_` variable: those are embedded in the public frontend bundle.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API (with `--watch`) and the Vite dev server together |
| `npm run dev:api` / `npm run dev:web` | Runs either one on its own |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Starts the API and serves the built frontend |
| `npm test` | Runs all backend tests |
| `npm run test:coverage` | Runs tests with Node's built-in coverage |
| `npm run db:migrate` | Applies pending database migrations |
| `npm run seed:admin` | Creates or promotes the admin from env vars |
| `npm run stress -- --url http://127.0.0.1:3001` | Load-tests a running server |

## Project structure

```text
├── backend/
│   ├── server.js                 # Reads env, runs migrations, starts the HTTP server
│   ├── app.js                    # createApp(): middleware, validation schemas, all API routes
│   ├── seed-admin.js             # First-admin bootstrap
│   ├── services/
│   │   ├── ai-car-finder.js      # Natural-language parsing, ranking, alternatives, comparison
│   │   └── order-reservations.js # Expires 24-hour reservations and returns stock
│   └── database/
│       ├── postgres-database.js  # Connection pool, queries, transactions, migration runner
│       ├── postgres-schema.sql   # Baseline schema
│       └── migrations/postgres/  # Numbered migrations
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Routing, session, route guards, showroom state
│   ├── components/               # Header, footer, toast, brand mark, vehicle image
│   ├── features/
│   │   ├── public/               # Home, car details, contact
│   │   ├── auth/                 # Sign in / register, forgot and reset password
│   │   ├── ai-car-finder/        # Smart finder and comparison
│   │   ├── inventory/            # Vehicle card, admin vehicle editor
│   │   ├── checkout/             # Reservation modal
│   │   ├── account/              # Customer dashboard
│   │   └── admin/                # Admin dashboard
│   ├── hooks/                    # useDialogAccessibility (focus trap, Escape to close)
│   ├── lib/                      # API client, session, currency and label helpers
│   └── styles/dealership.css     # Design system: tokens, components, responsive rules
├── tests/                        # API, car finder, migration and PostgreSQL tests
├── scripts/                      # Migration runner, HTTP load check
├── docs/                         # Architecture, API, OpenAPI spec, security, testing, screenshots
├── design/                       # Original design mockups (not shipped)
├── Dockerfile · compose.yaml · compose.postgres.yaml
└── .github/workflows/ci-cd.yml
```

See [docs/project-structure.md](docs/project-structure.md) for where to make common changes.

## API overview

JSON REST API under `/api`. Protected routes need `Authorization: Bearer <token>`. Tokens expire after 8 hours.

| Area | Endpoints | Access |
| --- | --- | --- |
| Health | `GET /healthz` | Public |
| Auth | `POST /api/auth/register` · `login` · `logout` · `forgot-password` · `reset-password` · `GET /api/auth/me` | Public / signed in |
| Account | `GET` / `PUT /api/account` · `GET /api/account/orders` · `POST /api/account/password` | Signed in |
| Catalogue | `GET /api/public/vehicles` · `GET /api/public/vehicles/:id` | Public |
| Vehicles | `GET /api/vehicles` · `/search` · `/:id` | Signed in |
| Vehicle admin | `POST /api/vehicles` · `PUT` / `DELETE /api/vehicles/:id` · `POST /api/vehicles/:id/restock` | Admin |
| Reservations | `POST /api/vehicles/:id/checkout` · `POST /api/checkout/:id/cancel` | Signed in |
| Car finder | `POST /api/ai/car-finder` · `POST /api/ai/car-finder/compare` | Signed in |
| Enquiries | `POST /api/enquiries` | Public |
| Admin | `GET /api/admin/dashboard` · `GET` / `PATCH /api/admin/orders/:id` · `GET` / `PATCH /api/admin/enquiries/:id` | Admin |

Vehicle lists accept `make`, `model`, `category`, `minPrice`, `maxPrice`, `page`, `pageSize`, `sortBy` (`createdAt`, `make`, `model`, `price`) and `sortOrder` (`asc`, `desc`).

Full reference: [docs/api.md](docs/api.md) · [OpenAPI spec](docs/openapi.yaml).

## Testing and test report

```bash
npm test               # 39 tests
npm run test:coverage  # with coverage
npm run build          # production frontend build
```

**Latest result (28 October 2026): 39 passed, 0 failed, 0 skipped.** Overall coverage: 84.8% of lines, 81.5% of branches. The full per-test list and per-file coverage are in **[docs/test-report.md](docs/test-report.md)**.

| Suite | Tests | Result |
| --- | --- | --- |
| API endpoints (`tests/api-endpoints.test.js`) | 21 | ✔ all passed |
| AI car finder (`tests/ai-car-finder.test.js`) | 12 | ✔ all passed |
| Migrations and server config (`tests/postgres-migrations.test.js`) | 5 | ✔ all passed |
| PostgreSQL integration (`tests/postgres-integration.test.js`) | 1 | ✔ all passed |

- Tests send real HTTP requests to the Express app with Supertest. Locally each test gets a fresh **PGlite** database (PostgreSQL in WebAssembly), so no database server is needed.
- In CI, `TEST_DATABASE_URL` points at a real PostgreSQL 17 service and each test runs in its own schema.
- The backend was built test-first: the commit history starts with `test: define dealership inventory API behavior` before the API implementation.
- Covered: registration, login and roles, validation, filters, sorting and pagination, reservations and stock limits, restock, delete protection, enquiries, token revocation, rate limiting, CORS, migrations, and car finder parsing and fallback.

There are no frontend unit or browser end-to-end tests yet. See [docs/testing.md](docs/testing.md).

## Deployment

### CI/CD

Every push and pull request to `main` runs [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

1. Install dependencies, run the tests and `npm audit --audit-level=high`.
2. Build the frontend and the Docker image.
3. Scan the image with Trivy (fails on critical or high vulnerabilities).
4. Start the container, check `/healthz`, and run a 10-second load test (fails if p95 latency is over 3 s).
5. On pushes to `main`, publish the image to `ghcr.io/raghavkedia05/car-dealership` (`latest` and commit SHA tags).

### Option 1: one container (Docker)

```bash
cp .env.example .env     # set DATABASE_URL and JWT_SECRET
docker compose up --build -d
```

The image is a multi-stage build that runs as the non-root `node` user, with a health check. Compose runs it with a read-only filesystem and all Linux capabilities dropped. If PostgreSQL runs on your host machine, use `host.docker.internal` instead of `localhost` in `DATABASE_URL`.

### Option 2: Vercel + Render + Neon

1. **Database:** create a Neon project and copy the **pooled** connection string (its hostname contains `-pooler`).
2. **API on Render:** create a Web Service from the repo with build command `npm ci --omit=dev`, start command `npm start` and health check path `/healthz`. Set `NODE_ENV=production`, a Node 22 version of at least 22.13, `DATABASE_URL`, `JWT_SECRET`, `TRUST_PROXY_HOPS=1` and `AI_PROVIDER=deterministic`. Add `RESEND_API_KEY`, `PASSWORD_RESET_FROM` and `APP_ORIGIN` for password reset emails.
3. **Frontend on Vercel:** import the repo with the Vite preset, build command `npm run build` and output directory `dist`. Set `VITE_API_BASE_URL` to the Render URL (no `/api`) and deploy. `vercel.json` rewrites all paths to `index.html`, so refreshing `/login` or `/showroom` works.
4. **Connect them:** set `CORS_ORIGINS` on Render to the exact Vercel URL (no trailing slash) and redeploy.
5. **First admin:** add `ADMIN_EMAIL` / `ADMIN_PASSWORD` to Render, redeploy, sign in once, then remove them and redeploy again.

`VITE_API_BASE_URL` is baked in at build time, so redeploy Vercel after changing it.

## Security

- Passwords hashed with bcrypt (cost 12). Registration can never create an admin.
- JWTs expire after 8 hours. Logout revokes the token. Changing or resetting a password invalidates every older token for that user.
- The user's role is re-read from the database on every request. Hiding admin buttons in the UI is not what protects admin routes.
- Every request body and query is validated with Zod. All SQL values are bound parameters, and sort columns come from an allowlist.
- Order prices come from the database, never from the client.
- Rate limits: sign-in/registration 10 per 15 min, password reset 5 per hour, reservations 5 per hour, enquiries 5 per hour, car finder 10 per minute.
- Helmet security headers, a 32 KB request body limit, an exact-origin CORS allowlist, and no stack traces in API responses.
- Password reset tokens are stored only as SHA-256 hashes, expire after 30 minutes and work once.

Details and operational guidance: [docs/security.md](docs/security.md).

## Known limitations

- The access token is stored in `localStorage`. For production, an `HttpOnly` cookie session with CSRF protection would be safer.
- Rate-limit counters are kept in memory per process. Use a shared store (e.g. Redis) or edge limits when running several instances.
- Prices are stored as floating-point numbers. A real accounting system should use `NUMERIC` or integer paise.
- Sign-up does not verify email ownership.
- Payments are confirmed offline by staff. There is no online payment integration.
- Vehicle photos are added by URL. There is no image upload.
- No frontend unit or end-to-end tests yet.

## My AI Usage

AI tools were used throughout this project, and every AI-assisted commit is meant to carry a `Co-authored-by` trailer. The raw prompts are in **[PROMPTS.md](PROMPTS.md)**.

### Tools I used

| Tool | What I used it for |
| --- | --- |
| **GitHub Copilot** (AI agent through the Copilot SDK in VS Code) | Main implementation assistant: test-first backend, React frontend, Docker and CI/CD, debugging and docs. Credited as co-author on 25 commits. |
| **Google Stitch** | Generating the first UI mockups for the storefront, showroom, car finder, sign-in and admin screens (kept in `design/references/`). |
| **Claude** (Anthropic) | Final UI redesign, removing developer-only UI, removing OTP from sign-up, finding a merge problem that broke the styles, this README, the test report, and preparing to explain the architecture. |

### How I used them

- **Planning from the brief:** I gave Copilot the kata brief and a detailed engineering prompt (both in `PROMPTS.md`) to shape the API contract, database schema and folder structure.
- **Test-driven backend:** I asked Copilot to write the API behaviour tests first (`test: define dealership inventory API behavior`), then the Express implementation to make them pass, then more tests for purchases, pagination, migrations and authorisation.
- **Features:** Copilot helped build the natural-language car finder (parser, ranking, alternatives, comparison), INR pricing, the 24-hour reservation checkout, customer accounts and the admin dashboard.
- **Design:** I used Google Stitch to explore the visual direction, then integrated the generated storefront into React with Copilot. Later I used Claude to redesign the UI into one consistent design system (design tokens, one accent colour, responsive layouts, accessible dialogs) and to strip out developer-facing elements such as the API health badge and request-timing panel.
- **DevOps and debugging:** Copilot helped write the multi-stage Dockerfile, the GitHub Actions pipeline with Trivy scanning and load testing, and fix pipeline failures (a wrong Trivy action reference, a vulnerable Alpine base image, npm left in the production image).
- **Changes late in the project:** with Claude I removed the email OTP step from registration on both backend and frontend. When a teammate's restructure commit and the redesign overwrote each other, Claude compared the commits and found the leftover stylesheet that made text invisible.
- **Documentation:** AI drafted the README, API docs and test report. I checked commands, numbers and links against the code and a real test run.

### Reflection

- **Speed:** AI let me go from the brief to a working full-stack vertical slice (auth, inventory, tests, Docker, CI) much faster than I could have by hand. That left time for features like the car finder and reservations.
- **Tests were my safety net:** writing tests first meant I could check generated code instead of trusting it. This mattered: when OTP was added to sign-up, 20 of the 28 backend tests at that time started failing. Running the suite showed it immediately, and removing OTP brought every test back to passing.
- **AI output still needed review:** generated UI shipped developer-only details (health checks, latency numbers, "Built-in parser" labels) that no customer should see, and generated docs drifted out of date (the README still said OTP was required). Both were caught only by reviewing the running app and re-reading docs against the code.
- **Team workflow:** applying AI-generated changes to an outdated copy of the repo overwrote a teammate's work. The lesson was to `git pull` first and review `git diff` before every commit, whoever or whatever wrote the code.
- **Design decisions stayed mine:** AI suggested options, but choices like reserving instead of taking online payment, a rule-based finder by default (private and predictable, with an optional LLM whose output is schema-validated), and removing OTP for a smoother sign-up were trade-offs I had to understand and be able to defend.
- **Transparency:** the redesign commit (`4b3f452`) is missing its AI co-author trailer; it is noted here, and later AI-assisted commits include `Co-authored-by: Claude <noreply@anthropic.com>`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Runtime structure, data model, inventory rules, trade-offs |
| [docs/api.md](docs/api.md) · [docs/openapi.yaml](docs/openapi.yaml) | Endpoint reference |
| [docs/security.md](docs/security.md) | Security controls and known risks |
| [docs/testing.md](docs/testing.md) · [docs/test-report.md](docs/test-report.md) | Test suites, how they run, latest results |
| [PROMPTS.md](PROMPTS.md) | Raw AI prompts used during development |
| [docs/project-structure.md](docs/project-structure.md) | Where to find and change things |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and conventions |
| [design/README.md](design/README.md) | Original design references |
