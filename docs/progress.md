# Requirements progress (runtime API)

Tracks [requirements.md](requirements.md) against the code in this repo. The shell's only remote is static (build config); App Host
loads Use case A at runtime.

Name mapping: App Host = `apps/app-host` (`appHost`, route `/app-host`), Use case A = `apps/use-case-a` (`useCaseA`, route `use-case-a`),
LayoutProvider = `BreadcrumbsProvider`, diagnostics = Use case A ProofPanel.

## How the loading works here

- **Shell → App Host (static):** [vite.config.ts](../apps/shell/vite.config.ts) declares `appHost` in `remotes` with `shareStrategy: "loaded-first"`.
  The route in [router.tsx](../apps/shell/src/app/router.tsx) loads `import("appHost/App")`, typed in [remotes.d.ts](../apps/shell/src/remotes.d.ts).
  The entry is `/V1/mf/app-host/remoteEntry.js` in the build, `http://localhost:5174/remoteEntry.js` in dev, or `VITE_APP_HOST_URL` (read at build time).
- **App Host → Use case A (runtime):** [load-use-case.ts](../apps/app-host/src/load-use-case.ts) registers the remote on the first render of its route
  and loads it with `loadRemote`. The entry is `entry` in [use-cases.ts](../apps/app-host/src/use-cases.ts): `VITE_USE_CASE_A_URL` (build time) or the dev/build default.
- **Retry:** App Host's loader catches a failed `loadRemote`, re-registers the same name with `?retry=n` and `{ force: true }`, then rethrows.
  It is marked `canRetryLoad`, so the boundary ([remote-boundary.tsx](../packages/contract/src/remote-boundary.tsx)) offers Retry for a load error.
  The shell's App Host route is not marked, so its load error offers only "Reload page" (Retry for App Host is a page reload: the browser module map and the MF runtime keep the failed static remote).
  A render error, or any error within 10 s of a remount, offers "Reload page" ([recovery.ts](../packages/contract/src/recovery.ts)).
  Use case A's Retry was checked in the production build with the block experiment (no document reload); dev not repeated.
- **Entry timing:** App Host's `remoteEntry.js` is requested when `/app-host` opens, not on the home page (`loaded-first`). Use case A's when its route opens.

Status: ✅ Passed · 🟡 In progress / gap. Statuses come from the code and the evidence in [results.md](results.md) and
[results-failures.md](results-failures.md).
Rows for the static remote and the env URLs were re-checked with the change (dev and prod); other rows come from earlier runs.

## Functional requirements

