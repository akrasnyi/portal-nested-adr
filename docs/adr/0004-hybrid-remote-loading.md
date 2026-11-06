# ADR-0004: Hybrid remote loading (static shell → App Host, runtime App Host → use cases)

- **Status:** Proposed
- **Date:** 2026-11-06
- **Related:** [ADR-0001](0001-nested-topology.md), [ADR-0002](0002-type-sharing.md), [ADR-0003](0003-runtime-remote-loading.md) (partly superseded by this ADR)
- **Evidence:** [results.md](../results.md), [results-failures.md](../results-failures.md) (both measured before this change; see the note at their top), and an alternative spike (not in this repo, see Evidence)

## Context

ADR-0003 loaded every remote through the runtime API. The shell then read its one remote from `public/config.json` before render and loaded it with its own loader.

The shell has exactly one remote, App Host, and that is known at build time. The use cases are a list that App Host owns and changes often. The two levels have different needs, so they get different mechanisms.

## Decision

1. **Shell → App Host is a static remote.** `apps/shell/vite.config.ts` declares `appHost` in the federation plugin's `remotes`, with `shareStrategy: "loaded-first"`. The route imports `appHost/App`, typed in `apps/shell/src/remotes.d.ts`. The shell has no `config.json`, no runtime config and no loader.
2. **Keep `loaded-first`.** The plugin default, `version-first`, requests the `remoteEntry.js` of every remote named in an `import("<remote>/…")` in source. The home page would then fetch App Host before its route opens. `loaded-first` fetches it on first use. Without it the home page makes extra requests; the alternative spike saw no crash when App Host was down.
3. **App Host → use cases stays on the runtime API.** `apps/app-host/src/load-use-case.ts` registers a use case on the first render of its route and calls `loadRemote("<id>/App")`. The shell's guard (`RequireModule`) sits in front of App Host, so a user without App Host access requests neither App Host nor a use case. App Host's use-case route has no guard of its own.
4. **One loader shape, one `canRetryLoad` rule.** A loader is `() => Promise<RemoteModule>`. It sets `canRetryLoad` only when it re-registers the remote on failure (`registerRemotes` with `force: true` and a `?retry=n` entry). `RemoteBoundary` offers Retry only for such loaders (`packages/contract/src/recovery.ts`). The shell's App Host route does not set it.
5. **URLs come from env variables, read at build time.** No URL lives in a JSON file.
   - `VITE_APP_HOST_URL` (shell build). Default: `http://localhost:5174/remoteEntry.js` in dev, `/V1/mf/app-host/remoteEntry.js` in build.
   - `VITE_USE_CASE_A_URL` (App Host build). Default: `http://localhost:5175/remoteEntry.js` in dev, `mf/use-case-a/remoteEntry.js` (under `/V1/`) in build.
   Every remote exposes `./App`, typed as `RemoteApp` in `@portal/contract`. The shared list stays in `config/federation-shared.ts`.

ADR-0003 decisions 1, 3 and 4 apply to App Host → use cases only. Decision 5 (a `use-cases.json` proposal) is not adopted.

## Evidence

Measured in an alternative spike (not in this repo). Plugin 1.7.2, runtime 0.17.1, production build and preview, headless Chromium, localhost. Labels: **S** = static at both levels, **H** = this ADR (hybrid), **R** = runtime API at both levels. One cell is one run unless a median is stated.

| Failure | Failure at use-case level | Failure at App Host level |
|---|---|---|
| S | Reload page | Reload page |
| H | Retry, no reload | Reload page |
| R | Retry, no reload | Retry, no reload |

The shell and the other level stayed up in all cases.

| Direct visit, 100 ms latency (median, ms, n=7) | Nested route | Catalog page |
|---|---|---|
| S | 2030 | 1583 |
| H | 1913 | 1583 |
| R | 1818 | 1464 |

At 0 ms latency all three take about 355-358 ms. A separate measurement found that a runtime loader reading its URL from a fetched JSON file added about one round trip (+107 ms).

- Home page requests to remote entries: 0 with `loaded-first`; 4 with `version-first` in H, and 8 in S.
- A declared `requiredVersion` mismatch for react, react-dom, react-router-dom and @tanstack/react-query, in build and dev, with both strategies: the nested remote did not render, the panel named the library and both versions, the shell stayed up. One run per cell.

This repo's own runs (`results.md`, `results-failures.md`) were taken on the runtime shell, before contract 1.2.0. The newer Retry check for use cases is in [progress.md](../progress.md) (production build only).

## Consequences

**Positive**
- The shell's only remote is in its build config, and the shell fetches nothing before render.
- A use case is still registered only when its route opens, and a user without access never requests it.
- A failed use case recovers with Retry, without a page reload (checked in the production build; see [progress.md](../progress.md)).

**Negative**
- **An App Host failure recovers only by reloading the page.** A failed static import stays failed: the browser keeps the failed module, and the MF runtime keeps the rejected entry promise. The shell shows "Reload page", not "Retry". R would recover.
- **The App Host URL is in the shell build.** Changing it needs a shell rebuild. Under the single-origin `/V1/mf/<app>/` contract the path is the same in every environment, so the URL changes only when an environment serves App Host from another origin.
- **The shell's dependency is visible in its config.** Use cases are still not in any build config.
- **Two mechanisms to maintain**: a static remote in the shell and runtime registration in App Host, with different retry rules.
- **Cost in the measured runs.** H is 95 ms slower than R on a nested direct visit (1913 vs 1818 ms, 100 ms latency, n=7). It is 117 ms faster than S.

## Alternatives considered

| Option | Why not |
|---|---|
| **Runtime API at both levels (ADR-0003 as it was)** | Recovers an App Host failure with Retry and was the fastest direct visit in the alternative spike. Not chosen: the shell has one remote, known at build time, so a config file fetched before render and a loader in the shell cost more than the Retry gains. Revisit this if App Host outages are frequent. |
| **Static remotes at both levels** | Recovers neither level with Retry: a use-case failure needs a reload, and the nested direct visit was the slowest (2030 ms). |
| **`mf-manifest.json` as the entry** | One extra request before `remoteEntry.js`, with no gain on this plugin version (see ADR-0003). |

## Not verified

- Real network and CDN latency. The timings are localhost with simulated latency, and one run per failure cell.
- Development-mode timing and failure behaviour of the hybrid topology in this repo.
- The bundle-size effect of the static remote.
- How production picks and caches the remote version under `loaded-first` and `version-first`.
- Failure recovery of the static App Host remote in this repo's own runs. Only the alternative spike measured it.
- Browsers other than headless Chromium.
