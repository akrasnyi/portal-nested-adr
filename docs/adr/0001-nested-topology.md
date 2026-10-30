# ADR-0001: Nested Module Federation topology (shell → App Host → use cases)

- **Status:** Proposed
- **Date:** 2026-10-30
- **Evidence:** [results.md](../results.md), [results-expose-contract.md](../results-expose-contract.md), [results-failures.md](../results-failures.md)

## Context

App Host is a remote of the portal shell and, at the same time, the host of its own remotes, the use cases. Use case A is the first use case. The shell must not know Use case A exists; adding a use case should change App Host only.

The risk: Use case A is loaded by App Host, not by the shell. If any level gets its own copy of React, react-router, react-query or the shell's contract, we get "Invalid hook call", empty contexts, and a user who is "logged out" inside Use case A, often without any error at load time.

A webpack spike by a colleague worked but needed the shell to list **itself** in `remotes` (self-remote), because on webpack the shell's `main.js` and `remoteEntry.js` have separate module caches. We had to know whether that applies to our stack.

**Stack tested:** Vite 5.4.14, `@module-federation/vite` 1.7.2 (runtime 0.17.1), React 19.0.0, react-router-dom 6.30.4, react-query 5.90.2. All shared as `singleton` + `strictVersion` + exact versions. Both `vite dev` and production build were checked. The build was served from one origin with our URL contract (`/V1/mf/<app>/`).

## Spike result: **works**

- **Approach:** App Host is a remote of the shell and a host of Use case A. It registers Use case A at runtime (`registerRemotes` + `loadRemote` from `@module-federation/runtime`); the shell never declares it. React, react-dom, react-router(-dom), react-query and `@portal/contract` are shared singletons with `strictVersion`.
- **Outcome:** in both `vite dev` and the production build, Use case A gets the shell's React, QueryClient, router and `AuthContext`. Only one React core file is fetched. A user switch in the shell reaches Use case A. Nested navigation updates the shell's URL and history.
- **Note on the "fallback" category:** we load remotes through the runtime API **by design**, as the production portal already does, not as a workaround.
  - The classic variant also **works**. App Host declares Use case A as a build-time `remotes` entry (`{ type: "module", name: "useCaseA", entry: "/V1/mf/use-case-a/remoteEntry.js" }`; a root-relative entry is fine on one origin) and imports `import("useCaseA/App")`. All checks pass in dev and build, and the shell still doesn't know Use case A ([results-static-remotes.md](../results-static-remotes.md)).
  - Its trade-offs are why the runtime API stays the default:
    - the entry is fetched eagerly when App Host loads;
    - the URL is baked into App Host's build;
    - each remote needs a hand-written `declare module`;
    - a failed static import is memoised by the browser and never recovers without a runtime `registerRemotes({ force: true })` fallback.
- **Problems found:** (1) after a failed entry load the browser memoises the failed `import()`, so Retry needed a cache-busting re-registration (fixed); (2) the boundary stayed in its error state after navigation (fixed); (3) on a cold Vite dev cache, the first page load is interrupted once by the dependency optimizer's reload ("optimized dependencies changed. reloading"). Dev-only; the next load works.

## Decision

1. **Nested topology is supported.** App Host registers its use cases at runtime (`registerRemotes` + `loadRemote`) from a typed `USE_CASES` list. The shell registers only App Host. No build-time `remotes` anywhere.
2. **The shell's contract is a shared singleton workspace package**, `@portal/contract`. It holds `AuthContext`, `useAuth`, `RequireModule`, `RemoteBoundary`, breadcrumbs and `ModuleId`. It is not exposed as `shell/contract`, and **no self-remote** is used.
3. **`RemoteBoundary` lives in the contract** and is used at both levels. It resets after a failure when the location changes. After a failed entry load, the loader re-registers that remote with a cache-busting entry, so Retry works without a page reload.
4. **`strictVersion: true` stays on** for every shared library. Libraries use exact versions. The contract uses a semver range; see [ADR-0002](0002-type-sharing.md).

## Evidence

### Same instances three levels deep

Checked on the Use case A page. It is the same in dev and build.

| Check | dev | build |
|---|---|---|
| `React` in Use case A === shell's | PASS | PASS |
| `useQueryClient()` in Use case A === shell's, and the shell's `["tenant"]` cache read without a fetch | PASS | PASS |
| `AuthContext` and the whole contract module identical | PASS | PASS |
| User switched in the shell is shown in Use case A | PASS | PASS |
| Use case A `navigate()` updates the shell's URL and breadcrumbs; Back works; deep-link reload works | PASS | PASS |
| One React core file fetched; share scope has one provider (`portal_host`) | PASS | PASS |
| User without App Host access: redirected, **no** App Host/Use case A request | PASS | PASS |

