# Requirements progress (runtime API)

Tracks [requirements.md](requirements.md) against the code in this repo. Code places specific to the runtime API are tagged
`// Option A: ...` in the source (the runtime API and the URL source). JSON files cannot hold comments, so
[public/config.json](../apps/shell/public/config.json) and [config.dev.json](../apps/shell/public/config.dev.json) are described here only.

Name mapping: App Host = `apps/app-host` (`appHost`, route `/app-host`), Use case A = `apps/use-case-a` (`useCaseA`, route `use-case-a`),
LayoutProvider = `BreadcrumbsProvider`, diagnostics = Use case A ProofPanel.

## How the loading works here

- **Shell → App Host:** [federation.ts](../apps/shell/src/core/federation/federation.ts) `initFederation` registers the remotes from
  `config.json` (fetched before render in [bootstrap.tsx](../apps/shell/src/bootstrap.tsx)); the route loads them with `loadRemote`.
  The entry URL is resolved in [resolve-remote-entry.ts](../apps/shell/src/core/federation/resolve-remote-entry.ts) and read from
  [runtime-config.ts](../apps/shell/src/shared/config/runtime-config.ts).
- **App Host → Use case A:** [load-use-case.ts](../apps/app-host/src/load-use-case.ts) registers the remote on the first render of its route
  and loads it with `loadRemote`. The entry is `entry` in [use-cases.ts](../apps/app-host/src/use-cases.ts) (a URL in code).
- **Retry:** both loaders catch a failed `loadRemote`, re-register the same name with `?retry=n` and `{ force: true }`, then rethrow.
  Both are marked `canRetryLoad`, so the boundary ([remote-boundary.tsx](../packages/contract/src/remote-boundary.tsx)) offers Retry for a load error;
  a render error, or any error within 10 s of a remount, offers "Reload page" ([recovery.ts](../packages/contract/src/recovery.ts)). Load errors
  cannot be retried in place with build-time `remotes` (the reason is in recovery.ts). Retry checked in the production build with the block experiment (no document reload); dev not repeated.
- **Entry timing:** Use case A's `remoteEntry.js` is requested only when its route opens.

Status: ✅ Passed · 🟡 In progress / gap. Statuses come from the code and the evidence in [results.md](results.md) and
[results-failures.md](results-failures.md).
Nothing was re-run for this document.

## Functional requirements

