# Failure isolation and version mismatch experiments

Same spike, same pins (`@module-federation/vite` 1.7.2, react 19.0.0 shared with `singleton + strictVersion + exact requiredVersion`).
All runs: production build served by `scripts/serve.mjs` on :4174 unless noted; headless Chromium via Playwright (script outside the repo, not committed).
Shell, app-hub and Use case A each have their own `RemoteBoundary`: the shell's wraps app-hub, app-hub's wraps Use case A.

## Switches added (all default to the healthy behaviour)

| Switch | Where | Effect |
|---|---|---|
| route `crash` in Use case A + link "Crash (failure experiment)" on the Use case A dashboard | `apps/use-case-a/src/App.tsx`, `pages/Dashboard.tsx` | `/app-hub/use-case-a/crash` throws during render. Always present, harmless unless visited |
| `UCA_REACT_REQUIRED=19.1.0` at **build** time | `apps/use-case-a/vite.config.ts` | Use case A's `requiredVersion` for react and react-dom becomes 19.1.0 (shell provides 19.0.0) |
| `UCA_STRICT=false` (only with the above) | same | same mismatch with `strictVersion: false` |
| `serve.mjs --block=<app>` | existing | 404 for `/V1/mf/<app>/*` |

Build the mismatch variants with `cd apps/use-case-a && UCA_REACT_REQUIRED=19.1.0 ../../node_modules/.bin/vite build` (`npx vite` lost its binary with an env prefix here).
Restore with `cd apps/use-case-a && ../../node_modules/.bin/vite build` (done; `apps/use-case-a/dist` is healthy, 7/7 ProofPanel checks PASS afterwards).

## Summary

| # | Experiment | Result |
|---|---|---|
| 1 | App Hub unavailable | PASS |
| 2 | Use case A unavailable (build, and dev with only the Use case A server stopped) | PASS (isolation). retry see 2b |
| 2b | Remote becomes available again, user clicks Retry / returns (both levels) | FAIL before, **PASS after** `?retry=n` re-registration fix |
| 3 | Use case A throws in render | isolation PASS. Recovery on navigation: **FAIL before fix, PASS after fix** |
| 4 | strictVersion mismatch | strict: Use case A fails to load, contained by app-hub's boundary (PASS isolation). `strictVersion:false`: warning only, Use case A runs on the shell's React |
| 5 | Cold-load waterfall | 3 serial `remoteEntry.js` hops, see table |

## 1. App Hub unavailable

Reproduce: `node scripts/serve.mjs --block=app-hub`, open `http://localhost:4174/V1/app-hub/use-case-a?user=admin`.
Expected: shell fallback `role=alert` naming `appHub` in the content area, shell header alive, no request to `/V1/mf/use-case-a/*`.
Actual: alert `Module "appHub" is currently unavailable.` + Retry; `user-select` present (header alive); requests to `/V1/mf/use-case-a/`: 0.

    404 /V1/mf/app-hub/remoteEntry.js
    error: [ Federation Runtime ]: remoteEntryExports is undefined {"name":"appHub","entry":"http://localhost:4174/V1/mf/app-hub/remoteEntry.js",...}

Evidence: `docs/img/failure-1-app-hub.png`. **PASS**.

## 2. Use case A unavailable