The runtime registered three instances, `[portal_host, appHost, useCaseA]`. App Host's module-level `registerRemotes` hit App Host's own instance, so no `getInstance` workaround was needed.

### Is a self-remote needed on Vite? No, and the exposed contract is URL-fragile

Tested with a shell that exposes `./contract`. Two modes: the shell imports the contract locally (`local`), or the shell imports it through its own container (`self`).

| Variant | Contract evaluations | `useAuth` in the leaf |
|---|---|---|
| `local` (dev, build) | 1 | works |
| `self` (dev, build) | 1 | works |
| `self` with `?v=1` on the entry | 1 | works |
| entry on `127.0.0.1`, page on `localhost` (dev, build) | **2** | **throws "outside AuthProvider"**, no load error |

The browser keys ES modules by URL, so on Vite the webpack duplicate does not happen. But identity then depends on every consumer using exactly the same URL. A shared package depends on the share scope instead, which is why we chose it.

### Failure isolation and versions (production build)

| Scenario | Result |
|---|---|
| App Host files missing | Shell fallback in the content area, header alive, **no Use case A request** |
| Use case A files missing | App Host fallback inside App Host; sidebar and shell alive |
| Use case A files come back → Retry or navigate back | **Before:** stuck until full reload (the browser memoises a failed `import()` per URL). **After the fix:** `remoteEntry.js?retry=1` is requested and the page recovers. Share scope still has one React. |
| Use case A throws during render | App Host fallback only. **Before:** stuck on the same route. **After the fix:** recovers on navigation. |
| Use case A requires React 19.1.0, shell has 19.0.0, `strictVersion: true` | Use case A refuses to load (`… does not satisfy the requirement of useCaseA …`), App Host fallback, no second React |
| Same mismatch with `strictVersion: false` | Only a console warning; Use case A **silently runs on the shell's React** |

### Cost of the extra level (cold load, production)

| | localhost | +100 ms RTT |
|---|---|---|
| shell `remoteEntry` starts | +3..5 ms | +105..108 ms |
| App Host `remoteEntry` starts | +37..45 ms | +882..913 ms |
| Use case A `remoteEntry` starts | +55..66 ms | +1213..1250 ms |
| Use case A content visible | ~820 ms | ~1930 ms |

## Alternatives considered

| Option | Why not |
|---|---|
| **Flat**: the shell registers Use case A; App Host is only a catalog | Simpler, with one hop fewer. But every new use case changes shell config. This remains the fallback if use cases turn out to be rare (see the open question). |
| **Contract exposed as `shell/contract`** | Works on Vite, but identity depends on identical entry URLs at every consumer. We proved that a different origin spelling silently creates a second contract. |
| **Self-remote (webpack approach)** | Not needed on Vite (same result as `local`). It adds a circular container graph, and the shell's own UI depends on loading its own entry. |
| **Props through App Host** | Every piece of shell state becomes an App Host prop and needs an App Host redeploy. |
| **`strictVersion: false`** | A mismatched remote runs silently on the host's library. That turns a clear load failure into potential subtle runtime bugs. |

## Consequences

**Positive**
- A new use case is one `USE_CASES` entry plus a new remote. The shell is untouched.
- One React, router, query cache and session on the page, proven in dev and build.
- A broken or missing use case is contained inside App Host. A missing App Host never downloads Use case A. Access is checked before anything is requested.

**Negative / to handle**
- **Extra serial hop.** About 0.33 s more per level at 100 ms RTT. Mitigation if it matters: `preloadRemote` when the use-case link is hovered or focused.
- **Bundled fallback copies.** Plugin 1.7.2 has no `shared.import: false`, so every remote bundles fallback copies of the shared libraries, including the contract. They are not requested at runtime, but they make remote `dist` bigger. Newer plugin versions support `import: false`.
- **Lock-step upgrades for libraries.** Exact versions plus `strictVersion` mean every remote must be rebuilt in the same release when React, the router or react-query changes. The contract avoids this with `^<installed>` ranges and semver ([ADR-0002](0002-type-sharing.md)).
- **Version mismatch is invisible to the user.** They see only "unavailable", and the cause is console-only. The error-reporting hook (`onRemoteError`) must report the runtime error message.
- **Retry logic is duplicated.** It is in the shell loader and the App Host loader. In production code, move it into one helper next to the loaders.

## Open questions

1. How many use cases are expected in the next 12 months, and who builds them? This confirms nested over flat.
2. Should `/V1/mf/*` files require authentication? Hiding a remote does not protect its code.

## Not verified

- Plugin versions other than 1.7.2 (`@module-federation/vite` 1.23.x).
- A remote that bundles a *different* React and actually loads it. We only simulated the mismatch through `requiredVersion`.
- A react-router or contract version mismatch.
- The retry fix in dev mode.
- A real identity provider, the design system, deployment to the dev environment.
