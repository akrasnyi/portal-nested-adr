# Portal nested federation spike

Proof for **[ADR-0001: nested Module Federation topology](docs/adr/0001-nested-topology.md)**: shell → App Hub → Use case A on Vite 5 + `@module-federation/vite` 1.7.2. The structure mirrors our production portal: layers, `federationShared`, `RemoteBoundary`, runtime remotes from `config.json`, roles → modules, and the URL contract. Auth is stubbed and there is no design system.

```
apps/shell     host, :5170    routes /app-hub/* → App Hub (guarded by RequireModule)
apps/app-hub   remote + host, :5174   USE_CASES → catalog, sidebar, routes; registers Use case A at runtime
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
npm run dev                      # http://localhost:5170/app-hub/use-case-a
npm run build && npm run serve   # http://localhost:4174/V1/app-hub/use-case-a
```

Pick a user with `?user=admin|usecase|billing|noroles`, or use the select in the header.

## Demo script (about 10 minutes)

1. **The question.** Open `http://localhost:4174/V1/app-hub/use-case-a`. Use case A is loaded by App Hub, and the shell has never heard of it. Do Use case A and the shell share React, the router, the query cache and the session?
2. **ProofPanel.** All 7 checks are green. Point at the `share-scope` row: one React provider, `portal_host`, and three runtime instances.
3. **Session.** Switch the user in the shell header. The name in Use case A changes immediately, because it reads the same `AuthContext`.
4. **Router.** Open a report in Use case A. The shell header path and the breadcrumbs (`Home › App Hub › Use case A › Report 42`) update. Browser Back works. Reload the deep link, and it still works.
5. **Access.** Open `?user=billing` and go to `/V1/app-hub/use-case-a`. You are redirected home. DevTools → Network shows no App Hub or Use case A request.
6. **Failure isolation.** Run `node scripts/serve.mjs --block=use-case-a`. App Hub shows the fallback, and its sidebar and the shell keep working. Restart `npm run serve` without reloading the page, then click **Retry**. Use case A comes back (`remoteEntry.js?retry=1`).
7. **Why not the webpack self-remote?** Show the table in [results-expose-contract.md](docs/results-expose-contract.md). On Vite it isn't needed, but an exposed contract duplicates silently when one consumer uses a different URL spelling (`127.0.0.1` vs `localhost`).
8. **Versions.** `strictVersion` turns a mismatch into a contained load failure. With `strictVersion: false`, Use case A silently runs on the shell's React (see [results-failures.md](docs/results-failures.md), experiment 4).

## Experiment switches

| Switch | Effect |
|---|---|
| `node scripts/serve.mjs --block=<shell\|app-hub\|use-case-a>` | 404 for that app's files |
| Use case A route `crash` (link on the Use case A dashboard) | Use case A throws during render |
| `UCA_REACT_REQUIRED=19.1.0` (+ `UCA_STRICT=false`) when building `apps/use-case-a` | Version-mismatch experiment |
| `CONTRACT_MODE=local\|self` (+ `SELF_URL`, `BIND`) in `experiments/expose-contract/*` | Exposed-contract comparison |

Rebuild Use case A normally after the version experiment: `cd apps/use-case-a && ../../node_modules/.bin/vite build`.