| ID | Status | Where | Notes / gap |
|---|---|---|---|
| FR-01 | 🟡 | [app-providers.tsx](../apps/shell/src/core/providers/app-providers.tsx), [App.tsx](../apps/shell/src/app/App.tsx), [StubAuthProvider.tsx](../apps/shell/src/features/auth/StubAuthProvider.tsx) | One QueryClient, fake-user AuthProvider, all at root. Deviations: `createBrowserRouter` + `RouterProvider` instead of `BrowserRouter`; `BreadcrumbsProvider` instead of a `LayoutProvider` |
| FR-02 | ✅ | [router.tsx](../apps/shell/src/app/router.tsx), [federation.ts](../apps/shell/src/core/federation/federation.ts), [remote-boundary.tsx](../packages/contract/src/remote-boundary.tsx) | Option A: `/app-host/*` renders `RemoteBoundary` → `loadRemoteApp("appHost")` → `loadRemote("appHost/App")`, no `import("appHost/App")`. Shown in results.md (AC-1) |
| FR-03 | ✅ | [vite.config.ts](../apps/shell/vite.config.ts), [config.json](../apps/shell/public/config.json), [federation.ts](../apps/shell/src/core/federation/federation.ts) | Option A: the shell registers only `appHost`, from `config.json`. `grep -rn "useCaseA\|use-case-a" apps/shell` finds nothing. The shell build has no `remotes` |
| FR-04 | ✅ | [PortalLayout.tsx](../apps/shell/src/widgets/portal-layout/PortalLayout.tsx), [StubAuthProvider.tsx](../apps/shell/src/features/auth/StubAuthProvider.tsx) | `<select>` with 4 fake users (also `?user=`); header name re-renders. "user switch" PASS in dev and build (results.md) |
| FR-05 | 🟡 | [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx), [PortalLayout.tsx](../apps/shell/src/widgets/portal-layout/PortalLayout.tsx) | Context API exists (`useBreadcrumb`, `useBreadcrumbs`). Gap: no DOM mount node (`#shell-breadcrumbs`) for portals; breadcrumbs render in the shell `<nav>` |
| FR-06 | ✅ | [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | Exposes `./App` |
| FR-07 | 🟡 | [use-cases.ts](../apps/app-host/src/use-cases.ts), [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | Runtime registration, no remote in any build config. URL in `USE_CASES`: `http://localhost:5175/remoteEntry.js` (dev), `mf/use-case-a/remoteEntry.js` (build). Gaps: not a `VITE_*` env variable; `remoteEntry.js` instead of `mf-manifest.json` |
| FR-08 | ✅ | [app-host/App.tsx](../apps/app-host/src/App.tsx), [use-cases.ts](../apps/app-host/src/use-cases.ts) | Relative `use-case-a/*` route built from `USE_CASES`; `RemoteBoundary` → `loadUseCase` → `loadRemote("useCaseA/App")`. No own Router in App Host |
| FR-09 | ✅ | [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx), [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx), [vite.config.ts](../apps/use-case-a/vite.config.ts) | Exposes `./App`. Breadcrumb "Use case A" and the ProofPanel `auth-user` row show `useAuth().user.name` (results.md) |
| FR-10 | 🟡 | [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx), [Dashboard.tsx](../apps/use-case-a/src/pages/Dashboard.tsx), [ReportDetails.tsx](../apps/use-case-a/src/pages/ReportDetails.tsx) | Index + `reports/:reportId`, `Link` + `useNavigate`, no own Router. Back checked in dev and build (results.md). Gap: Forward not recorded |
| FR-11 | 🟡 | [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx), [use-case-a/App.tsx](../apps/use-case-a/src/App.tsx) | (a) breadcrumb via context, removed on unmount ✅ (results.md, 3-level breadcrumbs). (b) gap: no `createPortal` into the shell DOM |
| FR-12 | 🟡 | [bootstrap.tsx](../apps/shell/src/bootstrap.tsx) | Globals exist as `window.__shell.{React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule}`, always set. Gaps: names differ from `__shellReact` / `__shellQueryClient`; not behind dev or `VITE_MF_DEBUG` |
| FR-13 | 🟡 | [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx) | All checks exist (react, query-client, auth-context, contract-module, auth-user, router, share-scope). Gap: they go to a UI table, not `[mf-check]` console logs |
| FR-14 | 🟡 | [auth.tsx](../packages/contract/src/auth.tsx), [breadcrumbs.tsx](../packages/contract/src/breadcrumbs.tsx) | Plain `createContext`; identity relies on `@portal/contract` being a shared singleton (checked by `auth-context` / `contract-module`). Gap: no `Symbol.for` registry |
| FR-15 | 🟡 | [app-host/vite.config.ts](../apps/app-host/vite.config.ts), [App.tsx](../apps/app-host/src/App.tsx) | The runtime loader is the only loader in this branch. Gap: no `VITE_USE_CASE_A_LOADER=static\|runtime` switch |

## Non-functional requirements

| ID | Status | Where | Notes / gap |
|---|---|---|---|
| NFR-01 | ✅ | [package.json](../package.json), [federation-shared.ts](../config/federation-shared.ts) | Exact pins in the root `package.json` (npm workspaces, apps do not redeclare them), one `package-lock.json`. `npm ls` shows one version each (results.md). `@portal/contract` uses `^` by design (ADR-0002) |
| NFR-02 | ✅ | [federation-shared.ts](../config/federation-shared.ts) | One shared list for all apps, `default` scope, `react-router` also shared. Subpaths `react/jsx-runtime`, `react/jsx-dev-runtime` and `react-dom/client` are listed too. Build check: Use case A and the shell no longer fetch their own `jsx-runtime` copy (only the shell's); the plugin still emits a fallback chunk per app, which is not requested |
| NFR-03 | ✅ | see FR-03 | Shell knows only `appHost` |
| NFR-04 | 🟡 | [results.md](results.md) | Dev and build are both verified for the existing checks. Rows with gaps (FR-05, FR-11b, FR-13, AC-5 Forward) are not |
| NFR-05 | 🟡 | [federation.ts](../apps/shell/src/core/federation/federation.ts), [runtime-config.ts](../apps/shell/src/shared/config/runtime-config.ts), [use-cases.ts](../apps/app-host/src/use-cases.ts) | Option A: URLs come from `config.json` (shell) and `USE_CASES` (App Host), not from `VITE_APP_HOST_URL` / `VITE_USE_CASE_A_URL`. Changing a remote origin is a config or code change |
| NFR-06 | 🟡 | [apps/*/vite.config.ts](../apps/shell/vite.config.ts), [serve.mjs](../scripts/serve.mjs) | `target: esnext` ✅ in all apps. `base` is an absolute path on one origin (`/V1/mf/<app>/`), not an absolute URL. No 404s in the build for the healthy chain (results.md) |
| NFR-07 | 🟡 | [app-host/vite.config.ts](../apps/app-host/vite.config.ts), [use-case-a/vite.config.ts](../apps/use-case-a/vite.config.ts) | Ports 5170 / 5174 / 5175 with `strictPort` ✅. CORS on the App Host and Use case A dev servers ✅. Gap: no `vite preview` servers; the build runs on single-origin `:4174` (`scripts/serve.mjs`), so preview CORS does not apply |
| NFR-08 | ✅ | [ProofPanel.tsx](../apps/use-case-a/src/proof/ProofPanel.tsx) (`share-scope`), [app-host/vite.config.ts](../apps/app-host/vite.config.ts) | One React provider (`portal_host@19.0.0`) and one React core file fetched, in dev and build (results.md). `shareStrategy` is the plugin default `version-first` (not set in any app) |
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
