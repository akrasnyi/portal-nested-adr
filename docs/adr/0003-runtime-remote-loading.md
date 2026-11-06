# ADR-0003: Load remotes through the runtime API

- **Status:** Partly superseded by ADR-0004
- **Date:** 2026-11-02
- **Related:** [ADR-0001](0001-nested-topology.md), [ADR-0002](0002-type-sharing.md), [ADR-0004](0004-hybrid-remote-loading.md)
- **Evidence:** [results.md](../results.md), [results-failures.md](../results-failures.md)

## Context

ADR-0001 fixed the topology: the shell loads App Host, and App Host loads the use cases. The shell never knows a use case. This ADR decides how each host declares and loads its remotes. On `@module-federation/vite` 1.7.2 the host calls `registerRemotes([{ name, entry, type: "module" }])` and then `loadRemote("<name>/App")` from `@module-federation/runtime`. No use case is named in any build config. (Since ADR-0004 the shell's one remote, App Host, is a static entry in the shell's build config.)

## Decision

**Update (ADR-0004):** decisions 1, 3 and 4 now apply to App Host → use cases only. The shell part of this ADR (`config.json`, `loadRemoteApp`, the shell's descriptor) was replaced by ADR-0004: the shell declares App Host as a static remote. Decision 5's `use-cases.json` proposal is not adopted and is not part of the hybrid.

1. **Every host loads its remotes through the runtime API.** No `remotes` in any build config, in any app. *(Superseded for the shell by ADR-0004.)*
2. **One loader per host, with the same shape.** `load(id)` registers the remote on first use, calls `loadRemote<RemoteModule>(\`${id}/App\`)`, and after a failure re-registers the same name with `?retry=n` and `{ force: true }`. Today App Host's loader (`load-use-case.ts`) is the only copy; the shell's copy was removed with ADR-0004. In production code it becomes one helper in the contract package.
3. **Registration is lazy.** App Host registers a use case when its route first renders, not when App Host mounts. A guard (`RequireModule`) runs before the loader, so a forbidden remote is never registered or requested.
4. **Each remote is described by a small descriptor, and nothing else:**

   ```json
   { "id": "useCaseA", "moduleId": "use-case-a", "entry": "mf/use-case-a/remoteEntry.js" }
   ```

   - `id`: the federation name passed to `registerRemotes`.
   - `moduleId`: the permission key for `RequireModule`.
   - `entry`: relative to `origin + /V1/` in production (single origin, see the URL contract in ADR-0001), absolute in dev. It points at `remoteEntry.js`.

   **No `exposes` and no `shared` in the descriptor.** Both are fixed when the remote is built; a copy in JSON cannot change them and only drifts. Every remote exposes `./App`, typed as `RemoteApp` in the contract (ADR-0002). A remote that ever needs another module gets one `module` field, not a list. The shared list lives in the build (`config/federation-shared.ts`; across repos, the contract or a shared config package).
5. **Where the descriptors live:**
   - **Shell → App Host:** superseded by ADR-0004. A static `remotes` entry in the shell's build config, with the URL in `VITE_APP_HOST_URL`. Changing App Host's URL needs a shell rebuild.
   - **App Host → use cases (proposal, not adopted):** move from the `USE_CASES` constant in code to App Host's own data file, `mf/app-host/use-cases.json`, fetched on App Host mount. Then adding a use case or changing its URL needs no App Host rebuild. The catalog fields (title, subtitle, path) move into the same file. Until this is done, App Host's URLs are code.

## Consequences

**Positive**
- A user who never opens a use case never downloads it. Access is checked before anything is registered.
- Recovery without a page reload works for use cases with one mechanism. An App Host failure needs a page reload (ADR-0004).
- Use cases change without a shell change.
- Types come from the contract package (`loadRemote<RemoteModule>`), not from per-remote declarations.

**Negative / to handle**
- **The use-case graph is not in any build config.** It is in App Host's code (`USE_CASES`). Keep it in the repo and review it like code. The shell's one remote is in its build config (ADR-0004).
- **A typo in a descriptor fails at runtime, not at build.** Validate descriptors at load (required fields, unique `id`) and report the error through the remote-error hook.
- **One more request before App Host renders** once decision 5 is done (its descriptor file). It is small and cacheable. Ship the file next to App Host's `remoteEntry.js` so they deploy together.
- **The loader is our code.** Registration, retry and the `?retry=n` cache-busting have to be maintained. Decision 2 keeps them in one place.

## Alternatives considered

| Option | Why not |
|---|---|
| **Build-time `remotes` in the host's config** | Needs a host rebuild for every new remote, and a hand-written type declaration per remote. |
| **`mf-manifest.json` as the entry** | One extra request before `remoteEntry.js`, with no gain on this plugin version. |
| **`exposes` and `shared` in the descriptor** | Both are fixed at build time. A copy in JSON cannot change them at runtime and drifts silently. |

## Not verified

- Decision 5: App Host's descriptor file is a proposal. The spike still uses the `USE_CASES` constant.
- The shared loader helper of decision 2 (the two copies are tested separately).
- Descriptor validation and the remote-error hook.
