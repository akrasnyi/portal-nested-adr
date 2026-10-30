# Portal nested federation spike

Proof for **[ADR-0001: nested Module Federation topology](docs/adr/0001-nested-topology.md)**: shell → App Host→ Use case A on Vite 5 + `@module-federation/vite` 1.7.2. The structure mirrors our production portal: layers, `federationShared`, `RemoteBoundary`, runtime remotes from `config.json`, roles → modules, and the URL contract. Auth is stubbed and there is no design system.

```
apps/shell     host, :5170    routes /app-Host/* → App Host (guarded by RequireModule)
apps/app-Host   remote + host, :5174   USE_CASES → catalog, sidebar, routes; registers Use case A at runtime
apps/use-case-a  remote, :5175  nested routes + ProofPanel (identity checks)
packages/contract   @portal/contract: auth, RequireModule, RemoteBoundary, breadcrumbs (shared singleton)
config/federation-shared.ts   singleton + strictVersion + exact versions
scripts/serve.mjs   production single-origin server :4174 (/V1/mf/<app>/ → files, other /V1/* → shell)
experiments/expose-contract   comparison: exposed shell/contract, local vs self-remote
docs/          ADR, evidence, screenshots
```

## Run

```bash
npm install                      # .npmrc points at the public npm registry
npm run dev                      # http://localhost:5170/app-Host/use-case-a
npm run build && npm run serve   # http://localhost:4174/V1/app-Host/use-case-a
```

Pick a user with `?user=admin|usecase|billing|noroles`, or use the select in the header.

## Questions this spike answers

Every answer was checked in both `vite dev` and the production build. "Evidence" points to the full results.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Does a remote loaded by another remote (shell → App Hub → Use case A) get the shell's React, react-router, QueryClient and session, or does each level bring its own copy? | **The shell's.** There is one React on the page and one provider in the share scope. Router, query cache and `AuthContext` are identical three levels down. | [results.md](docs/results.md) |
| 2 | Does a user switch in the shell reach the leaf? Does leaf navigation update the shell's URL and history? | **Yes, both.** Back and deep-link reload work too. | [results.md](docs/results.md) |
| 3 | Can the leaf contribute to the shell's layout? | **Yes.** It adds breadcrumb segments through the contract (`Home › App Hub › Use case A › Report 42`). | [results.md](docs/results.md) |
| 4 | Can App Hub register its remotes at runtime without the shell knowing them? Which federation instance does it use? | **Yes.** `registerRemotes` / `loadRemote` hit App Hub's own instance, and three instances are registered. No `getInstance` workaround is needed. | [results.md](docs/results.md) |
| 5 | How should shell-owned state and contracts reach a remote two levels down? | **As a shared singleton package** (`@portal/contract`). Its identity comes from the share scope, not from a URL. | [ADR](docs/adr/0001-nested-topology.md) |
| 6 | Is the self-remote trick needed on Vite? | **No.** The host's local import and the exposed module evaluate once. But an exposed contract duplicates silently if one consumer spells the URL differently. | [results-expose-contract.md](docs/results-expose-contract.md) |
| 7 | Is a broken or missing remote contained at the level that loads it? | **Yes.** If App Hub is missing, Use case A is never requested. If Use case A is missing or throws, the fallback appears only inside App Hub. | [results-failures.md](docs/results-failures.md) |
| 8 | Can a failed remote recover without a page reload? | **Not out of the box.** The browser memoises a failed `import()`. **Fixed:** the loader re-registers the remote with `?retry=n`, and the boundary resets on navigation. | [results-failures.md](docs/results-failures.md) |
| 9 | What does `strictVersion` buy? | A version mismatch becomes a contained load failure. Without it, the remote silently runs on the host's React. | [results-failures.md](docs/results-failures.md) |
| 10 | Does access control prevent loading? | **Yes.** A user without App Hub access is redirected before any App Hub or Use case A file is requested. | [results.md](docs/results.md) |
| 11 | What does the extra level cost? | One serial `remoteEntry` hop: about +0.33 s per level at 100 ms RTT, cold load. | [ADR](docs/adr/0001-nested-topology.md) |

## Main differences from the webpack variant

