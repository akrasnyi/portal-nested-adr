# Results: Use case A loaded through `mf-manifest.json`

Question: does `manifest: true` work on `@module-federation/vite` 1.7.2, and can App Host load Use case A through `mf-manifest.json` instead of `remoteEntry.js` (runtime API: `registerRemotes` + `loadRemote`), in `vite dev` and in the production build?

**Verdict: works** in both modes, with the runtime API and no change to the loader. The switch is OFF by default and OFF behaves as before. The manifest does **not** remove the entry waterfall; it moves the Use case A App chunk into parallel with `remoteEntry.js` and adds a manifest request in front of it.

> **Later change (2026-11-02):** the runtime loader is gone. `APP_HOST_MANIFEST=1` now switches App Host's build-time `useCaseA` entry to `mf-manifest.json` in `apps/app-host/vite.config.ts`. The results below were recorded with the runtime loader.

## Plugin behaviour (1.7.2, `lib/index.esm.js`)

- `manifest: true` makes the plugin emit `mf-manifest.json` at the root of the build output (`mfManifestName`). An object form `{ filePath, fileName }` is also accepted.
- It also sets Vite's `build.manifest` to true, so `dist/.vite/manifest.json` appears as well (a side effect, not used here).
- In dev it answers `GET <base>mf-manifest.json` from a middleware (`configureServer`), with `Access-Control-Allow-Origin: *`.
- The dev manifest's `metaData.publicPath` is `http://localhost:5175/`; the build's is `/V1/mf/use-case-a/`.

## Manifest contents (Use case A, build)

Top-level keys: `id`, `name`, `metaData`, `shared`, `remotes`, `exposes`.

- `metaData.remoteEntry`: `{ name: "remoteEntry.js", path: "", type: "module" }`; `publicPath: "/V1/mf/use-case-a/"`.
- `exposes`: one entry, `useCaseA:App`, `path: "./App"`, `assets.js.sync: ["assets/App-*.js"]`, `assets.css.sync: ["assets/App-*.css"]`.
- `shared`: six entries (`@portal/contract`, `react`, `react-dom`, `react-router`, `react-router-dom`, `@tanstack/react-query`), each with one `js.sync` chunk and no async assets.
- `remotes`: empty (Use case A has no remotes of its own).

In dev the manifest answers with the same top-level keys; its `exposes` and `shared` entries have empty asset lists (the dev middleware generates them without a preload map).

## Setup

Switch: `APP_HOST_MANIFEST=1`, read by `apps/app-host/vite.config.ts` and exposed to App Host as `import.meta.env.VITE_MANIFEST` through Vite `define`. OFF is the default.

In `apps/app-host/src/use-cases.ts`, when the switch is on, the Use case A entry becomes `http://localhost:5175/mf-manifest.json` in dev and `mf/use-case-a/mf-manifest.json` in prod. The loader (`load-use-case.ts`) is unchanged. The retry appends `?retry=n` to whatever entry is registered; the runtime treats any entry containing `.json` as a manifest, so `mf-manifest.json?retry=1` works.

Use case A always has `manifest: true` in `apps/use-case-a/vite.config.ts` (the file is emitted in both switch states; the loading path is what the switch changes).

```bash
# dev (all three servers)
APP_HOST_MANIFEST=1 node scripts/dev.mjs
# production: build everything, rebuild App Host with the switch, serve
npm run build
(cd apps/app-host && APP_HOST_MANIFEST=1 ../../node_modules/.bin/vite build)
node scripts/serve.mjs
```

## Results

Headless Chromium, the verify script copied to a scratch folder (`verify.mjs`, with a request timeline added). Dev was warmed up once before measuring; the warm-up run already passed, so no optimizer interruption was seen.

| # | Check | dev | build | Evidence |
|---|---|---|---|---|
| 1 | ProofPanel rows on `/app-host/use-case-a` (dev) and `/V1/app-host/use-case-a` (build), 7 rows | PASS (7/7) | PASS (7/7) | All `pass`. `share-scope`: one provider `portal_host@19.0.0`, instances `[portal_host, appHost, useCaseA]`. Deep link `/reports/42` and its reload: 7/7 in both modes. |
| 2 | React providers in the share scope | PASS (1) | PASS (1) | `react providers: [portal_host@19.0.0]`. Share scope has six entries per instance, all `from=portal_host`. |
| 3 | Console errors / hook errors | PASS (0) | PASS (0) | Empty console-error and page-error lists on all sessions; no `Invalid hook call`. |
| 4 | `mf-manifest.json` requested | PASS | PASS | dev: `200 :5175/mf-manifest.json`; build: `200 /V1/mf/use-case-a/mf-manifest.json`. |
| 5 | Failure + retry (build, `serve.mjs --block=use-case-a`) | n/a | PASS | Blocked: `404 /V1/mf/use-case-a/mf-manifest.json`, App Host fallback `Module "useCaseA" is currently unavailable` with Retry, App Host shell alive. Unblocked, Retry clicked (no reload): `200 .../mf-manifest.json?retry=1`, `200 .../remoteEntry.js`, 7/7 pass, no alerts, no page errors. |
| 6 | Failure + retry (dev) | not run | n/a | Not exercised. |

Regression (switch OFF, rebuilt App Host without the variable, same verify script, build): **PASS (7/7)** on `/V1/app-host/use-case-a`, deep link and reload 7/7, 0 console errors, 0 hook errors.

Dev with the switch OFF was not re-run in this session.

## Network findings (build, first session, local server)

Timelines in milliseconds from the start of each page load. Both runs are the same origin on one local server, so the numbers show ordering, not real network latency.

Switch ON:
- `mf-manifest.json` requested at 857, answered at 858.
- `App-*.js`, `App-*.css` and `remoteEntry.js` all requested at 859 (in parallel with each other). `remoteEntry.js` answered at 862.
- Shared chunks (`useCaseA__loadShare__*`, `virtualExposes`, `preload-helper`, `runtimeInit`, `jsx-runtime`, `_commonjsHelpers`) requested at 863, after `remoteEntry.js` answered; all done at 870.

Switch OFF:
- `remoteEntry.js` requested at 846, answered at 847.
- `App-*.js`, `App-*.css` and the shared chunks requested at 852, after `remoteEntry.js` answered; all done at 857.

Reading:
- The manifest lets the runtime fetch the exposed App chunk (JS and CSS) in parallel with `remoteEntry.js`. In OFF, the App chunk waits for `remoteEntry.js`.
- The manifest is itself a request in front of `remoteEntry.js`. So the chain is manifest, then remoteEntry, then shared chunks, instead of remoteEntry, then App and shared chunks. Net effect on the chain: one request moved, not removed.
- The shared chunks still wait for `remoteEntry.js` in both variants.
- On localhost the two total times are within 2 ms (13 vs 11 ms from first entry request). A real RTT would decide whether the parallel App fetch pays for the extra manifest hop; not measured.
- Dev: `mf-manifest.json` (196 ms) and `remoteEntry.js` (198 ms) are requested back to back, then the Use case A modules load as ESM. The dev waterfall is not comparable with the build's preload.

## Unverified

- Dev failure and retry with the manifest (only build was run).
- Dev switch OFF re-run in this session.
- Real network latency; the parallelism result is for a local server.
- `strictVersion` mismatch with the manifest (`UCA_REACT_REQUIRED`).
- Manifest `shared` entries with a preload map in dev (dev emits empty asset lists).
- The object form of `manifest` (`{ filePath, fileName }`) and a custom manifest name.
- Single run per check, headless Chromium only.
