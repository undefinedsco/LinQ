# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

LinQ is a Solid-first productivity application built as a monorepo targeting web, desktop, and mobile shells. Built with TanStack Router + Query for modern SPA architecture.

### Key Architectural Principles

- **Solid Data Access**: All structured data (profiles, contacts, sessions) flows through repositories in `packages/models` using `drizzle-solid`. Never use direct `getSolidDataset` calls in React components.
- **No UI Fallbacks**: When queries fail, fix the drizzle-solid repository (schema, permissions, SPARQL) rather than implementing UI fallbacks.
- **Monorepo Structure**: Workspaces organized as `apps/*`, `packages/*`, `tests/*`, `vendors/*`, and `examples/*`.

### Core Components

- **`packages/models`**: Published as `@linq/models`, contains all Solid data schemas and repositories using drizzle-solid
- **`apps/web`**: Vite + React 18.3 SPA with TanStack Router + Query, shadcn/ui, and Tailwind CSS
- **`apps/desktop-electron`**: Electron 32.x wrapper
- **`apps/mobile-shell`**: Capacitor 6 shell scaffold
- **`vendors/drizzle-solid`**: Local clone for SPARQL executor patches and RDF vocabulary fixes
- **`examples/solid-login-example`**: Pure React components for learning Solid authentication patterns

## Development Commands

### Setup and Installation
```bash
# Install all dependencies (skip Electron binary download)
yarn install:all
# or manually: ELECTRON_SKIP_BINARY_DOWNLOAD=1 yarn install
```

### Web Development
```bash
# Start development server (shorthand)
yarn dev

# Or explicit workspace command
yarn dev:web

# Build for production
yarn build

# Individual builds
yarn build:vendor     # Build drizzle-solid vendor package
yarn build:models     # Build @linq/models package  
yarn build:web        # Build web application

# Linting and type checking
yarn lint             # Run web linting
yarn typecheck        # Run web type checking

# Preview built application
yarn preview:web
```

### Examples Development
```bash
# Run Solid login example
yarn dev:example
```

### Workspace Management
- Package manager: Yarn 1.22 (declared via `packageManager`)
- Use workspace commands: `yarn workspace @linq/[app-name] [command]`

### Local Vendor Patches
- Local dependencies live in `vendors/` (e.g., `vendors/drizzle-solid/`)
- After editing vendor source, rebuild with `cd vendors/drizzle-solid && npm run build`
- Reference in package.json as `"drizzle-solid": "file:vendors/drizzle-solid"`

## Tech Stack Notes

- **Frontend Framework**: Vite + React 18.3 for fast development and production builds
- **Routing**: TanStack Router for type-safe, file-based routing with layout support
- **State Management**: TanStack Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **Solid Integration**: `@inrupt/solid-ui-react` session provider and `@inrupt/solid-client`
- **Data Layer**: `drizzle-solid` ORM dialect for Solid Pod SPARQL queries with custom RDF vocabulary fixes
- **Version Constraints**: React pinned to 18.3.1, specific Comunica versions for SPARQL compatibility