# Portal nested federation spike

Proof for **[ADR-0001: nested Module Federation topology](docs/adr/0001-nested-topology.md)**, **[ADR-0002: sharing types between repos](docs/adr/0002-type-sharing.md)**, **[ADR-0003: loading remotes through the runtime API](docs/adr/0003-runtime-remote-loading.md)** (partly superseded) and **[ADR-0004: hybrid remote loading](docs/adr/0004-hybrid-remote-loading.md)**: shell → App Host → Use case A on Vite 5 + `@module-federation/vite` 1.7.2. The structure mirrors our production portal: layers, `federationShared`, `RemoteBoundary`, roles → modules, and the URL contract. The shell loads App Host as a static remote; App Host loads the use cases at runtime. Auth is stubbed and there is no design system.

Requirements of the spike (FR/NFR/AC IDs, remotes loaded in the hybrid topology): [docs/requirements.md](docs/requirements.md)
Status of each requirement against the code, with the `FR-xx` / `NFR-xx` tags in the source: [docs/progress.md](docs/progress.md)

```
apps/shell     host, :5170    App Host is a static remote (vite.config.ts); routes /app-host/* (guarded by RequireModule)
apps/app-host   remote + host, :5174   USE_CASES → catalog, sidebar, routes; registers Use case A at runtime
apps/use-case-a  remote, :5175  nested routes + ProofPanel (identity checks)
packages/contract   @portal/contract 1.2.0: auth, RequireModule, RemoteBoundary (RemoteLoadError, canRetryLoad, Retry/Reload rules), ShellPortal, breadcrumbs, context registry (shell.<name>.context) (shared singleton)
config/federation-shared.ts   singleton + strictVersion; exact library versions, ^range for the contract
config/chunk-names.ts   names the vendor chunks in dist (react, react-router, tanstack-query) via chunkFileNames
scripts/serve.mjs   production single-origin server :4174 (/V1/mf/<app>/ → files, other /V1/* → shell)
scripts/pack-contract.mjs   builds @portal/contract to dist + .d.ts and packs it as a "published" tarball
experiments/expose-contract   comparison: exposed shell/contract, local vs self-remote
experiments/separate-repos    remotes in real separate repos (sandbox outside this repo): types, versions, dts-plugin
docs/          ADR, evidence, screenshots
```

## Verdict: **works**

The nested topology works on Vite 5 + `@module-federation/vite` 1.7.2, in both `vite dev` and the production build. Use case A is loaded by App Host, which the shell loads, and it gets the shell's React (one core file fetched), QueryClient, router and session. A user switch in the shell reaches Use case A. Nested navigation keeps the shell's URL and history intact. One acceptance item is still open: AC-5 (Forward navigation was not recorded), see [docs/progress.md](docs/progress.md).

- **Approach (hybrid, [ADR-0004](docs/adr/0004-hybrid-remote-loading.md)):** the shell declares App Host as a static remote in its build config, with `shareStrategy: "loaded-first"`. App Host registers Use case A at runtime (`registerRemotes` + `loadRemote`); the shell never declares Use case A. Shared singletons use `strictVersion`. The shell's contract is a shared singleton package, with no self-remote.
- **Why:** the shell has one remote, known at build time, so it needs no config file, no fetch before render and no loader of its own. The use cases change often, so they stay at runtime, and App Host can change them without a shell rebuild.
- **Costs (honest):**
  - An App Host failure recovers only with a page reload. The browser and the MF runtime keep the failed static entry, so the shell offers "Reload page", not "Retry".
  - The App Host URL (`VITE_APP_HOST_URL`) is in the shell build. Changing it needs a shell rebuild.
  - There are two loading mechanisms to maintain.
  - In an alternative spike (not in this repo), a direct visit to a nested route at 100 ms latency was about 95 ms slower than the all-runtime variant (median of 7).
- **Problems found:**
  - **Retry after a failed entry needed a fix.** The browser memoises a failed `import()`. The use-case loader now re-registers the remote with a cache-busting URL. The shell's App Host route cannot do this (see Costs).
  - **The error boundary got stuck after navigation.** Fixed: it now resets when the location changes.
  - **Cold Vite dev cache, dev only.** The first load is interrupted once by the dependency optimizer's reload.