An earlier spike built the same nested topology (shell → dashboard → widget) on webpack 5. Both spikes agree on the core mechanism: the middle host hands the share scope it got from the shell to its own remotes, so shared singletons resolve to the shell's copy at any depth. Descendant relative routes work the same way. The differences:

| | webpack variant | This spike (Vite) |
|---|---|---|
| Bundler / federation | webpack 5 `ModuleFederationPlugin` | Vite 5 + `@module-federation/vite` 1.7.2 (runtime 0.17.1) |
| How remotes are declared | Static build-time `remotes` in shell and dashboard; a new widget needs a rebuild | Runtime `registerRemotes`: the shell reads `config.json`, App Hub reads its `USE_CASES` list |
| Shell-owned state | The shell `exposes` a store **and lists itself in `remotes`**, so its own UI imports `shell/store` through its container | Shared singleton workspace package `@portal/contract`; nobody imports through the shell's container |
| Why the self-remote was needed | Shell `main.js` and `remoteEntry.js` are two webpack runtimes with two module caches, so a local import creates a second store | Not needed: ES modules are keyed by URL, so local and exposed imports evaluate once (tested) |
| Leaf knows the root | The widget lists `shell` in its `remotes`; it can't run without the shell's URL | The leaf imports a package; it doesn't know any URL of the shell |
| Container graph | Circular: shell → dashboard → widget → shell | Acyclic: shell → App Hub → Use case A |
| Contract types | Hand-written `.d.ts`, because generated types can't follow a cycle | Ordinary TypeScript types from the package |
| Versions | `strictVersion: false`, `^` ranges | `strictVersion: true`, exact versions (mismatch is a contained load failure) |
| Origins | One origin per app, `publicPath: 'auto'` | One origin in production: `/V1/mf/<app>/` for files, everything else goes to the shell |
| Failure handling | Per-widget error boundary plus a hand-written promise cache | `RemoteBoundary` in the contract, used at both levels; resets on navigation; retries a failed entry with a cache-busting URL |
| Verified in | Dev build | Dev and production build; checks are visible in the page (ProofPanel) |

## Demo script (about 10 minutes)

1. **The question.** Open `http://localhost:4174/V1/app-Host/use-case-a`. Use case A is loaded by App Host, and the shell has never heard of it. Do Use case A and the shell share React, the router, the query cache and the session?
2. **ProofPanel.** All 7 checks are green. Point at the `share-scope` row: one React provider, `portal_host`, and three runtime instances.
3. **Session.** Switch the user in the shell header. The name in Use case A changes immediately, because it reads the same `AuthContext`.
4. **Router.** Open a report in Use case A. The shell header path and the breadcrumbs (`Home › App Host › Use case A › Report 42`) update. Browser Back works. Reload the deep link, and it still works.
5. **Access.** Open `?user=billing` and go to `/V1/app-Host/use-case-a`. You are redirected home. DevTools → Network shows no App Host or Use case A request.
6. **Failure isolation.** Run `node scripts/serve.mjs --block=use-case-a`. App Host shows the fallback, and its sidebar and the shell keep working. Restart `npm run serve` without reloading the page, then click **Retry**. Use case A comes back (`remoteEntry.js?retry=1`).
7. **Why not the webpack self-remote?** Show the table in [results-expose-contract.md](docs/results-expose-contract.md). On Vite it isn't needed, but an exposed contract duplicates silently when one consumer uses a different URL spelling (`127.0.0.1` vs `localhost`).
8. **Versions.** `strictVersion` turns a mismatch into a contained load failure. With `strictVersion: false`, Use case A silently runs on the shell's React (see [results-failures.md](docs/results-failures.md), experiment 4).

## Experiment switches

| Switch | Effect |
|---|---|
| `node scripts/serve.mjs --block=<shell\|app-Host\|use-case-a>` | 404 for that app's files |
| Use case A route `crash` (link on the Use case A dashboard) | Use case A throws during render |
| `UCA_REACT_REQUIRED=19.1.0` (+ `UCA_STRICT=false`) when building `apps/use-case-a` | Version-mismatch experiment |
| `CONTRACT_MODE=local\|self` (+ `SELF_URL`, `BIND`) in `experiments/expose-contract/*` | Exposed-contract comparison |

Rebuild Use case A normally after the version experiment: `cd apps/use-case-a && ../../node_modules/.bin/vite build`.
