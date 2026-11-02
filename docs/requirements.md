# Spike: Nested Module Federation (shell → App Host → Use case A)

## Loading options

The requirements below were written for build-time remotes. This repo keeps the runtime API as the default and
checks each requirement against it. The "Option A" notes say how a requirement reads for the runtime API.

- **Option A (this repo's default): runtime API.** Every host registers its remotes with `registerRemotes` and loads
  them with `loadRemote("<name>/App")` from `@module-federation/runtime`. The shell gets the App Host URL from
  `public/config.json` (`config.dev.json` in dev). App Host gets the Use case A URL from `USE_CASES` in code
  (`apps/app-host/src/use-cases.ts`). No `remotes` in any build config. See [ADR-0003](adr/0003-runtime-remote-loading.md).
- **Option B: build-time `remotes`.** Only as the experiment `APP_HOST_STATIC_REMOTES=1` in App Host
  (`import("useCaseA/App")`). See [results-static-remotes.md](results-static-remotes.md).

An alternative PR uses the same requirement IDs with build-time remotes as the default (Option B). Status of each requirement against the code: [progress.md](progress.md).

## Goal

Verify that a nested remote (Use case A), loaded by a middle remote (App Host) that the shell knows nothing about,
receives the **same** singleton instances of React, react-router, QueryClient and auth session as the shell.
The spike result must be recorded as one of: **works** / **fallback** / **blocker**.

## Stack

| Package | Version | Shared config |
|---|---|---|
| vite | 5.4.14 | — |
| @module-federation/vite | 1.7.2 | — |
| react | 19.0.0 | `singleton: true, strictVersion: true, requiredVersion: "19.0.0"` |
| react-dom | 19.0.0 | `singleton: true, strictVersion: true, requiredVersion: "19.0.0"` |
| react-router-dom | 6.30.4 | `singleton: true, strictVersion: true, requiredVersion: "6.30.4"` |
| @tanstack/react-query | 5.90.2 | `singleton: true, strictVersion: true, requiredVersion: "5.90.2"` |

## Topology

| App | Role | Port | Exposes | Remotes | Remotes (Option A) | Owns providers |
|---|---|---|---|---|---|---|
| shell | host | 5170 | — | `appHost` only | `appHost` from `config.json` | Router, QueryClientProvider, AuthProvider, LayoutProvider |
| app-host | remote for shell + host for Use case A | 5174 | `./App` | `useCaseA` | `useCaseA` from `USE_CASES` in code | none (consumes shell's) |
| use-case-a | leaf remote | 5175 | `./App` | — | — | none (consumes shell's) |

## Functional Requirements

| ID | Area | Requirement | Acceptance / Verification | Option A |
|---|---|---|---|---|
| FR-01 | shell | Shell renders `BrowserRouter`, a single `QueryClientProvider` (one `QueryClient` instance), `AuthProvider` with a fake user, and `LayoutProvider` at the root. | Providers are mounted once at the app root. | — |
| FR-02 | shell | Shell defines route `/app-host/*` that renders `React.lazy(() => import("appHost/App"))`. | Navigating to `/app-host` renders App Host. | Route `/app-host/*` in the shell router renders `RemoteBoundary` with `loadRemoteApp("appHost")`, which calls `loadRemote("appHost/App")`. No `import("appHost/App")` in the shell. |
| FR-03 | shell | Shell declares **only** `appHost` in `remotes`. It must not reference `useCaseA` / `use-case-a` in config, imports or types. | `grep -rn "useCaseA\|use-case-a" apps/shell` returns nothing. | The shell registers only `appHost`, from `config.json`. No reference to Use case A in code or config. |
| FR-04 | shell | Shell provides a UI control to switch the fake user (e.g. "Alice" / "Bob"). | Switching the user re-renders shell header with the new name. | — |
| FR-05 | shell | Shell exposes layout extension points: a context API (e.g. `useLayout().setBreadcrumbs()`) and a DOM mount node (e.g. `#shell-breadcrumbs`) for portals. | Both are available to any descendant component. | — |
| FR-06 | app-host | App Host exposes `./App`. | Shell loads it via `appHost/App`. | — |
| FR-07 | app-host | App Host declares remote `useCaseA` → `${VITE_USE_CASE_A_URL}/mf-manifest.json`. | Manifest request goes to port 5175. | No build-time remote. The entry is the URL in `USE_CASES` (`use-cases.ts`): `http://localhost:5175/remoteEntry.js` in dev, `mf/use-case-a/remoteEntry.js` in build. The URL is the code, not a `VITE_*` variable. |
| FR-08 | app-host | App Host defines relative route `use-case-a/*` that renders `React.lazy(() => import("useCaseA/App"))`. App Host must not create its own Router. | `/app-host/use-case-a` renders Use case A inside App Host inside shell. | Relative route `use-case-a/*` is built from `USE_CASES` and renders `RemoteBoundary` with `loadUseCase`, which calls `loadRemote("useCaseA/App")`. No own Router. |
| FR-09 | use-case-a | Use case A exposes `./App` and renders the text "Use case A" plus `useAuth().user.name` from the shell's auth context. | Shell user name is visible in Use case A. | — |
| FR-10 | use-case-a | Use case A has at least two internal routes (e.g. `/app-host/use-case-a` and `/app-host/use-case-a/reports/:reportId`) using `Link` / `useNavigate`. Use case A must not create its own Router. | Navigation updates the URL; Back/Forward work across shell, App Host and Use case A. | — |
| FR-11 | use-case-a | Use case A contributes to the shell layout: (a) sets a breadcrumb via shell's layout context, (b) renders an element into the shell DOM node via `createPortal`. | Breadcrumb and portal content appear in the shell layout and are removed on Use case A unmount. | — |
| FR-12 | diagnostics | Shell sets `window.__shellReact = React` and `window.__shellQueryClient = queryClient` when diagnostics are enabled (dev, or build with `VITE_MF_DEBUG=true`). | Globals exist in both modes when the flag is on. | — |
| FR-13 | diagnostics | Use case A logs `[mf-check]` results: `window.__shellReact === React`, `useQueryClient() === window.__shellQueryClient`, `useInRouterContext()`, current `useAuth().user`. | All checks log `true` / expected user. | — |
| FR-14 | contexts | Shared contexts (Auth, Layout) are created through a global registry: `globalThis[Symbol.for("shell.<name>.context")] ??= createContext(...)`, so duplicate module copies resolve to the same context object. | Use case A reads the shell context even if the contracts module is bundled more than once. | — |
| FR-15 | fallback | App Host supports an alternative Use case A loader via runtime API (`registerRemotes` + `loadRemote("useCaseA/App")` from `@module-federation/enhanced/runtime`), switchable via `VITE_USE_CASE_A_LOADER=static\|runtime`. | Both loaders render Use case A; diagnostics are compared between them. | Roles are reversed. The runtime loader is the default. The static loader (Option B) is the switch: build-time `APP_HOST_STATIC_REMOTES=1`. Both loaders were checked with the same ProofPanel checks. |

## Non-Functional Requirements

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Version alignment | All four shared libraries are pinned to exact versions (no `^` / `~`) in all three `package.json` files, resolved through one lockfile. | `npm ls react` (or equivalent) shows a single version. |
| NFR-02 | Shared config | `shared` config is identical across all three apps (`singleton`, `strictVersion`, exact `requiredVersion`) and uses the same share scope (`default`). If subpath imports (`react/jsx-runtime`, `react-dom/client`) produce separate chunks, they are shared as well. | Config diff between apps is empty. |
| NFR-03 | Isolation | Shell has zero knowledge of Use case A. Use case A is reachable only through App Host. | Code review + FR-03 check. |
| NFR-04 | Dev/build parity | Every acceptance criterion is verified in both `vite dev` and `vite build && vite preview`. A dev-only success is not a valid result. | Acceptance matrix below is filled for both modes. |
| NFR-05 | Configuration | Remote URLs come from env variables (`VITE_APP_HOST_URL`, `VITE_USE_CASE_A_URL`); no hardcoded URLs in source. | Changing env changes remote origin without code changes. |
| NFR-06 | Build output | Remotes set an absolute `base` (e.g. `http://localhost:5175/`) for build so chunks load from the remote origin, not the host origin. `build.target: "esnext"` (top-level await). | No 404s for remote chunks in preview. |
| NFR-07 | Networking | Fixed ports 5170 / 5174 / 5175 with `strictPort: true`. CORS enabled on remote dev and preview servers. | No port drift, no CORS errors in console. |
| NFR-08 | Single instance | Exactly one chunk each of react, react-dom, react-router and react-query is downloaded on `/app-host/use-case-a`. | DevTools → Network, filter by library name. |
| NFR-09 | Fail-fast | A shared version mismatch must fail loudly (strictVersion error), never silently load a second copy. | Temporarily bump a version in Use case A and confirm the error. |
| NFR-10 | Observability | All diagnostics use the `[mf-check]` console prefix and are available in both modes behind `VITE_MF_DEBUG`. | Console filter `[mf-check]` shows all checks. |
| NFR-11 | Developer experience | One command starts all three apps per mode (`dev:all`, `preview:all`). | Fresh clone → one command → working chain. |
| NFR-12 | Scope | Minimal pet-project scope: no SSR, no real auth backend, no federated TypeScript types required. | — |

## Acceptance Matrix

| AC | Criterion | How to verify | Dev | Build/preview |
|---|---|---|---|---|
| AC-1 | Use case A renders inside App Host inside shell at `http://localhost:5170/app-host/use-case-a` | Open URL | ⬜ | ⬜ |
| AC-2 | `window.__shellReact === React` in Use case A is `true` | `[mf-check]` log | ⬜ | ⬜ |
| AC-3 | `useQueryClient()` in Use case A is the shell's instance | `[mf-check]` log | ⬜ | ⬜ |
| AC-4 | `useAuth()` in Use case A returns the shell user and updates when the user is switched in shell | Switch user, observe Use case A | ⬜ | ⬜ |
| AC-5 | react-router navigation inside Use case A works and does not break shell URL/history | Navigate in Use case A, use Back/Forward | ⬜ | ⬜ |
| AC-6 | Use case A contributes to shell layout (breadcrumbs via context, portal into shell DOM) | Visual check + unmount check | ⬜ | ⬜ |
| AC-7 | Only one react chunk in DevTools → Network | Network tab | ⬜ | ⬜ |
| AC-8 | Fallback loader (`loadRemote`) tested if AC-2…AC-7 fail with static remotes | Switch the loader (Option A: static remotes are the fallback, see FR-15) | ⬜ | ⬜ |

## Outcome Definitions

| Outcome | Meaning | Option A |
|---|---|---|
| **works** | AC-1…AC-7 pass in both modes using static `remotes` in App Host. | AC-1…AC-7 pass in both modes with the runtime loader (`registerRemotes` + `loadRemote`, the default). Static `remotes` (Option B) reached the same verdict, [results-static-remotes.md](results-static-remotes.md). |
| **fallback** | AC-1…AC-7 pass in both modes only when App Host loads Use case A via `loadRemote`. | AC-1…AC-7 pass in both modes only with the static `remotes` (`APP_HOST_STATIC_REMOTES=1`). |
| **blocker** | At least one AC fails in at least one mode with both loaders. Document the failing AC, mode and root cause. | Same, for the runtime loader and the static experiment. |

## Risks & Pitfalls

| Risk | Impact | Mitigation |
|---|---|---|
| Shell accidentally declares `useCaseA` | Hides nested-federation problems, invalid spike | FR-03, NFR-03 |
| Version drift in any app | `strictVersion` aborts loading | NFR-01, single lockfile |
| Duplicate `createContext` across module copies | Empty contexts in Use case A, user appears logged out | FR-14 (Symbol.for registry) |
| Dev and build share modules differently | False positive in dev only | NFR-04, acceptance matrix |
| Relative `base` in remote builds | Remote chunks requested from host origin (404) | NFR-06 |
| Unshared subpaths (`react/jsx-runtime`, `react-dom/client`) | Second React-related chunk, AC-7 fails | NFR-02 |
| Nested `BrowserRouter` in App Host or Use case A | Broken history, duplicate router context | FR-08, FR-10 |
| Failed remote entry memoised by the browser (Option A) | Retry shows the same error until reload | Re-register the remote with `?retry=n` (`loadRemoteApp`, `loadUseCase`) |

## Result

| Field | Value |
|---|---|
| Outcome | works / fallback / blocker |
| Approach | _runtime `registerRemotes` + `loadRemote` (Option A) or static `remotes` (Option B), context registry used: yes/no_ |
| Problems found | _…_ |
| Date / versions tested | _…_ |
