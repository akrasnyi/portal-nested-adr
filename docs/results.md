# Nested Module Federation spike: results

Chain: shell -> app-host (remote of shell, host of Use case A) -> Use case A. The shell knows nothing about Use case A.

## Environment

Node v26.4.0, npm (public registry via `.npmrc`). Exact pins: vite 5.4.14, @vitejs/plugin-react 4.3.3, babel-plugin-react-compiler 19.1.0-rc.3,
typescript 5.5.4, @module-federation/vite 1.7.2, react / react-dom 19.0.0, react-router + react-router-dom 6.30.4,
@tanstack/react-query 5.90.2. Headless Chromium (playwright 1.64.1 driving the cached chromium_headless_shell-1228).

`npm ls @module-federation/runtime react react-dom react-router @portal/contract` (trimmed): exactly one version of each.

    ├── @module-federation/runtime@0.17.1
    ├─┬ @module-federation/vite@1.7.2
    │ └── @module-federation/runtime@0.17.1 deduped
    ├── react@19.0.0 (every consumer "deduped")
    ├── react-dom@19.0.0, react-router@6.30.4
    └── @portal/contract@0.1.0 -> ./packages/contract (shell, app-host, Use case A all deduped to it)

`npm run typecheck` (tsc per app, contract, node configs) clean.

## Results

Evidence comes from `data-check` rows of the Use case A ProofPanel plus Playwright assertions (script outside the repo, see "Reproduce").
Screenshots: `docs/img/use-case-a-proof-{dev,build}.png` (dashboard), `*-switched.png` (after user switch), `use-case-a-report-{dev,build}.png` (deep link).

