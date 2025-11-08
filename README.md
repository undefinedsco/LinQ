# LinQ

## Overview

Linq is a Solid-first productivity surface targeting web, desktop, and mobile shells from a single monorepo. The current focus is the welcome experience that authenticates against Solid Pods and renders profile data via `drizzle-solid`.

## Tech Stack

- **Web**: Next.js 15 (currently pinned to React 18.3; upgrade to React 19 once Next ≥15.0.4 is adopted).
- **Desktop**: Electron 32.x wrapper (binary downloads skipped during install unless explicitly requested).
- **Mobile**: Capacitor 6 shell scaffold (integration to follow the web milestone).
- **Solid Integration**: `@inrupt/solid-ui-react` session provider, `@inrupt/solid-client`, and `drizzle-solid` (drizzle ORM dialect for Solid Pods) powering profile queries.
- **Styling**: Currently plain CSS modules; Tailwind CSS is the preferred framework for the upcoming theming work.

### Solid Data Access

- All structured data (profiles, contacts, sessions, etc.) must flow through repositories in `packages/models` (published as `@linq/models`) that use `drizzle-solid`. Each repository is responsible for connecting, registering relevant pod sources, and issuing SPARQL via the drizzle dialect.
- **No UI fallbacks**: when a query fails, fix the drizzle-solid repository (schema, permission, SPARQL) rather than calling `getSolidDataset` or other direct helpers in React components. This keeps Solid access centralized, maintains consistent caching, and eases future schema migrations.

## Workspace Tooling

- Package manager: **Yarn 1.22** (declared via `packageManager` in the root `package.json`).
- Workspaces: `apps/*`, `packages/*`, `tests/*`.
- Install (skip Electron binary download when not building the desktop app):

  ```bash
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 yarn install
  ```

- Web dev server:

  ```bash
  yarn workspace @linq/web dev
  ```

- Static build:

  ```bash
  yarn workspace @linq/web build
  ```

### Local dependency patches

- Third-party fixes can live under `vendors/`. For example, `vendors/drizzle-solid/` tracks a local clone so we can patch the SPARQL executor.
- To make the workspace use a local clone, declare the dependency as `"drizzle-solid": "file:vendors/drizzle-solid"` in the relevant `package.json`. Yarn will bundle that version for both development and production builds—there is no “dev-only” shortcut, so remember to revert to the published package before releasing if the patch should stay local.
- After editing the vendor source, rebuild its `dist/` (e.g., `cd vendors/drizzle-solid && npm run build`) so downstream packages pick up the compiled output.

## Package Directory

- `apps/web`: Next.js App Router welcome flow.
- `apps/desktop-electron`: Electron wrapper scaffold.
- `apps/mobile-shell`: Capacitor shell scaffold.
- `packages/models`: Shared Solid data models & repositories (`drizzle-solid` helpers).