Details: [ADR-0001](docs/adr/0001-nested-topology.md#spike-result-works).

## Acceptance criteria

The brief's criteria, with this repo's names (App Host, Use case A). Checked in `vite dev` (`:5170`) and the production build (`:4174/V1`). Most rows were checked on the earlier runtime-shell build ([results.md](docs/results.md)). The static App Host remote was re-checked with the ProofPanel (7 checks, dev and prod); see [progress.md](docs/progress.md).

| # | Criterion | dev | build | Evidence |
|---|---|---|---|---|
| 1 | Use case A renders inside App Host inside the shell at `http://localhost:5170/app-host/use-case-a` | PASS | PASS | ProofPanel renders on that route; build: `/V1/app-host/use-case-a` |
| 2 | `React` in Use case A is the shell's (`window.__shell.React === React`), and `useQueryClient()` returns the shell's instance | PASS | PASS | ProofPanel `react`, `query-client`: the shell's `["tenant"]` cache is read without a fetch |
| 3 | `useAuth()` in Use case A returns the shell's user and follows a user switch in the shell | PASS | PASS | ProofPanel `auth-user`, `auth-context`; switch in the header updates Use case A |
| 4 | react-router navigation inside Use case A works and keeps the shell's URL and history intact | PASS | PASS | `navigate("reports/42")` updates the window path, shell header and breadcrumbs; Back and deep-link reload work |
| 5 | DevTools → Network shows **one** React chunk | PASS | PASS | React core fetched only from the shell; 0 React files from App Host or Use case A; one provider `portal_host` in the share scope |
| 6 | All of the above in dev and build/preview | PASS | PASS | [results.md](docs/results.md) |
| 7 | Result recorded as works / fallback (only via `loadRemote`) / blocker, with approach and problems | **works** | | [Verdict](#verdict-works); runtime `loadRemote` is the design for App Host → use cases ([ADR-0003](docs/adr/0003-runtime-remote-loading.md), [ADR-0004](docs/adr/0004-hybrid-remote-loading.md)) |

The brief names the global `window.__shellReact`. This repo exposes it as `window.__shell.React`, next to the shell's `queryClient`, `AuthContext` and contract module.

## Run

```bash
npm install                      # .npmrc points at the public npm registry
npm run dev                      # http://localhost:5170/app-host/use-case-a
npm run build && npm run serve   # http://localhost:4174/V1/app-host/use-case-a
```

Pick a user with `?user=admin|apphost|billing|noroles` (see `apps/shell/src/features/auth/StubAuthProvider.tsx`), or use the select in the header. Production URLs: remote files at `/V1/mf/<app>/`; any other `/V1/*` path serves the shell.

## Configuration

Read at build time (`VITE_*` variables). Dev reads them when the server starts.

| Variable | Read by | Default | Effect |
|---|---|---|---|
| `VITE_APP_HOST_URL` | shell (`apps/shell/vite.config.ts`) | dev: `http://localhost:5174/remoteEntry.js`; build: `/V1/mf/app-host/remoteEntry.js` | App Host's entry in the shell build. Changing it needs a shell rebuild. |
| `VITE_USE_CASE_A_URL` | App Host (`apps/app-host/src/use-cases.ts`) | dev: `http://localhost:5175/remoteEntry.js`; build: `mf/use-case-a/remoteEntry.js` (under `/V1/`) | Use case A's entry. Needs an App Host rebuild. |
| `VITE_MF_DEBUG=true` | shell (`bootstrap.tsx`), Use case A (`ProofPanel.tsx`) | off in production; dev is always on | `[mf-check]` lines and `window.__shellReact` / `window.__shellQueryClient` in a production build. |

`VITE_USE_CASE_B` is an experiment switch (see [Experiment switches](#experiment-switches)).

## Questions this spike answers

Every answer was checked in both `vite dev` and the production build. "Evidence" points to the full results.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Does a remote loaded by another remote (shell → App Host → Use case A) get the shell's React, react-router, QueryClient and session, or does each level bring its own copy? | **The shell's.** There is one React on the page and one provider in the share scope. Router, query cache and `AuthContext` are identical three levels down. | [results.md](docs/results.md) |
| 2 | Does a user switch in the shell reach the leaf? Does leaf navigation update the shell's URL and history? | **Yes, both.** Back and deep-link reload work too. | [results.md](docs/results.md) |
| 3 | Can the leaf contribute to the shell's layout? | **Yes.** It adds breadcrumb segments through the contract (`Home › App Host › Use case A › Report 42`). | [results.md](docs/results.md) |
| 4 | Can App Host register its remotes at runtime without the shell knowing them? Which federation instance does it use? | **Yes.** `registerRemotes` / `loadRemote` hit App Host's own instance, and three instances are registered. No `getInstance` workaround is needed. | [results.md](docs/results.md) |
| 5 | How should shell-owned state and contracts reach a remote two levels down? | **As a shared singleton package** (`@portal/contract`). Its identity comes from the share scope, not from a URL. | [ADR](docs/adr/0001-nested-topology.md) |
| 6 | Is the self-remote trick needed on Vite? | **No.** The host's local import and the exposed module evaluate once. But an exposed contract duplicates silently if one consumer spells the URL differently. | [results-expose-contract.md](docs/results-expose-contract.md) |
| 7 | Is a broken or missing remote contained at the level that loads it? | **Yes.** If App Host is missing, Use case A is never requested. If Use case A is missing or throws, the fallback appears only inside App Host. | [results-failures.md](docs/results-failures.md) |
| 8 | Can a failed remote recover without a page reload? | **Partly.** For use cases, **yes**: the browser memoises a failed `import()`, so the loader re-registers the remote with `?retry=n`, and the boundary resets on navigation. For App Host (the shell's static remote), **no**: a failed static import stays failed, and the shell offers only a page reload ([ADR-0004](docs/adr/0004-hybrid-remote-loading.md)). | [results-failures.md](docs/results-failures.md), [ADR-0004](docs/adr/0004-hybrid-remote-loading.md) |
| 9 | What does `strictVersion` buy? | A version mismatch becomes a contained load failure. Without it, the remote silently runs on the host's React. | [results-failures.md](docs/results-failures.md) |
| 10 | Does access control prevent loading? | **Yes.** A user without App Host access is redirected before any App Host or Use case A file is requested. | [results.md](docs/results.md) |
| 11 | What does the extra level cost? | One serial `remoteEntry` hop: about +0.33 s per level at 100 ms RTT, cold load. | [ADR](docs/adr/0001-nested-topology.md) |

### Types across separate repositories

These answers come from remotes built in real separate repos, in a sandbox outside this repo, against a contract "published" with `npm pack`.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 12 | How does a remote in another repo get the shell's types? | **From the versioned `@portal/contract` npm package** (`dist` + `.d.ts`). The same package is the runtime singleton, so the types and the runtime are always the same version. Wrong usage fails `tsc`. | [ADR-0002](docs/adr/0002-type-sharing.md) |
| 13 | Does a remote from another repo still share the shell's contract at runtime? | **Yes.** Same `AuthContext` and user, one contract provider (`portal_host`). | [results-types.md](docs/results-types.md) |
| 14 | Does every contract change force a release of all remotes? | **Only with exact versions.** With `^<installed>` on the contract, a minor bump in the shell is picked up by old remotes. A major, or a remote needing a newer minor than the shell has, is a contained failure. Start at 1.0.0, because 0.x carets reject minor bumps. | [results-types.md](docs/results-types.md) |
| 15 | Can plugin 1.7.2 propagate types of what a remote exposes (like newer versions do)? | **Not built in.** Its `dts` option does nothing. The standalone `@module-federation/dts-plugin@0.17.1` works by hand (about 40 lines of glue). But it exits 0 when a remote is unreachable, and its types go stale silently. Our `./App` has no props, so it isn't needed today. | [results-types.md](docs/results-types.md) |

## Main differences from the webpack variant

An earlier spike built the same nested topology (shell → dashboard → widget) on webpack 5. Both spikes agree on the core mechanism: the middle host hands the share scope it got from the shell to its own remotes, so shared singletons resolve to the shell's copy at any depth. Descendant relative routes work the same way. The differences:

| | webpack variant | This spike (Vite) |
|---|---|---|
| Bundler / federation | webpack 5 `ModuleFederationPlugin` | Vite 5 + `@module-federation/vite` 1.7.2 (runtime 0.17.1) |
| Shell-owned state | The shell `exposes` a store **and lists itself in `remotes`**, so its own UI imports `shell/store` through its container | Shared singleton workspace package `@portal/contract`; nobody imports through the shell's container |
| Why the self-remote was needed | Shell `main.js` and `remoteEntry.js` are two webpack runtimes with two module caches, so a local import creates a second store | Not needed: ES modules are keyed by URL, so local and exposed imports evaluate once (tested) |
| Leaf knows the root | The widget lists `shell` in its `remotes`; it can't run without the shell's URL | The leaf imports a package; it doesn't know any URL of the shell |
| Container graph | Circular: shell → dashboard → widget → shell | Acyclic: shell → App Host → Use case A |
| Contract types | Hand-written `.d.ts`, because generated types can't follow a cycle | Ordinary TypeScript types from the package; in separate repos, the published package (ADR-0002) |
| Versions | `strictVersion: false`, `^` ranges | `strictVersion: true`; exact library versions, `^<installed>` for the contract (mismatch is a contained load failure) |
| Origins | One origin per app, `publicPath: 'auto'` | One origin in production: `/V1/mf/<app>/` for files, everything else goes to the shell |
| Failure handling | Per-widget error boundary plus a hand-written promise cache | `RemoteBoundary` in the contract, used at both levels; resets on navigation; use cases retry a failed entry with a cache-busting URL; the static App Host remote can only reload the page |
| Verified in | Dev build | Dev and production build; checks are visible in the page (ProofPanel) |

## Demo script (about 10 minutes)

1. **The question.** Open `http://localhost:4174/V1/app-host/use-case-a`. Use case A is loaded by App Host, and the shell has never heard of it. Do Use case A and the shell share React, the router, the query cache and the session?
2. **ProofPanel.** All 7 checks are green. Point at the `share-scope` row: one React provider, `portal_host`, and three runtime instances.
3. **Session.** Switch the user in the shell header. The name in Use case A changes immediately, because it reads the same `AuthContext`.
4. **Router.** Open a report in Use case A. The shell header path and the breadcrumbs (`Home › App Host › Use case A › Report 42`) update. Browser Back works. Reload the deep link, and it still works.
5. **Access.** Open `?user=billing` and go to `/V1/app-host/use-case-a`. You are redirected home. DevTools → Network shows no App Host or Use case A request.
6. **Failure isolation.** Run `node scripts/serve.mjs --block=use-case-a`. App Host shows the fallback, and its sidebar and the shell keep working. Restart `npm run serve` without reloading the page, then click **Retry**. Use case A comes back (`remoteEntry.js?retry=1`).
7. **Why not the webpack self-remote?** Show the table in [results-expose-contract.md](docs/results-expose-contract.md). On Vite it isn't needed, but an exposed contract duplicates silently when one consumer uses a different URL spelling (`127.0.0.1` vs `localhost`).
8. **Versions.** `strictVersion` turns a mismatch into a contained load failure. With `strictVersion: false`, Use case A silently runs on the shell's React (see [results-failures.md](docs/results-failures.md), experiment 4).

## Experiment switches

| Switch | Effect |
|---|---|
| `node scripts/serve.mjs --block=<shell\|app-host\|use-case-a>` | 404 for that app's files |
| Use case A route `crash` (link on the Use case A dashboard) | Use case A throws during render |
| `UCA_REACT_REQUIRED=19.1.0` (+ `UCA_STRICT=false`) when building `apps/use-case-a` | Version-mismatch experiment |
| `CONTRACT_MODE=local\|self` (+ `SELF_URL`, `BIND`) in `experiments/expose-contract/*` | Exposed-contract comparison |
| `node experiments/separate-repos/setup.mjs …`, `VITE_USE_CASE_B=1`, `serve.mjs --mount=use-case-b=<dist>` | Separate-repos experiments (see [its README](experiments/separate-repos/README.md)) |

Rebuild Use case A normally after the version experiment: `cd apps/use-case-a && ../../node_modules/.bin/vite build`.
