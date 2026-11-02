# ADR-0003: Load remotes through the runtime API

- **Status:** Proposed
- **Date:** 2026-11-02
- **Related:** [ADR-0001](0001-nested-topology.md), [ADR-0002](0002-type-sharing.md)
- **Note (2026-11-02):** the code no longer follows this decision. Both hosts use build-time `remotes` with `shareStrategy: "loaded-first"` (see `docs/progress.md`). `loaded-first` removes the eager entry fetch measured below (each `remoteEntry.js` is requested only when its route opens, dev and build). The other trade-offs in "Why not build-time `remotes`" still hold: no retry without a page reload, URLs in the build config, hand-written `declare module` per remote.
- **Evidence:** [results.md](../results.md), [results-failures.md](../results-failures.md), [results-static-remotes.md](../results-static-remotes.md), [results-manifest.md](../results-manifest.md)

## Context

ADR-0001 fixed the topology: the shell loads App Host, and App Host loads the use cases. The shell never knows a use case. It left open *how* each host declares and loads its remotes. `@module-federation/vite` 1.7.2 offers two ways, and both work in this spike:

- **Build-time `remotes`:** the remote is declared in the host's `vite.config.ts` and imported as a module, `import("useCaseA/App")`. This is the classic form and the one the webpack variant uses.
- **Runtime API:** the host calls `registerRemotes([{ name, entry, type: "module" }])` and then `loadRemote("<name>/App")` from `@module-federation/runtime`. No remote is named in the build config.

Both pass every acceptance check in dev and build: one React, the shell's QueryClient, router and session three levels deep, contained failures, `strictVersion` enforced. They differ in when the entry is fetched, where the URL lives, how failures recover and how the code is typed.

## Decision

1. **Every host loads its remotes through the runtime API.** No build-time `remotes` in any app.
2. **One loader per host, with the same shape.** `load(id)` registers the remote on first use, calls `loadRemote<RemoteModule>(\`${id}/App\`)`, and after a failure re-registers the same name with `?retry=n` and `{ force: true }`. Today the shell (`core/federation/federation.ts`) and App Host (`load-use-case.ts`) each have a copy. In production code they become one helper in the contract package.
3. **Registration is lazy.** App Host registers a use case when its route first renders, not when App Host mounts. A guard (`RequireModule`) runs before the loader, so a forbidden remote is never registered or requested.
4. **Each remote is described by a small descriptor, and nothing else:**

   ```json
   { "id": "appHost", "moduleId": "app-host", "entry": "mf/app-host/remoteEntry.js" }
   ```

   - `id`: the federation name passed to `registerRemotes`.
   - `moduleId`: the permission key for `RequireModule`.
   - `entry`: relative to `origin + /V1/` in production (single origin, see the URL contract in ADR-0001), absolute in dev. It points at `remoteEntry.js`. `mf-manifest.json` also works as the entry on 1.7.2 (see "Manifest as the entry" below), but it is not the default.

   **No `exposes` and no `shared` in the descriptor.** Both are fixed when the remote is built; a copy in JSON cannot change them and only drifts. Every remote exposes `./App`, typed as `RemoteApp` in the contract (ADR-0002). A remote that ever needs another module gets one `module` field, not a list. The shared list lives in the build (`config/federation-shared.ts`; across repos, the contract or a shared config package).
5. **Where the descriptors live:**
   - **Shell → App Host:** runtime data, `config.json` fetched before render (as today). Changing App Host's URL needs no shell rebuild.
   - **App Host → use cases (proposal):** move from the `USE_CASES` constant in code to App Host's own data file, `mf/app-host/use-cases.json`, fetched on App Host mount. Then adding a use case or changing its URL needs no App Host rebuild. The catalog fields (title, subtitle, path) move into the same file. Until this is done, App Host's URLs are code, as they are in the static variant.

## Why not build-time `remotes`

Measured in [results-static-remotes.md](../results-static-remotes.md):

