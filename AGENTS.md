# linq Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-26

## Active Technologies

- TypeScript (Next.js 15, Node.js 18 LTS) + Next.js App Router, `@inrupt/solid-client-authn-browser`, `@inrupt/solid-client`, `@inrupt/solid-ui-react`, drizzle-solid (client-only repositories), Electron 32.x (001-linq-hub)

## Project Structure

```text
apps/
├── web/                    # Next.js App Router front-end
│   └── src/
│       ├── app/            # Route handlers (App Router)
│       ├── modules/        # Feature modules (profile, contacts…)
│       ├── shared/         # Web-specific shared components/hooks
│       └── styles/
├── desktop-electron/       # Electron wrapper
└── mobile-shell/           # Capacitor shell
packages/
├── models/                 # Shared Solid models + repositories (drizzle-solid)
│   └── src/
│       ├── profile/
│       ├── contact/
│       └── index.ts
├── shared-ui/              # Cross-platform UI components
└── utils/                  # Cross-platform utilities
tests/
├── playwright/
└── smoke/
vendors/
└── drizzle-solid/          # Local fork for dependency patches
```

## Commands

- Install (skip Electron binary download unless needed): `ELECTRON_SKIP_BINARY_DOWNLOAD=1 yarn install`
- Web lint placeholder: `yarn workspace @linq/web lint`

## Code Style

- TypeScript (Next.js 15, Node.js 18 LTS): Follow standard conventions.
- UI: Solid-inspired purple gradients (`#5B21B6` → `#C084FC`) layered on dark glassmorphic backgrounds with 12–16 px radii.
- Typography: Inter (or system sans fallback) with headings at weight 600, body text at weight 400, line-height ≥ 1.5.
- Solid predicates must reference namespace constants (e.g. `VCARD.fn`) rather than inlining IRIs in table definitions.
- Each app must define and reuse a single business namespace (e.g. `LINQ`) for its custom predicates; avoid scattering multiple ad-hoc namespaces within the same application.
- When defining `podTable` resources, prefer the new URI-style prefixes (`idp:///path/to/resource` for LDP containers, `sparql:///path/to/endpoint` for SPARQL sources) instead of plain relative paths.

## Recent Changes

- 001-linq-hub: Added TypeScript (Next.js 14, Node.js 18 LTS) + Next.js App Router, `@inrupt/solid-client-authn-browser`, `@inrupt/solid-client`, drizzle-solid (SQLite adapter for local mocks)

<!-- MANUAL ADDITIONS START -->

### UI Style Reference

- **Primary palette**: Solid Pod purples (`#5B21B6`, `#7C3AED`, `#C084FC`) with teal accents (`#14B8A6`).
- **Neutrals**: Slate/blue-gray backgrounds (`#0F172A`, `#1E293B`, `#334155`) and translucent borders `rgba(148,163,184,0.4)`.
- **Glass effects**: Blur 16–18 px, alpha 0.6–0.7, shadows `0 25px 65px rgba(15,23,42,0.45)`.
- **Motion**: 200–240 ms ease-in-out transitions, 120–150 ms hover fades, easing `cubic-bezier(0.4, 0, 0.2, 1)`.

### File-Structure Notes

- 业务模块统一放在 `apps/web/src/modules/*`；模块内部引用 `@linq/models` 暴露的仓储和类型。
- 共用模型/仓储集中在 `packages/models`，以实体为子目录（如 `profile/`, `contact/`），`index.ts` 聚合导出。
- 第三方补丁放在 `vendors/*`，通过 `file:vendors/...` 方式覆盖；记得改动后执行该包的 build。

<!-- MANUAL ADDITIONS END -->