| ID | Status | Where | Notes / gap |
|---|---|---|---|
| FR-01 | 🟡 | [app-providers.tsx](../apps/shell/src/core/providers/app-providers.tsx), [App.tsx](../apps/shell/src/app/App.tsx), [StubAuthProvider.tsx](../apps/shell/src/features/auth/StubAuthProvider.tsx) | One QueryClient, fake-user AuthProvider, all at root. Deviations: `createBrowserRouter` + `RouterProvider` instead of `BrowserRouter`; `BreadcrumbsProvider` instead of a `LayoutProvider` |
| FR-02 | ✅ | [router.tsx](../apps/shell/src/app/router.tsx), [vite.config.ts](../apps/shell/vite.config.ts), [remote-boundary.tsx](../packages/contract/src/remote-boundary.tsx) | `/app-host/*` renders `RemoteBoundary` → `import("appHost/App")` from the static remote. The AC-1 evidence in results.md is from the earlier runtime shell; the static remote was re-checked (ProofPanel 7/7 in dev and prod) |
| FR-03 | ✅ | [vite.config.ts](../apps/shell/vite.config.ts), [router.tsx](../apps/shell/src/app/router.tsx) | The shell declares only `appHost`, in its build config. `grep -rniE "use-?case\|useCase\|use_case" apps/shell` finds nothing outside `dist` |
| FR-04 | ✅ | [PortalLayout.tsx](../apps/shell/src/widgets/portal-layout/PortalLayout.tsx), [StubAuthProvider.tsx](../apps/shell/src/features/auth/StubAuthProvider.tsx) | `<select>` with 4 fake users (also `?user=`); header name re-renders. "user switch" PASS in dev and build (results.md) |
| FR-05 | 🟡 | [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx), [PortalLayout.tsx](../apps/shell/src/widgets/portal-layout/PortalLayout.tsx) | Context API exists (`useBreadcrumb`, `useBreadcrumbs`). Gap: no DOM mount node (`#shell-breadcrumbs`) for portals; breadcrumbs render in the shell `<nav>` |
| FR-06 | ✅ | [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | Exposes `./App` |
| FR-07 | 🟡 | [use-cases.ts](../apps/app-host/src/use-cases.ts), [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | Runtime registration, no remote in any build config. URL in `USE_CASES`: `VITE_USE_CASE_A_URL` (build time), defaulting to `http://localhost:5175/remoteEntry.js` (dev) and `mf/use-case-a/remoteEntry.js` (build). Gap: `remoteEntry.js` instead of `mf-manifest.json` |
| FR-08 | ✅ | [app-host/App.tsx](../apps/app-host/src/App.tsx), [use-cases.ts](../apps/app-host/src/use-cases.ts) | Relative `use-case-a/*` route built from `USE_CASES`; `RemoteBoundary` → `loadUseCase` → `loadRemote("useCaseA/App")`. No own Router in App Host |
| FR-09 | ✅ | [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx), [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx), [vite.config.ts](../apps/use-case-a/vite.config.ts) | Exposes `./App`. Breadcrumb "Use case A" and the ProofPanel `auth-user` row show `useAuth().user.name` (results.md) |
| FR-10 | 🟡 | [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx), [Dashboard.tsx](../apps/use-case-a/src/pages/Dashboard.tsx), [ReportDetails.tsx](../apps/use-case-a/src/pages/ReportDetails.tsx) | Index + `reports/:reportId`, `Link` + `useNavigate`, no own Router. Back checked in dev and build (results.md). Gap: Forward not recorded |
| FR-11 | 🟡 | [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx), [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx) | (a) breadcrumb via context, removed on unmount ✅ (results.md, 3-level breadcrumbs). (b) gap: no `createPortal` into the shell DOM |
| FR-12 | 🟡 | [bootstrap.tsx](../apps/shell/src/bootstrap.tsx) | Globals exist as `window.__shell.{React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule}`, always set. Gaps: names differ from `__shellReact` / `__shellQueryClient`; not behind dev or `VITE_MF_DEBUG` |
| FR-13 | 🟡 | [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx) | All checks exist (react, query-client, auth-context, contract-module, auth-user, router, share-scope). Gap: they go to a UI table, not `[mf-check]` console logs |
| FR-14 | 🟡 | [auth.tsx](../packages/contract/src/auth.tsx), [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx) | Plain `createContext`; identity relies on `@portal/contract` being a shared singleton (checked by `auth-context` / `contract-module`). Gap: no `Symbol.for` registry |
| FR-15 | 🟡 | [app-host/vite.config.ts](../apps/app-host/vite.config.ts), [App.tsx](../apps/app-host/src/App.tsx) | The use-case loader is runtime; the shell's App Host route is static (FR-02). Gap: no `VITE_USE_CASE_A_LOADER=static\|runtime` switch |

## Non-functional requirements

| ID | Status | Where | Notes / gap |
|---|---|---|---|
| NFR-01 | ✅ | [package.json](../package.json), [federation-shared.ts](../config/federation-shared.ts) | Exact pins in the root `package.json` (npm workspaces, apps do not redeclare them), one `package-lock.json`. `npm ls` shows one version each (results.md). `@portal/contract` uses `^` by design (ADR-0002) |
| NFR-02 | ✅ | [federation-shared.ts](../config/federation-shared.ts) | One shared list for all apps, `default` scope, `react-router` also shared. Subpaths `react/jsx-runtime`, `react/jsx-dev-runtime` and `react-dom/client` are listed too. Build check: Use case A and the shell no longer fetch their own `jsx-runtime` copy (only the shell's); the plugin still emits a fallback chunk per app, which is not requested |
| NFR-03 | ✅ | see FR-03 | Shell knows only `appHost`; no use case in its code or config |
| NFR-04 | 🟡 | [results.md](results.md) | Dev and build are both verified for the existing checks. Rows with gaps (FR-05, FR-11b, FR-13, AC-5 Forward) are not |
| NFR-05 | 🟡 | [vite.config.ts](../apps/shell/vite.config.ts), [use-cases.ts](../apps/app-host/src/use-cases.ts) | `VITE_APP_HOST_URL` (shell) and `VITE_USE_CASE_A_URL` (App Host) take a full `remoteEntry.js` URL, read at build time; the defaults are unchanged. Gap: changing an origin needs a rebuild, not a config file |
| NFR-06 | 🟡 | [apps/*/vite.config.ts](../apps/shell/vite.config.ts), [serve.mjs](../scripts/serve.mjs) | `target: esnext` ✅ in all apps. `base` is an absolute path on one origin (`/V1/mf/<app>/`), not an absolute URL; the shell's App Host entry is `/V1/mf/app-host/remoteEntry.js` (same origin). No 404s in the build for the healthy chain (results.md) |
| NFR-07 | 🟡 | [app-host/vite.config.ts](../apps/app-host/vite.config.ts), [use-case-a/vite.config.ts](../apps/use-case-a/vite.config.ts) | Ports 5170 / 5174 / 5175 with `strictPort` ✅. CORS on the App Host and Use case A dev servers ✅. Gap: no `vite preview` servers; the build runs on single-origin `:4174` (`scripts/serve.mjs`), so preview CORS does not apply |
| NFR-08 | ✅ | [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx) (`share-scope`), [vite.config.ts](../apps/shell/vite.config.ts), [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | One React provider (`portal_host@19.0.0`) and one React core file fetched, in dev and build (results.md). `shareStrategy`: the shell sets `loaded-first` (static remote; the home page fetches no remote), App Host and Use case A keep the plugin default `version-first` |
| NFR-09 | ✅ | [use-case-a/vite.config.ts](../apps/use-case-a/vite.config.ts) | `UCA_REACT_REQUIRED=19.1.0` makes the strictVersion error fire and the boundary contains it (results-failures.md, section 4). Checked in the build only; dev not repeated; only react tested |
| NFR-10 | 🟡 | [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx) | Gap: no `[mf-check]` prefix, no `VITE_MF_DEBUG` flag |
| NFR-11 | 🟡 | [dev.mjs](../scripts/dev.mjs), [package.json](../package.json) | `npm run dev` starts all three apps (one command). Production is two (`npm run build && npm run serve`); names differ from `dev:all` / `preview:all` |
| NFR-12 | ✅ | — | No SSR, stub auth, no federated types required |

## Acceptance matrix

Dev and build columns are taken from [results.md](results.md) (the "Results" table) and not re-run here.

| AC | Criterion | Dev | Build | Notes |
|---|---|---|---|---|
| AC-1 | Use case A inside App Host inside shell | ✅ | ✅ | results.md: "breadcrumbs from 3 levels" (`Home > App Host > Use case A > Dashboard`) and "direct deep link + reload". URL `/app-host/use-case-a` (build: `/V1/...`) |
| AC-2 | `window.__shell.React === React` in Use case A | ✅ | ✅ | results.md "react" row. Not a `[mf-check]` log (FR-13). Global is `window.__shell.React`, not `__shellReact` |
| AC-3 | Same QueryClient | ✅ | ✅ | results.md "query-client" row: `["tenant"]` served from the shell's cache, `fetched=false` |
| AC-4 | `useAuth()` = shell user, updates on switch | ✅ | ✅ | results.md "auth-user" and "user switch" rows |
| AC-5 | Router navigation + Back/Forward | 🟡 | 🟡 | navigate ✅ and browser Back ✅ (dev and build). Forward not recorded |
| AC-6 | Breadcrumbs + portal into shell DOM | 🟡 | 🟡 | Breadcrumbs ✅. Portal not implemented (FR-11b) |
| AC-7 | One React chunk | ✅ | ✅ | results.md "one React copy loaded": 0 React-core files from App Host or Use case A |
| AC-8 | Fallback loader | — | — | Not applicable: the runtime loader is the only loader in this branch (see FR-15) |

## Result

| Field | Value |
|---|---|
| Outcome | _pending_ |
| Approach | _runtime `registerRemotes` + `loadRemote`; context registry: no (singleton contract)_ |
| Problems found | _pending_ |
| Date / versions tested | _pending_ |