Reproduce: `node scripts/serve.mjs --block=use-case-a`, open `/V1/app-hub/use-case-a`. Dev variant: `npm run dev`, then kill only the process listening on 5175, open `http://localhost:5170/app-hub/use-case-a`.
Actual (build and dev identical): app-hub sidebar and "App Hub" heading stay, content shows `Module "useCaseA" is currently unavailable.` (app-hub's boundary); shell header alive; clicking the sidebar "Catalog" link works (Catalog heading rendered, no alert).

    build: 404 /V1/mf/use-case-a/remoteEntry.js          dev: net::ERR_CONNECTION_REFUSED http://localhost:5175/remoteEntry.js
    error: [ Federation Runtime ]: remoteEntryExports is undefined {"name":"useCaseA","entry":".../use-case-a/remoteEntry.js",...}   (logged by app-hub's runtime)

Evidence: `docs/img/failure-2-use-case-a.png` (build), `failure-2-use-case-a-dev.png`. **PASS**.

### 2b. Retry after the remote comes back

**Before (FAIL):** Playwright `ctx.route(Use case A -> 404)`, load `/V1/app-hub/use-case-a`, unroute, then sidebar link / Catalog then Use case A / Retry button: the fallback stayed and no new `remoteEntry.js` request was made (one 404 in the session).
Cause (probe): the browser's module map memoises a failed dynamic `import()` per URL until reload. After unblocking, `import(".../remoteEntry.js")` failed with no request while `?x=1` on the same URL loaded.
(No screenshot of the pre-fix state: it cannot be regenerated without reverting the fix.)

**Fix (PASS), diff summary:**
- `apps/app-hub/src/load-use-case.ts` and `apps/shell/src/core/federation/federation.ts` (`loadRemoteApp`): wrap `loadRemote` in try/catch; on failure bump a per-remote counter `n`, call
  `registerRemotes([{ name, entry: <entry>?retry=n, type: "module" }], { force: true })` and rethrow. The next attempt loads the new URL. Healthy path unchanged: no query string unless a load failed.
  API check: `registerRemotes(remotes, options)` with `options.force` exists in `node_modules/@module-federation/runtime-core/dist/index.esm.js` lines 2692-2696 (`force: options?.force`) and 2797 (`if (options?.force)` removes the registered remote via `removeRemote` and pushes the new one); the runtime re-exports it (`runtime/dist/index.esm.js:53`). Runtime logs a warn "already registered ... overriding".
- `packages/contract/src/remote-boundary.tsx`: `componentDidCatch` drops the cached rejected `lazy`, so a remount (returning from the catalog / Home) calls the loader again (before this, only the Retry button dropped it).

Verification (build, `serve.mjs --block=<app>` started, page loaded and fallback shown, serve killed and restarted unblocked on :4174 **without reloading the page**):

| Blocked | Action | Requests | Result |
|---|---|---|---|
| Use case A | Retry button | `404 /V1/mf/use-case-a/remoteEntry.js`, `200 /V1/mf/use-case-a/remoteEntry.js?retry=1` | Use case A renders, ProofPanel 7/7 pass |
| Use case A | sidebar Catalog, then Use case A | same two | ProofPanel 7/7 pass |
| app-hub | Retry button | `404 /V1/mf/app-hub/remoteEntry.js`, `200 ...app-hub/remoteEntry.js?retry=1`, then `200 /V1/mf/use-case-a/remoteEntry.js` | full chain renders, 7/7 pass |
| app-hub | shell header Home, then App Hub | `404`, `200 ...?retry=1` | app-hub renders (h2 App Hub + Catalog), no alert |

Side effects with `force: true`: after recovery the share scope still has one react entry `19.0.0 from=portal_host` with `useIn=portal_host|appHub|useCaseA` for all three instances; `share-scope` and `react` checks pass; the only React core file fetched is the shell's `index-CJHwXufJ.js`; 0 "Invalid hook call", 0 page errors.
Limits: when the shell-level app-hub is replaced via `force`, instance state of the old appHub remote was never initialised (it failed), so nothing was lost; a force re-register of a remote that had loaded successfully is not exercised (it only happens after a failure). Not tested in dev.
Evidence: `docs/img/failure-2b-use-case-a-blocked.png`, `failure-2b-use-case-a-retry-fixed.png`, `failure-2b-use-case-a-nav-fixed.png`, `failure-2b-app-hub-blocked.png`, `failure-2b-app-hub-nav-fixed.png`.

## 3. Use case A throws during render

Reproduce: healthy build, open `/V1/app-hub/use-case-a?user=admin`, click "Crash (failure experiment)".
Actual: URL `/V1/app-hub/use-case-a/crash`; app-hub's fallback only (alert `Module "useCaseA"...`), app-hub sidebar and shell header alive. **Isolation PASS**.

    error: Error: Use case A crash route: deliberate render error  at fe (http://localhost:4174/V1/mf/use-case-a/assets/App-sVcSAH64.js...)   (x3, React logs and rethrows)

Recovery, before the fix (boundary state kept on the same route element):

| Action while failed | Before fix | After fix |
|---|---|---|
| sidebar "Use case A" (`/app-hub/use-case-a`) | **stuck** on fallback | Use case A Dashboard, 7 checks |
| browser Back to `/app-hub/use-case-a/crash` after recovery | fallback (correct, URL is the crash page) | fallback (correct) |
| sidebar "Catalog", then "Use case A" | recovered (boundary was unmounted by the route change) | recovered |
| Retry button on `/crash` | re-renders, crashes again, fallback again | same (the page still throws) |

Retry behaviour: Retry drops the cached lazy and remounts, so it makes a fresh load attempt; a deterministic render error just fails again.
Before the fix, "return to the page" via a link to the same route (sidebar Use case A link, Back) did not retry: **FAIL**. Fix applied: **PASS**.

Fix (`packages/contract/src/remote-boundary.tsx`, +9/-1): the class becomes the internal `Boundary` with an extra `at` prop; a 2-line `componentDidUpdate` calls `retry()` when `at` changes while failed;
the exported `RemoteBoundary` is a function component passing `at={useLocation().key}` (same props and export name, so shell and app-hub are untouched; contract already depends on react-router-dom).
`location.key` changes on every navigation (including links to the same URL), and a healthy remote is not remounted by internal navigation (reset only happens while failed).
Evidence: `docs/img/failure-3-crash.png` (fallback), `failure-3-crash-fixed-recovered.png` (after fix, sidebar link recovered). 2b covers load failures.

## 4. strictVersion mismatch (Use case A requires react 19.0.0 -> 19.1.0, shell provides 19.0.0)

Reproduce: build Use case A with `UCA_REACT_REQUIRED=19.1.0`, `node scripts/serve.mjs`, open `/V1/app-hub/use-case-a?user=admin`. No second React installed.

Strict (`strictVersion: true`, the default config): Use case A's chunk `useCaseA__loadShare__react__loadShare__*.js` calls the runtime's `loadShare` and it **throws**; app-hub's `loadRemote("useCaseA/App")` rejects:

    error: Error: [ Federation Runtime ]: Version 19.0.0 from portal_host of shared singleton module react does not satisfy the requirement of useCaseA which needs 19.1.0)
        at error (.../mf/use-case-a/assets/useCaseA__mf_v__runtimeInit__mf_v__-D5WsjCmb.js)
        at Object.h [as resolver] ... at getRegisteredShare ... at SharedHandler.loadShare
        at async .../mf/use-case-a/assets/useCaseA__loadShare__react__loadShare__-CxCEsxuQ.js

- Boundary: app-hub's (alert `Module "useCaseA" is currently unavailable.`, 1 alert total); app-hub sidebar and shell header alive.
- No "Invalid hook call"; no React core copy was fetched except the shell's (`shell/assets/index-CJHwXufJ.js`); share scope: one react entry, `from=portal_host`, `useIn=portal_host|appHub`.
- The user sees a generic "unavailable"; the version cause is only in the console. A mismatch looks identical to an outage and, per 2b, a reload would not fix it either.

Control (`UCA_STRICT=false`, same mismatch): the runtime only **warns** and Use case A runs on the shell's React.

    warn/log: [ Federation Runtime ] Version 19.0.0 from portal_host of shared singleton module react does not satisfy the requirement of useCaseA which needs 19.1.0)

No alert, all 7 ProofPanel checks `pass` (react identity, query-client, router, share-scope...), `useIn=portal_host|appHub|useCaseA`, no second React loaded, no hook errors.
So with `singleton: true` and `strictVersion: false`, a mismatched remote silently runs against the host's React (unsafe if the remote needs 19.1 APIs); `strictVersion: true` turns it into a contained load failure.
Evidence: `docs/img/failure-4-strict-mismatch.png`, `failure-4b-strict-false.png`. Result: strict = fail contained (PASS isolation); relaxed = silent degradation. Not tested: remote bundling its own React (needs `import: false` absent / no provider), a minor-higher host (e.g. host 19.2 vs Use case A 19.0.0 range handling), mismatch of react-router or the contract.

## 5. Cold-load waterfall (production, healthy, cache disabled via CDP)

`/V1/app-hub/use-case-a`, `Network.setCacheDisabled`, fresh browser context per run, 3 runs; time = navigation commit to `[data-check=react]` visible (ProofPanel rendered). 37 JS requests per load.

| Hop | `remoteEntry.js` | start (ms after first JS request), localhost | with +100 ms latency (CDP) |
|---|---|---|---|
| 0 | shell's own `assets/remoteEntry-*.js` | +3..4 | +107..108 |
| 1 | `/V1/mf/app-hub/remoteEntry.js` | +36..40 | +882..893 |
| 2 | `/V1/mf/use-case-a/remoteEntry.js` | +53..58 | +1213..1226 |
| ProofPanel visible | | 822..828 ms | 1921..1923 ms |

The chain is strictly serial (Use case A's entry is only requested after app-hub's code ran `loadRemote`): 2 remote hops after the shell, 3 entries in total, each followed by its own chunk fan-out (app-hub 7 files, Use case A 10 files).
Localhost latency is ~0 so the first column is the floor; each hop costs about 1 RTT plus the entry-dependent chunks (with 100 ms latency: ~800 ms for the shell bootstrap, ~330 ms app-hub to Use case A). The shell's config.json fetch precedes the app-hub hop.

Duplicate `remoteEntry.js` in dev: dev run 1 (cold vite dep optimisation) requested `5174/remoteEntry.js` 5 times and `5175/remoteEntry.js` 5 times (251 JS requests, ProofPanel at 2.9 s);
runs 2 and 3 (same dev servers, fresh context) requested each exactly once (56 JS requests, 0.81 s). So the duplicates are re-requests caused by Vite's first-load dep re-optimisation (full page reloads / re-imported modules), not repeated executions in a steady state.
Not verified: that each duplicate was a re-execution vs a re-request of a cached module (the runtime dedups by instance); only counts and timing were observed. Production never shows duplicates.

## Housekeeping

`npm run typecheck` clean,
healthy build verify (`verify.mjs build`): 7/7 checks pass, 0 console errors, 0 hook errors. All servers I started were stopped (4174, 5170, 5174, 5175 free).
