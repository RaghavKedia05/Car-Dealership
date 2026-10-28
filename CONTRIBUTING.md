# Contributing to Apex Auto

Read the [README](README.md) for local setup, then use the [project map](docs/project-structure.md) to find the area you want to change.

## Development workflow

1. Use Node.js 22.13 or later and install dependencies with `npm ci`.
2. Configure the environment described in `.env.example` and the README. Local Node commands read process environment variables; copying `.env.example` to `.env` alone does not load them into Node. Compose reads `.env` for its substitutions.
3. Run `npm run dev` from the repository root. Vite serves the frontend on port 5173 and forwards API requests to Express on port 3001.
4. Edit frontend feature components under `src/features/`, shared UI under `src/components/`, and API behavior under `backend/`.
5. Run `npm test` and `npm run build` before submitting a change. Record any existing failures separately from new regressions. See [testing notes](docs/testing.md) for suite coverage and limits.

On PowerShell, use `npm.cmd` if execution policy prevents invoking `npm`.

## Keeping the repository navigable

- Keep component filenames in PascalCase and backend/helper filenames in kebab-case. Name files after their responsibility.
- Put feature-specific UI in its feature folder. Extract shared helpers to `src/lib/` and shared hooks to `src/hooks/` when multiple components need them.
- Keep `src/main.jsx` focused on mounting the app. Route/session coordination belongs in `src/App.jsx`.
- Keep database setup and ordered SQL migrations together under `backend/database/`. Preserve applied migration history and add forward migrations for schema changes. Update the runner and verify both database adapters when applicable.
- Update imports, npm scripts, tests, documentation links, and Docker paths whenever moving files.
- Add API changes to `docs/api.md` and `docs/openapi.yaml`; add new major folders to the project map.
- Put mockups in `design/references/` and archived exports in `design/archives/`. These assets are not built or shipped by the app.
- Do not commit credentials, local databases, dependency folders, or generated builds.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend and API development servers |
| `npm run dev:web` / `npm run dev:api` | Run either development server separately |
| `npm run seed:admin` | Create/promote the administrator using configured credentials |
| `npm test` | API and database tests |
| `npm run test:coverage` | Node test coverage |
| `npm run build` | Build frontend into `dist/` |
| `npm start` | Start the API and serve an existing frontend build |
| `npm run stress -- --url http://127.0.0.1:3001` | Load-test an already running local service |
| `npm run db:import:postgres` | Import SQLite into an empty PostgreSQL target; follow README backup instructions first |
