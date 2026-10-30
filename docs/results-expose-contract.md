# Expose-contract experiment: shared package vs exposed contract (+ self-remote)

Question: webpack needs the shell to list itself in `remotes` and import `shell/store`, because `main.js` and `remoteEntry.js` are two runtimes with
two module caches. Is that needed on Vite + `@module-federation/vite` 1.7.2?

## Setup

`experiments/expose-contract/{host,mid,leaf}` (names `shellx`, `midx`, `leafx`; dev ports 5180/5181/5182; `vite preview` ports 4180/4181/4182).
Same pins as the main apps (vite 5.4.14, react 19.0.0, MF 1.7.2, React compiler). Shared config = `config/federation-shared.ts` **without** `@portal/contract`.
Shared code: `experiments/expose-contract/common.ts`.

- host: `src/contract/index.ts` (AuthContext, AuthProvider, `useAuth` throws outside a provider; module top increments `globalThis.__contractEvaluations`
  and pushes `import.meta.url` into `globalThis.__contractUrls`). `exposes: {"./contract": ...}`. Renders `AuthProvider`, a user `<select>`, route `/mid/*` -> `midx/App` (runtime `registerRemotes`/`loadRemote`).
- mid: route `leaf/*` -> `leafx/App` (runtime registration). **mid has no `shellx` remote and does not need one** (it never imports the contract).
- leaf: `import { AuthContext, useAuth } from "shellx/contract"`, build-time `remotes: { shellx: <host remoteEntry> }`. Shows a `data-check` table.
- `CONTRACT_MODE=local`: host imports its contract locally (Vite alias `shellx/contract` -> `./src/contract`, host has no `remotes`).
- `CONTRACT_MODE=self`: host lists itself (`remotes.shellx` -> its own `remoteEntry.js`) and imports `shellx/contract` (the webpack colleague's approach).
- `shared-pkg` baseline: **not rebuilt here**; it is the main spike (`docs/results.md`, `@portal/contract` as shared singleton, all checks PASS dev + build).
- Build = `vite build` with absolute `base` (the remote's own origin) + `vite preview` per app (cross-origin :418x). `scripts/serve.mjs` untouched.

Evidence of what the host bundle really does (not just the config):

    local dev   bootstrap.tsx:  import { AuthContext, AuthProvider } from "/src/contract/index.ts";
    self  dev   bootstrap.tsx:  import ... from "/node_modules/.vite/deps/shellx_contract.js?v=..."   (remote shim)
    self  build bootstrap-*.js: jd=Jv.then(l=>Zd("shellx/contract")), Vd=await Jv.then(l=>jd)         (loadRemote + top-level await)
    local build: no "shellx/contract" in the host bootstrap chunk

## Results (headless Chromium, playwright 1.64.1; page `/mid/leaf`, then host user switched Alice -> Uma)

| Mode | Env | `__contractEvaluations` | AuthContext host === leaf | `useAuth()` in leaf | User switch propagates | Console/page errors |
|---|---|---|---|---|---|---|
| local | dev | 1 | PASS | works ("Alice Admin") | yes (-> "Uma Use-Case") | 0 |
| local | build | 1 | PASS | works | yes | 0 |
| self | dev | 1 | PASS | works | yes | 0 |
| self | build | 1 | PASS | works | yes | 0 |
| self, entry `...remoteEntry.js?v=1` | dev | 1 | PASS | works | yes | 0 |
| self, entry `...remoteEntry.js?v=1` | build | 1 | PASS | works | yes | 0 |
| self, entry `http://127.0.0.1:...` (page on `localhost`) | dev | **2** | **FAIL** | **throws "outside AuthProvider"** | **no** | 0 (silent) |
| self, entry `http://127.0.0.1:...` (page on `localhost`) | build | **2** | **FAIL** | **throws** | **no** | 0 (silent) |

`react` check PASS in all rows. Evaluated URLs:

    local/self dev:   ["http://localhost:5180/src/contract/index.ts"]
    local/self build: ["http://localhost:4180/assets/index-z6sPlENR.js"]
    self127 dev:      ["http://127.0.0.1:5180/src/contract/index.ts", "http://localhost:5180/src/contract/index.ts"]
    self127 build:    ["http://127.0.0.1:4180/assets/index-z6sPlENR.js", "http://localhost:4180/assets/index-z6sPlENR.js"]

Self-remote side effects (request log): plain `self` makes exactly the same `remoteEntry` requests as `local` (dev: identical counts incl. repeated 304s from re-registration; build: 1 each).
With `?v=1`
the entry is fetched as a second URL (`remoteEntry.js` and `remoteEntry.js?v=1`, i.e. two remoteEntry module instances) but the exposed
contract chunk is imported by the same URL, so it is still evaluated once. No circular-init hang, no init-order error was observed
(host awaits the self-remote at top level in `bootstrap`; works because `main.tsx` does `import("./bootstrap")`, same as the main shell).
Screenshots: `docs/img/expose-{local,self,self127,selfq}-{dev,build}.png`.

## Conclusions

1. **Self-remote is not needed on Vite 1.7.2.** `local` (host imports `./contract` directly; leaf imports `shellx/contract` through the host's exposed module)
   evaluates the contract exactly once in dev and build, with one AuthContext. The browser module map is keyed by URL: the host's local import and
   the remote's exposed import resolve to the same URL (dev `/src/contract/index.ts`; build the same hashed chunk), so there is no second module cache as on webpack.
2. **`local` does not duplicate** (in this setup: one origin spelling, host loaded from the same origin the leaf's `shellx` remote points to).
3. **Exposed contract works at depth 2** (host -> mid -> leaf), with mid needing no knowledge of `shellx`; only the module that imports it (leaf) needs the build-time remote.
4. **Self-remote is harmless when the URL matches** but adds a failure mode: the same module is identified by *URL*, so an origin/host-spelling mismatch
   between the page/host code and the self-remote entry (here `127.0.0.1` vs `localhost`) silently creates a second contract and context: no error at load,
   the leaf only fails at `useAuth()`. A `?v=1` suffix on the entry did not matter (the contract chunk URL is derived from the entry's directory, not its query).
   The same hazard applies to the `local` mode if the leaf's `shellx` remote URL has a different origin spelling than the page (not tested separately, see caveats):
   exposing makes the contract's identity depend on the URL, a shared package does not.
5. Compared with the `shared-pkg` baseline: exposing works, but the shared singleton is identity-by-share-scope (version), robust to URL spelling; the exposed
   contract is identity-by-URL, plus leaf needs a build-time dependency on the host's URL.

## Reproduce

Scripts live outside the repo (`.../scratchpad/adr-verify-b/{run.sh,verify.mjs}`); manual equivalent:

    cd experiments/expose-contract/<host|mid|leaf>
    # dev (3 terminals, or background):  CONTRACT_MODE=local node ../../../node_modules/.bin/vite     (mode: local | self)
    # build:  CONTRACT_MODE=self node ../../../node_modules/.bin/vite build && CONTRACT_MODE=self node ../../../node_modules/.bin/vite preview
    # open http://localhost:5180/mid/leaf (dev) or http://localhost:4180/mid/leaf (build)
    # URL variants (self mode, set at start for dev, at build for build):
    #   BIND=1 SELF_URL=http://127.0.0.1:5180/remoteEntry.js   (build: 4180)   -> duplicates
    #   SELF_URL="http://localhost:5180/remoteEntry.js?v=1"                    -> still 1

`BIND=1` makes the servers listen on all interfaces (otherwise `127.0.0.1` is refused).

## Caveats / unverified

- `shared-pkg` was not re-run in this experiment (reference to the main spike).
- One origin pair only (`localhost`); a leaf `shellx` remote on a different spelling than the page was not tested in `local` mode (expected to behave like the `127.0.0.1` self case, unconfirmed).
- A first dev run of the `127.0.0.1` case hit a Vite "Outdated Optimize Dep" 504 on cold cache (unrelated to federation); the recorded result is from a re-run.
- Single user-visible check of "propagates" = leaf text after `<select>` change; no router/navigation checks here.
- No typecheck wiring for these apps (`globals.d.ts` declares `shellx/contract`); `tsc` was not run on them.
- Vite 5.4.14 + MF vite 1.7.2 only; webpack behaviour was not reproduced.
