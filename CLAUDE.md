# portal-nested-adr

Spike that proves a nested Module Federation topology (shell → App Host → Use case A) on Vite 5 + `@module-federation/vite` **1.7.2** (runtime 0.17.1). The decisions live in `docs/adr/`. The evidence lives in `docs/results*.md` and `docs/img/`. Read `README.md` first.

## Commands
```bash
npm install                       # .npmrc = public registry; keep it that way
npm run dev                       # shell :5170, app-host :5174, use-case-a :5175 → http://localhost:5170/app-host/use-case-a
npm run build && npm run serve    # prod build, single origin :4174 → http://localhost:4174/V1/app-host/use-case-a
npm run typecheck                 # the only static check (no linter/formatter)
node scripts/serve.mjs --block=<app>   # 404 for one app (failure experiments)
node scripts/pack-contract.mjs    # build @portal/contract to dist + .d.ts, npm pack it
```
On a cold Vite cache, the first dev page load is interrupted once by the dependency optimizer. Warm up before measuring.

## Layout
- `apps/shell`: host only, with no runtime config. App Host is a static remote in `vite.config.ts`; its route is in `src/app/router.tsx`. Layers: `app > core > pages > widgets > features > shared`; never import upward.
- `apps/app-host`: remote of the shell and host of the use cases. `src/use-cases.ts` (`USE_CASES`) drives the catalog, sidebar and routes. `src/load-use-case.ts` registers use cases lazily at runtime (`registerRemotes` + `loadRemote`).
- `apps/use-case-a`: leaf remote, with nested relative routes and the ProofPanel (identity checks).
- `packages/contract`: `@portal/contract` 1.2.0, the shared singleton. It holds auth, `RequireModule`, `RemoteBoundary` (retry rules in `recovery.ts`), `ShellPortal`, breadcrumbs, the context registry (`registry.ts`), `RemoteModule`/`RemoteApp`.
- `config/federation-shared.ts`: one shared list for every app. `config/chunk-names.ts`: vendor chunk names.
- `experiments/expose-contract`: exposed contract vs self-remote. `experiments/separate-repos`: real separate repos in a sandbox outside the repo, for types and versions.

## Federation rules (proven; don't break them silently)
- The shared list is identical in all apps. Libraries use `singleton` + `strictVersion` + **exact** versions. `@portal/contract` uses `^<installed>` (semver, starts at 1.0.0). See ADR-0002. Subpaths `react/jsx-runtime`, `react/jsx-dev-runtime` and `react-dom/client` are listed too (NFR-02).
- The shell declares only App Host, as a static remote in `apps/shell/vite.config.ts` with `shareStrategy: "loaded-first"`. It never names a use case. Don't drop `loaded-first`: the default `version-first` makes the home page request App Host's entry (ADR-0004).
- App Host registers each use case at runtime (`registerRemotes` + `loadRemote`). No build config of App Host names a remote.
- Entries: `VITE_APP_HOST_URL` (shell build) and `VITE_USE_CASE_A_URL` (App Host build), read at build time. Dev defaults are `localhost:5174` and `localhost:5175`. Production defaults are `/V1/mf/app-host/remoteEntry.js` and `mf/use-case-a/remoteEntry.js`. Changing the App Host entry needs a shell rebuild.
- Retry: a failed static import cannot retry in place. A loader can retry only if it re-registers the remote (`registerRemotes` with `force: true` and a `?retry=n` entry) and sets `canRetryLoad` (see `load-use-case.ts`). `recovery.ts` decides: a load error gets Retry only when `canRetryLoad` is set, otherwise "Reload page". A render error gets Retry. Any error within 10 s of a Retry gets "Reload page". The shell's App Host route does not set `canRetryLoad`.
- `@portal/contract` 1.2.0: shared contexts are created with `getOrCreateContext` under `globalThis[Symbol.for("shell.<name>.context")]`, so duplicate copies of the module read the same context.
- Diagnostics: `[mf-check]` lines and `window.__shellReact` / `__shellQueryClient` are on in dev. In a production build they need `VITE_MF_DEBUG=true`, in the shell and in Use case A.
- Vendor chunks are named by `chunkFileNames` (`config/chunk-names.ts`). Don't add `manualChunks`: it broke rendering in an alternative spike (not in this repo).
- `main.tsx` only does `import("./bootstrap")` (the async boundary).
- Routes inside remotes are relative. The shell mounts `/app-host/*`, and App Host mounts `<path>/*`.
- Guards (`RequireModule`) run before `RemoteBoundary`, so a forbidden remote is never requested.
- Production URL contract: files at `/V1/mf/<app>/`. A missing file there returns 404. Every other `/V1/*` path serves the shell's `index.html`. Router basename is `/V1` in prod and `/` in dev.
- Plugin 1.7.2 has no `shared.import: false` and no type generation (`dts` is a no-op). Don't assume features of 1.23.x.

## Changing things
- Requirement tags `FR-xx` / `NFR-xx` live in code comments. See `docs/progress.md`. When you change behaviour, keep the tags and the status in sync.
- If a change touches sharing, routing or loading, verify it in **both** dev and the production build. The ProofPanel rows (`data-check` / `data-result`) are the pass criteria.
- Results go into the matching `docs/results*.md`. Decisions go into `docs/adr/NNNN-*.md`. Update README "Questions"/"Verdict" when a conclusion changes.
- Experiment switches must default to the healthy behaviour, and each one must be documented in README "Experiment switches".
- Never commit `dist/`, `.__mf__temp/`, `.pack-staging/`, tarballs or sandbox output.

## Public repo hygiene
This repo is public. Use generic names only (shell, App Host, Use case A/B, `@portal/*`). No company, client, product or internal ticket names, no internal URLs, no absolute local paths.

The list of forbidden terms is kept **out of git**, in `.claude/forbidden-terms.local` (one extended regex per line, gitignored), because a committed list would itself leak the names. Before every commit, this must print nothing:
```bash
grep -rniIE -f .claude/forbidden-terms.local \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=.__mf__temp --exclude-dir=.pack-staging \
  --exclude=package-lock.json --exclude=forbidden-terms.local .
```
If the file is missing, ask the maintainer for it rather than skipping the check.