| | Runtime API (chosen) | Build-time `remotes` |
|---|---|---|
| When Use case A's `remoteEntry` is fetched | On the route, lazily. 0 requests on the App Host catalog | **When App Host loads**, even on the catalog. 4 requests in build, 10 in dev |
| Retry after a failed entry | Built into the loader | **Never recovers** with a plain `import()`: the browser memoises the failed import and the generated wrapper module. Needs the runtime fallback (12 lines), so the runtime code is there anyway |
| Where the URL lives | A descriptor: data for the shell, a constant in App Host today, data after decision 5 | The host's build config. The `/V1` prefix and path are compiled into `remoteEntry.js` |
| Types | `loadRemote<RemoteModule>` from the contract | A hand-written `declare module "<name>/App"` per remote (1.7.2 has no dts generation) |
| Build wiring | None | Per-remote config. An unresolved `import()` breaks the build when the remote is absent, so it needed `external` and a dynamic import to keep the default clean |
| Remote unknown at build time (new use case, other repo) | Supported by design | Needs a rebuild of the host |

The build-time form has two real advantages: the dependency is visible in the config, and `import()` reads naturally. Neither outweighs the eager fetch and the fact that recovery requires the runtime API anyway.

## Manifest as the entry

Tested with `manifest: true` in Use case A and `APP_HOST_MANIFEST=1` in App Host ([results-manifest.md](../results-manifest.md)):

- **Works on 1.7.2** with the unchanged loader. ProofPanel 7/7 in dev and build, one React provider, 0 console errors. Retry after a blocked remote recovers without a reload (`mf-manifest.json?retry=1`, build).
- **The manifest lists** `exposes` (`./App` → its JS and CSS files), the 6 shared libraries with versions, and `publicPath`. In dev the file lists are empty.
- **No speed gain.** The `App` chunk now loads in parallel with `remoteEntry.js`, but the manifest adds a request before `remoteEntry`, and shared chunks still wait for it. On localhost: 13 ms with the manifest vs 11 ms without.

**Decision:** keep `remoteEntry.js` as the entry. Turn the manifest on in a remote only when something needs it: dts-plugin types (ADR-0002) or inspecting what a remote exposes and shares.

## Consequences

**Positive**
- A user who never opens a use case never downloads it. Access is checked before anything is registered.
- Recovery without a page reload works at every level with one mechanism.
- The shell, and after decision 5 App Host too, change remotes by editing data, not by rebuilding.
- Types come from the contract package, not from per-remote declarations.

**Negative / to handle**
- **The dependency graph is not in any build config.** It is in `config.json` and App Host's descriptor file. Keep them in the repo and review them like code, and fail fast when a file is missing (`loadRuntimeConfig` throws).
- **A typo in a descriptor fails at runtime, not at build.** Validate descriptors at load (required fields, unique `id`) and report the error through the remote-error hook.
- **One more request before App Host renders** once decision 5 is done (its descriptor file). It is small and cacheable. Ship the file next to App Host's `remoteEntry.js` so they deploy together.
- **The loader is our code.** Registration, retry and the `?retry=n` cache-busting have to be maintained. Decision 2 keeps them in one place.

## Alternatives considered

| Option | Why not |
|---|---|
| **Build-time `remotes` everywhere** (webpack-style) | Eager entry fetch, no recovery without the runtime fallback, per-remote type declarations, host rebuild for every new remote. See the table above |
| **Build-time for App Host → use cases, runtime for shell → App Host** | Two mechanisms, two retry paths, and still the eager fetch inside App Host. Tested as the `APP_HOST_STATIC_REMOTES=1` experiment |
| **`exposes` and `shared` in the descriptor** | Neither can be changed at runtime. A copy in JSON drifts silently. For inspection, a remote can build `mf-manifest.json` (`manifest: true`, tested) instead |
| **`mf-manifest.json` as the default entry** | Works, but one more request before `remoteEntry` and no measured gain. See "Manifest as the entry" |
| **`preloadRemote` for every use case on App Host mount** | Same cost as the eager fetch. Use it only on hover or focus of a use-case link, if the extra hop (ADR-0001) turns out to matter |

## Not verified

- Decision 5: App Host's descriptor file is a proposal. The spike still uses the `USE_CASES` constant.
- The shared loader helper of decision 2 (the two copies are tested separately).
- Manifest entry: retry in dev, a `strictVersion` mismatch, and timing on a real network (only localhost, one run).
- Descriptor validation and the remote-error hook.
