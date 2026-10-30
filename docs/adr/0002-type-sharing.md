# ADR-0002: Sharing types between micro-frontends in separate repositories

- **Status:** Proposed
- **Date:** 2026-10-30
- **Related:** [ADR-0001](0001-nested-topology.md)
- **Evidence:** [results-types.md](../results-types.md), commands in [experiments/separate-repos](../../experiments/separate-repos/README.md)

## Context

In this spike all apps live in one npm-workspaces repo and import `@portal/contract` as TypeScript source. In production the shell, App Host and each use case will be **separate repositories**, built and deployed on their own. We need to know how a remote gets correct types for the shell's API, how a host gets types for what a remote exposes, and what happens when versions drift.

`@module-federation/vite` 1.7.2 has **no type generation**. Its `dts` option is only copied during option normalization, and `@module-federation/dts-plugin` is not a dependency. We confirmed that `dts: true` produces no `@mf-types`. Newer plugin versions (1.23.x) include the dts-plugin.

The experiment used real isolation. The remote repos were copied to a sandbox outside this repo, so nothing resolves from the workspace. The contract was "published" as `npm pack` tarballs.

## Decision

1. **Types and runtime travel together in one versioned npm package, `@portal/contract`.** It is published to the private registry and built to `dist` + `.d.ts`, with `exports` and `types`. React and the router are `peerDependencies`. It contains the shell-owned API (auth, `ModuleId`, `RequireModule`, breadcrumbs, `RemoteBoundary`) and the loader types (`RemoteModule`, `RemoteApp`). Nothing app-specific goes in.
2. **The same package is the runtime shared singleton.** Each remote reads `requiredVersion` from its own installed copy. That way the types it compiled against and the runtime it asks for are always the same version.
3. **Version policy:**
   - The contract uses real semver, starting at **1.0.0**. A new export is a minor; a removed or changed export is a major.
   - Remotes declare `requiredVersion: "^<installed>"` for the contract.
   - React, react-dom, react-router(-dom) and react-query stay **exact**.
   - `@types/react` and `@types/react-dom` are pinned to the same exact versions as the runtime.
4. **Remote → host types need no generation today.** Every remote exposes `./App` with no props, typed once as `RemoteApp` in the contract. Loaders use `loadRemote<RemoteModule>(...)`.
5. **Generated MF types (dts-plugin) are opt-in per remote.** Use them only when a remote exposes components with props or utilities for other apps. On 1.7.2 this is the standalone `@module-federation/dts-plugin@0.17.1` called by hand. After upgrading the plugin, it is built in.

## Evidence

| # | Scenario | Result |
|---|---|---|
| 1 | Remote repo type-checks against the published contract; wrong usage fails | PASS. `TS2339 Property 'session' does not exist…`, `Property 'Payroll' does not exist on type '{ readonly Billing… }'` |
| 2 | Remote built in a separate repo, loaded by the real shell → App Host chain | PASS. Same `AuthContext` and user; one contract provider, `portal_host@1.0.0` |
| 3a | Shell 1.1.0 (additive), remote built on 1.0.0, **exact** range | Contained load failure: `Version 1.1.0 … does not satisfy … useCaseB which needs 1.0.0`. Every minor would need a lock-step release. |
| 3a | Same with `^1.0.0` | Loads and uses the shell's 1.1.0. The remote's own copy is registered but never loaded. |
| 3b | Remote on 2.0.0, shell 1.1.0 | Contained failure with a clear message. A major needs a migration window. |
| 3c | 0.x caret | `^0.1.0` rejects 0.2.0, so the contract starts at 1.0.0 |
| 3d | Remote on 1.0.0 uses a 1.1.0-only export | `tsc` fails: `TS2305 … has no exported member 'useHasRole'` |
| 3e | Remote on 1.1.0 (`^1.1.0`), shell still 1.0.0 | Contained failure. Release the shell before remotes that need its new minor. |
| 4 | Remote `./App` that requires props | `tsc` rejects it against `RemoteApp` |
| 5 | Remote on `@types/react` 18.3 vs shell 19.0 | `tsc` still passed and the runtime is unaffected. The contract `.d.ts` inlines React 19 types, so pin anyway. |
| 6 | dts-plugin 0.17.1 by hand on a 1.7.2 build | Works: about 40 lines of glue per repo, no manifest needed. A wrong prop fails `tsc`. |

### Scenario 6 caveats (why it is opt-in)

- **Unreachable remote.** If the remote can't be reached during the host's type check, `consumeTypes` logs "Failed to download types archive" and **exits 0**, even with `abortOnError`. `tsc` then fails far from the cause (`TS2307`), or passes on cached old types.
- **Stale types.** Types go stale silently. A remote added a required prop, and the host passed `tsc` until it re-consumed.
- **CI coupling.** The host's CI depends on every remote being deployed and reachable.

## Alternatives considered

| Option | Covers | Why not as the default |
|---|---|---|
| **Contract npm package** (chosen) | shell → remote API, remote → host `RemoteApp` | — The version is in the lockfile, nothing goes stale, and CI doesn't depend on other repos. |
| **dts-plugin by hand on 1.7.2** | Whatever a remote exposes (props, utilities) | CI coupling, silent exit 0, staleness, glue in every repo. Use it only where exposes have props. |
| **Upgrade the plugin (built-in dts)** | Same as dts-plugin | Same runtime trade-offs with the glue built in. Depends on being allowed to leave 1.7.2. Not tested here. |
| **Types-only package + exposed `shell/contract`** | shell → remote | Types and runtime can drift apart, and ADR-0001 showed the exposed contract is URL-fragile. |
| **Hand-written `declare module` per remote** (webpack variant) | Anything | Manual sync with no check. Fine for a spike only. |
| **Monorepo with `paths` / workspaces** | Everything | Not available once the apps live in separate repos. |

## Consequences

- The contract gets its own build, version and publish pipeline. In this repo, `scripts/pack-contract.mjs` builds a `dist` copy without changing how workspace apps consume the source.
- A Renovate group per repo moves react, the router, react-query, their `@types/*` and the contract together. Remote CI runs `tsc` against the contract version it declares.
- **Release order:** the shell ships a contract minor first, and remotes adopt it afterwards. A remote that requires a newer minor than the deployed shell shows a contained fallback, not a crash (3e).
- A major contract change needs a plan. Either remotes and the shell switch in one release, or the shell keeps both majors available for a transition.
- This supersedes the "lock-step upgrades" consequence in ADR-0001 for the contract. Lock-step remains for React and the other exact libraries.

## Not verified

- A real private registry (tarballs only), and `vite dev` for the sandbox remote.
- The upgraded plugin's built-in dts.
- Version ranges evaluated by the MF runtime itself for the 0.x case (3c used the `semver` package).
- `@types/react` combinations other than 18.3 vs 19.0.
- The packed contract keeps extensionless imports, so consumers must use a bundler (`moduleResolution: "bundler"`).