| Check | dev (`:5170`) | build (`:4174/V1`) | Evidence |
|---|---|---|---|
| react (`window.__shell.React === React` in Use case A) | PASS | PASS | React 19.0.0 |
| query-client (same instance, `["tenant"]` served from shell cache) | PASS | PASS | `tenant={"id":"tenant-42","name":"Acme Corp"} fetched=false` |
| auth-context identity | PASS | PASS | |
| contract-module (every export identical to shell's namespace) | PASS | PASS | 10 exports (dev), 11 (build; extra `default` key in the built namespace) |
| auth-user | PASS | PASS | "Alice Admin" |
| user switch in shell select -> Use case A re-renders | PASS | PASS | Use case A shows "Uma Use-Case", header shows the same |
| router (same router contexts, in router context, window path matches) | PASS | PASS | `router path /app-host/use-case-a; window path /V1/app-host/use-case-a` (build) |
| Use case A navigate -> shell header | PASS | PASS | `useNavigate("reports/42")`: window `/app-host/use-case-a/reports/42` (build: `/V1/...`), shell header same, breadcrumbs `Home > App Host > Use case A > Report 42` |
| browser Back | PASS | PASS | returns to `/app-host/use-case-a` |
| breadcrumbs from 3 levels | PASS | PASS | `Home > App Host > Use case A > Dashboard` |
| share-scope | PASS | PASS | one react provider: `portal_host@19.0.0 (loaded)`; instances `[portal_host, appHost, useCaseA]` |
| one React copy loaded | PASS | PASS | dev: React core only in `5170/.../__mf__virtual_portal_host__prebuild__react__prebuild____js.js`; build: only `shell/assets/index-CJHwXufJ.js`. 0 React-core files fetched from 5174/5175 or `mf/app-host`, `mf/use-case-a` |
| no "Invalid hook call" / console errors | PASS | PASS | 0 console errors, 0 page errors, all flows |
| direct deep link + reload `/app-host/use-case-a/reports/42` | PASS | PASS | build: `/V1/app-host/use-case-a/reports/42` served shell index.html (200), all 7 checks pass, also after reload |
| user `billing` on `/app-host/use-case-a` | PASS | PASS | redirected to `/` (build: `/V1`), 0 requests to `:5174`/`:5175` (dev) or `/V1/mf/app-host|use-case-a/` (build) |

Counting method for "one React copy": every JS response body fetched during the session was scanned for React core (`.cloneElement =`)
and react-dom (`.createPortal =`) definitions.

Server checks (`scripts/serve.mjs`): `/V1/app-host/use-case-a/reports/42` 200 html; `/V1/mf/use-case-a/remoteEntry.js` 200; `/V1/mf/use-case-a/nope.js` 404;
`/V1/mf/nope/x.js` 404; `/other` 404; with `--block=use-case-a` `/V1/mf/use-case-a/remoteEntry.js` 404 while app-host is still 200.

## Federation instance finding (app-host)

In `apps/app-host/src/load-use-case.ts` the module-level `registerRemotes` / `loadRemote` from `@module-federation/runtime` hit the **right** instance
in both modes. At the first call, `getInstance()?.name === "appHost"` and `__FEDERATION__.__INSTANCES__` was `[portal_host, appHost]`
(`useCaseA` appears only after registration, then `[portal_host, appHost, useCaseA]`). app-host bundles its own runtime copy, and its `remoteEntry` init sets
that copy's module-level instance to `appHost`. So the planned `getInstance(i => i.name === "appHost")` fallback was **not needed** and is not used.
Risk left: this relies on app-host's app code and its remoteEntry sharing one runtime chunk; the probe (`globalThis.__appHostProbe`) stays in the code to detect a regression.

Share scope: `__SHARE__` has one map per instance, but all three point at the same entry (`from: "portal_host"`, `useIn: portal_host|appHost|useCaseA`,
`loaded: true`). Counting providers per instance gives a false "3 providers"; the ProofPanel counts by `entry.from`.

## Deviations from the brief

- `useCanAccess(moduleId)` instead of `canAccess(moduleId)`: it calls `useAuth`, so it is a hook and must be named as one.
- Dev vs prod remote entry: two files, `public/config.dev.json` (absolute `http://localhost:5174/...`) and `public/config.json` (relative `mf/app-host/remoteEntry.js`),
  chosen by `import.meta.env.DEV`. Simplest option with no plugin; the dev file is also copied to the prod dist and is harmless.
- Config is fetched from `${BASE_URL}config.json`, not `./config.json`, because with `base: /V1/mf/shell/` a relative fetch breaks on deep links.
- `@module-federation/runtime` added as a root dependency at 0.17.1 (the version the plugin resolves; one copy in the tree).
- `react-router` added as an explicit dependency (6.30.4) so it can be shared and its version read from root `node_modules`.
- `erasableSyntaxOnly` from the reference tsconfig dropped: it needs TS >= 5.8 and the pinned TS is 5.5.4.
- Remotes have a stub `index.html` (Vite build fails with "Could not resolve entry module index.html" without one). Not a standalone mode.
- No `manifest` (default false in 1.7.2); entries are `remoteEntry.js`, as in the reference.
- `useBreadcrumb` orders segments by first-render order (render is parent-first, effects child-first), via a module counter in the singleton contract.
- Verification scripts live outside the repo (`.../scratchpad/adr-verify/verify.mjs`), as requested; not committed.

## Observations and open issues

- Every remote `dist` still contains its own fallback copy of React and react-dom (1 file each in shell, app-host and Use case A: no `import: false` in 1.7.2).
  They are not requested at runtime when the share scope provides React. A failed/mismatched `strictVersion` or a missing provider is where a second copy could appear:
  that is for the failure experiments, not covered here.
- The proof checks were only ever observed passing. No negative control (deliberately breaking sharing to see a check fail) was run, so "can the check actually fail" is unproven, except `share-scope`, which initially reported FAIL (3 providers) because of the per-instance counting issue above.
- Dev: the user switch does not rewrite `?user=` in the URL (the select persists to localStorage only).
- Dev: `remoteEntry.js` of the remotes is requested more than once in a session (second hit 304); not investigated.
- Cold-load waterfall/timing (plan §10 step 6), killing remotes, strictVersion mismatch and the exposed-contract comparison were not part of this spike.
- 1.7.2 build prints an `eval` warning from `@module-federation/sdk` (harmless, from the plugin's dependency).

## Reproduce

    npm install
    npm run typecheck
    npm run dev                        # shell 5170, app-host 5174, Use case A 5175 -> http://localhost:5170/app-host/use-case-a
    npm run build && npm run serve     # -> http://localhost:4174/V1/app-host/use-case-a  (serve.mjs --block=<app>, PORT=... supported)
