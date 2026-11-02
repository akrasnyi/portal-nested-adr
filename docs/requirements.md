# Spike: Nested Module Federation (shell → App Hub → CAD)

## Goal

Verify that a nested remote (CAD), loaded by a middle remote (App Hub) that the shell knows nothing about,
receives the **same** singleton instances of React, react-router, QueryClient and auth session as the shell.
The spike result must be recorded as one of: **works** / **fallback** / **blocker**.

## Stack

| Package | Version | Shared config |
|---|---|---|
| vite | 5.x | — |
| @module-federation/vite | 1.7.2 | — |
| react | 19.0.0 | `singleton: true, strictVersion: true, requiredVersion: "19.0.0"` |
| react-dom | 19.0.0 | `singleton: true, strictVersion: true, requiredVersion: "19.0.0"` |
| react-router-dom | 6.30.4 | `singleton: true, strictVersion: true, requiredVersion: "6.30.4"` |
| @tanstack/react-query | 5.90.2 | `singleton: true, strictVersion: true, requiredVersion: "5.90.2"` |

## Topology

| App | Role | Port | Exposes | Remotes | Owns providers |
|---|---|---|---|---|---|
| shell | host | 5170 | — | `appHub` only | Router, QueryClientProvider, AuthProvider, LayoutProvider |
| app-hub | remote for shell + host for CAD | 5174 | `./App` | `cad` | none (consumes shell's) |
| cad | leaf remote | 5175 | `./App` | — | none (consumes shell's) |

## Functional Requirements

| ID | Area | Requirement | Acceptance / Verification |
|---|---|---|---|
| FR-01 | shell | Shell renders `BrowserRouter`, a single `QueryClientProvider` (one `QueryClient` instance), `AuthProvider` with a fake user, and `LayoutProvider` at the root. | Providers are mounted once at the app root. |
| FR-02 | shell | Shell defines route `/app-hub/*` that renders `React.lazy(() => import("appHub/App"))`. | Navigating to `/app-hub` renders App Hub. |
| FR-03 | shell | Shell declares **only** `appHub` in `remotes`. It must not reference `cad` in config, imports or types. | `grep -r "cad" shell/` returns no MF-related matches. |
| FR-04 | shell | Shell provides a UI control to switch the fake user (e.g. "Alice" / "Bob"). | Switching the user re-renders shell header with the new name. |
| FR-05 | shell | Shell exposes layout extension points: a context API (e.g. `useLayout().setBreadcrumbs()`) and a DOM mount node (e.g. `#shell-breadcrumbs`) for portals. | Both are available to any descendant component. |
| FR-06 | app-hub | App Hub exposes `./App`. | Shell loads it via `appHub/App`. |
| FR-07 | app-hub | App Hub declares remote `cad` → `${VITE_CAD_URL}/mf-manifest.json`. | Manifest request goes to port 5175. |
| FR-08 | app-hub | App Hub defines relative route `cad/*` that renders `React.lazy(() => import("cad/App"))`. App Hub must not create its own Router. | `/app-hub/cad` renders CAD inside App Hub inside shell. |
| FR-09 | cad | CAD exposes `./App` and renders the text "CAD" plus `useAuth().user.name` from the shell's auth context. | Shell user name is visible in CAD. |
| FR-10 | cad | CAD has at least two internal routes (e.g. `/app-hub/cad` and `/app-hub/cad/drawings/:id`) using `Link` / `useNavigate`. CAD must not create its own Router. | Navigation updates the URL; Back/Forward work across shell, App Hub and CAD. |
| FR-11 | cad | CAD contributes to the shell layout: (a) sets a breadcrumb via shell's layout context, (b) renders an element into the shell DOM node via `createPortal`. | Breadcrumb and portal content appear in the shell layout and are removed on CAD unmount. |
| FR-12 | diagnostics | Shell sets `window.__shellReact = React` and `window.__shellQueryClient = queryClient` when diagnostics are enabled (dev, or build with `VITE_MF_DEBUG=true`). | Globals exist in both modes when the flag is on. |
| FR-13 | diagnostics | CAD logs `[mf-check]` results: `window.__shellReact === React`, `useQueryClient() === window.__shellQueryClient`, `useInRouterContext()`, current `useAuth().user`. | All checks log `true` / expected user. |
| FR-14 | contexts | Shared contexts (Auth, Layout) are created through a global registry: `globalThis[Symbol.for("shell.<name>.context")] ??= createContext(...)`, so duplicate module copies resolve to the same context object. | CAD reads the shell context even if the contracts module is bundled more than once. |
| FR-15 | fallback | App Hub supports an alternative CAD loader via runtime API (`registerRemotes` + `loadRemote("cad/App")` from `@module-federation/enhanced/runtime`), switchable via `VITE_CAD_LOADER=static\|runtime`. | Both loaders render CAD; diagnostics are compared between them. |

## Non-Functional Requirements

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Version alignment | All four shared libraries are pinned to exact versions (no `^` / `~`) in all three `package.json` files, resolved through one lockfile. | `pnpm why react` (or equivalent) shows a single version. |
| NFR-02 | Shared config | `shared` config is identical across all three apps (`singleton`, `strictVersion`, exact `requiredVersion`) and uses the same share scope (`default`). If subpath imports (`react/jsx-runtime`, `react-dom/client`) produce separate chunks, they are shared as well. | Config diff between apps is empty. |
| NFR-03 | Isolation | Shell has zero knowledge of CAD. CAD is reachable only through App Hub. | Code review + FR-03 check. |
| NFR-04 | Dev/build parity | Every acceptance criterion is verified in both `vite dev` and `vite build && vite preview`. A dev-only success is not a valid result. | Acceptance matrix below is filled for both modes. |
| NFR-05 | Configuration | Remote URLs come from env variables (`VITE_APP_HUB_URL`, `VITE_CAD_URL`); no hardcoded URLs in source. | Changing env changes remote origin without code changes. |
| NFR-06 | Build output | Remotes set an absolute `base` (e.g. `http://localhost:5175/`) for build so chunks load from the remote origin, not the host origin. `build.target: "esnext"` (top-level await). | No 404s for remote chunks in preview. |
| NFR-07 | Networking | Fixed ports 5170 / 5174 / 5175 with `strictPort: true`. CORS enabled on remote dev and preview servers. | No port drift, no CORS errors in console. |
| NFR-08 | Single instance | Exactly one chunk each of react, react-dom, react-router and react-query is downloaded on `/app-hub/cad`. | DevTools → Network, filter by library name. |
| NFR-09 | Fail-fast | A shared version mismatch must fail loudly (strictVersion error), never silently load a second copy. | Temporarily bump a version in CAD and confirm the error. |
| NFR-10 | Observability | All diagnostics use the `[mf-check]` console prefix and are available in both modes behind `VITE_MF_DEBUG`. | Console filter `[mf-check]` shows all checks. |
| NFR-11 | Developer experience | One command starts all three apps per mode (`dev:all`, `preview:all`). | Fresh clone → one command → working chain. |
| NFR-12 | Scope | Minimal pet-project scope: no SSR, no real auth backend, no federated TypeScript types required. | — |

## Acceptance Matrix

| AC | Criterion | How to verify | Dev | Build/preview |
|---|---|---|---|---|
| AC-1 | CAD renders inside App Hub inside shell at `http://localhost:5170/app-hub/cad` | Open URL | ⬜ | ⬜ |
| AC-2 | `window.__shellReact === React` in CAD is `true` | `[mf-check]` log | ⬜ | ⬜ |
| AC-3 | `useQueryClient()` in CAD is the shell's instance | `[mf-check]` log | ⬜ | ⬜ |
| AC-4 | `useAuth()` in CAD returns the shell user and updates when the user is switched in shell | Switch user, observe CAD | ⬜ | ⬜ |
| AC-5 | react-router navigation inside CAD works and does not break shell URL/history | Navigate in CAD, use Back/Forward | ⬜ | ⬜ |
| AC-6 | CAD contributes to shell layout (breadcrumbs via context, portal into shell DOM) | Visual check + unmount check | ⬜ | ⬜ |
| AC-7 | Only one react chunk in DevTools → Network | Network tab | ⬜ | ⬜ |
| AC-8 | Fallback loader (`loadRemote`) tested if AC-2…AC-7 fail with static remotes | Switch `VITE_CAD_LOADER` | ⬜ | ⬜ |

## Outcome Definitions

| Outcome | Meaning |
|---|---|
| **works** | AC-1…AC-7 pass in both modes using static `remotes` in App Hub. |
| **fallback** | AC-1…AC-7 pass in both modes only when App Hub loads CAD via `loadRemote`. |
| **blocker** | At least one AC fails in at least one mode with both loaders. Document the failing AC, mode and root cause. |

## Risks & Pitfalls

| Risk | Impact | Mitigation |
|---|---|---|
| Shell accidentally declares `cad` | Hides nested-federation problems, invalid spike | FR-03, NFR-03 |
| Version drift in any app | `strictVersion` aborts loading | NFR-01, single lockfile |
| Duplicate `createContext` across module copies | Empty contexts in CAD, user appears logged out | FR-14 (Symbol.for registry) |
| Dev and build share modules differently | False positive in dev only | NFR-04, acceptance matrix |
| Relative `base` in remote builds | Remote chunks requested from host origin (404) | NFR-06 |
| Unshared subpaths (`react/jsx-runtime`, `react-dom/client`) | Second React-related chunk, AC-7 fails | NFR-02 |
| Nested `BrowserRouter` in App Hub or CAD | Broken history, duplicate router context | FR-08, FR-10 |

## Result

| Field | Value |
|---|---|
| Outcome | works / fallback / blocker |
| Approach | _static remotes / loadRemote, context registry used: yes/no_ |
| Problems found | _…_ |
| Date / versions tested | _…_ |