# Northline Motors — Car Dealership Inventory

A full-stack dealership inventory app with a responsive React storefront, an authenticated REST API, and a persistent SQLite database. Shoppers can browse and filter vehicles and purchase available stock; administrators can maintain the catalog.

## Features

- Create an account, sign in, and access protected endpoints with expiring JWTs.
- Browse all inventory, including sold-out vehicles, and filter by make, model, category, and price range.
- Reserve a vehicle; its stock is decremented atomically, and vehicles at zero stock cannot be purchased.
- Give administrators a separate inventory-management experience for adding, editing, and removing vehicles.
- Persist users and vehicle inventory in a local SQLite database. Passwords are stored as bcrypt hashes.
- Run the React/Tailwind development server and API together, or build a production frontend served by the API.

## Technology

- **API:** Node.js, Express 5, Zod request validation, bcrypt, and JSON Web Tokens.
- **Database:** SQLite through Node's built-in `node:sqlite` module. It uses a file on disk; no in-memory database or external database service is required.
- **Frontend:** React 19, Vite, Tailwind CSS 4, and custom responsive CSS.
- **Tests:** Node's built-in test runner and Supertest.

Use **Node.js 22.13 or later**. No separate SQLite installation is needed.

## Run locally

In PowerShell, from the project root:

```powershell
npm.cmd install
$env:JWT_SECRET = "replace-this-with-a-long-random-secret"
npm.cmd run dev
```

The React app is at `http://localhost:5173`; its `/api` requests are proxied to the API at `http://localhost:3001`. When using a shell where `npm` works directly, the `.cmd` suffix is optional.

The default persistent database is `data\dealership.db`; the API creates it on its first start. To select a different database file, set `DATABASE_PATH` before starting the API.

### Create the first administrator

Registration intentionally creates ordinary user accounts only. In a second PowerShell window, set a valid email address and use a strong, unique password that is at least 12 and at most 72 UTF-8 bytes:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "replace-this-with-a-unique-password"
node backend\seed-admin.js
```

This creates the initial administrator in the same database used by the API. If the email already exists as a regular account, the command promotes that account without changing its existing password. Sign in with that account to manage inventory. `ADMIN_NAME` is optional and defaults to `Dealership Admin`.

### Production build

```powershell
npm.cmd run build
$env:JWT_SECRET = "replace-this-with-a-long-random-secret"
$env:NODE_ENV = "production"
npm.cmd start
```

The production server listens on port `3001` by default, serves the built React app from `dist`, and requires an explicitly configured `JWT_SECRET`. Override the listening port with `PORT` and the database filename with `DATABASE_PATH`.

## API

All endpoints use the `/api` prefix. Send and receive JSON. Except for registration and login, endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register with `name`, `email`, and a 12–72-byte `password`. |
| `POST` | `/api/auth/login` | Public | Sign in with `email` and `password`; returns an 8-hour token and user. |
| `GET` | `/api/vehicles` | Signed in | List all vehicles, including vehicles with no stock. |
| `GET` | `/api/vehicles/search` | Signed in | Filter by optional `make`, `model`, `category`, `minPrice`, and `maxPrice`. |
| `GET` | `/api/vehicles/:id` | Signed in | Read one vehicle. |
| `POST` | `/api/vehicles` | Admin | Create a vehicle. |
| `PUT` | `/api/vehicles/:id` | Admin | Replace a vehicle's make, model, category, price, and quantity. |
| `DELETE` | `/api/vehicles/:id` | Admin | Remove a vehicle. Returns `204` on success. |
| `POST` | `/api/vehicles/:id/purchase` | Signed in | Reserve one vehicle and decrement stock. Returns `409` if it is sold out. |
| `POST` | `/api/vehicles/:id/restock` | Admin | Add a positive integer quantity using `{ "quantity": 5 }`. |

Example search:

```text
GET /api/vehicles/search?make=Volvo&category=SUV&minPrice=25000&maxPrice=60000
```

A vehicle has a server-generated UUID `id`, non-empty `make`, `model`, and `category`, positive numeric `price`, and non-negative integer `quantity`. Invalid input returns `400`, unauthenticated requests return `401`, and insufficient privileges return `403`.

## Screenshots

The screenshots below were captured from the running application:

![Northline Motors inventory dashboard with administrator controls](screenshots/inventory-dashboard.png)

![Northline Motors sign-in page](screenshots/sign-in.png)

![Northline Motors account registration page](screenshots/registration.png)

## Tests and test report

Run the API tests and production build:

```powershell
npm.cmd test
npm.cmd run build
```

The suite exercises registration and password hashing, login and role protection, invalid input, authenticated inventory access and filtering, administrator catalog operations, purchases and stock limits, restocking, and persistence across SQLite connections. A browser smoke check also covered account registration/sign-in, administrator vehicle creation, the shopper search and purchase flows, and sold-out button disabling.

**Latest test report:** `npm.cmd test` — 10 tests passed, 0 failed.  
**Latest coverage report:** 93.37% lines, 80.00% branches, and 84.62% functions.  
**Production build:** `npm.cmd run build` — passed.

Collect Node's built-in coverage summary with:

```powershell
npm.cmd run test:coverage
```

## Git and test-driven development

The development history starts with the API behavior tests, recorded while the API implementation was absent (red), followed by the backend implementation that made the suite pass (green). Frontend, documentation, and additional persistence and validation tests follow those milestones. AI-assisted commits include the requested Copilot co-author trailer.

## My AI Usage

I used GitHub Copilot, via an AI assistant using Copilot SDK in VS Code, while working from the supplied kata brief. It helped scaffold the API behavior tests and implementation, shape the React dashboard and styling, and draft the setup, API, and AI-usage documentation. The initial tests were run before the API existed; I then ran the backend tests and production build and exercised registration, administrator inventory management, stock updates, and sold-out behavior in the browser.

AI helped me move more quickly from the brief to a complete working vertical slice. I still reviewed the generated changes against the acceptance criteria and used automated tests and browser checks rather than treating generated code as verified by default. The prompts used for this project are included unedited in [`PROMPTS.md`](PROMPTS.md).

## Repository and deployment

This project is hosted at [RaghavKedia05/Car-Dealership](https://github.com/RaghavKedia05/Car-Dealership). No live deployment URL is currently available.
