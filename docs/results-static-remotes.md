# Results: Use case A as a build-time remote of App Host

Question: the runtime variant (`registerRemotes` + `loadRemote`) is the default. Does the "classic" variant work, where App Host declares Use case A in its federation config and imports it as a module (`import("useCaseA/App")`)? The shell must still never declare Use case A.

**Verdict: works.** Everything passes in `vite dev` and in the production build on `@module-federation/vite` 1.7.2. Two differences from the runtime variant: Use case A's `remoteEntry.js` is fetched **eagerly** when App Host loads (not on the route), and **retry after a failed entry does not work out of the box** (a 12-line runtime fallback fixes it, see below).

## Setup

Switch: `APP_HOST_STATIC_REMOTES=1`, read by `apps/app-host/vite.config.ts` and exposed to App Host code as `import.meta.env.VITE_STATIC_REMOTES` through Vite `define`. OFF is the default.

```bash
# dev (all three servers)
APP_HOST_STATIC_REMOTES=1 node scripts/dev.mjs
# production: build everything, then rebuild App Host with the switch, then serve
npm run build
(cd apps/app-host && APP_HOST_STATIC_REMOTES=1 ../../node_modules/.bin/vite build)
node scripts/serve.mjs
```

### The config form that works

```ts
federation({
  name: "appHost",
  filename: "remoteEntry.js",
  exposes: { "./App": "./src/App.tsx" },
  remotes: {
    useCaseA: {
      type: "module",
      name: "useCaseA",
      entry: command === "build" ? "/V1/mf/use-case-a/remoteEntry.js" : "http://localhost:5175/remoteEntry.js",
    },
  },
  shared: federationShared,
});
```

- The object form `{ type: "module", name, entry }` is what was used (`shareScope` omitted: default). The string form `useCaseA@<url>` was not tested.
- **A root-relative entry works in production** (`/V1/mf/use-case-a/remoteEntry.js`). The runtime resolves it against the page origin, so the single-origin deployment needs no absolute URL and no host name in the build. The cost: the `/V1` stage prefix is baked into the App Host bundle (in the runtime variant it is a code constant too, but it can come from data). The built `apps/app-host/dist/remoteEntry.js` contains the string `/V1/mf/use-case-a/remoteEntry.js`.
- In dev the entry must be absolute (`http://localhost:5175/...`): App Host runs on another origin than the page.
- Use in code: `load={() => import("useCaseA/App")}` (via `apps/app-host/src/load-static.ts`, imported lazily from `App.tsx`). Types: `apps/app-host/src/static-remotes.d.ts` declares `module "useCaseA/App"` as the contract's `RemoteApp` default export (`RemoteModule` shape). `tsc` passes.
- The plugin generates a wrapper module `appHost__loadRemote__useCaseA_mf_1_App__loadRemote__*.js`; the `useCaseA` remote shows up as the third federation instance, as in the runtime variant.
- **OFF must stay clean, which needed two tweaks:** with the switch off, `import("useCaseA/App")` does not resolve. Build: `rollupOptions.external: ["useCaseA/App"]` when OFF (the dead branch is tree-shaken; the OFF App Host dist has no reference to `load-static` or `useCaseA/App`). Dev: `App.tsx` imports `./load-static` dynamically, so Vite never transforms it when OFF (a static import made App Host fail with "Failed to resolve import" in dev).

## Results

Headless Chromium (`verify.mjs dev|build`, a copy of the original script with extra steps for question 6). Dev was warmed up once before measuring. Screenshots: `docs/img/static-*.png`.

| # | Check | dev | build | Evidence |
|---|---|---|---|---|
| 1 | Use case A renders in App Host in the shell | PASS | PASS | `/app-host/use-case-a` (prod `/V1/app-host/use-case-a`): dashboard rendered, breadcrumbs `Home > App Host > Use case A > Dashboard`. [dev](img/static-proof-dev.png), [build](img/static-proof-build.png) |
| 2 | ProofPanel: react, query-client, auth-context, contract-module, router, share-scope (+ auth-user) | PASS (7/7) | PASS (7/7) | All `pass`; `share-scope`: one provider `portal_host@19.0.0`, instances `[portal_host, appHost, useCaseA]`. One React core file fetched, from the shell (dev `__mf__virtual_portal_host__prebuild__react...`, build `mf/shell/assets/index-CJHwXufJ.js`). No hook errors, no console errors. |
| 3 | User switch in the shell reaches Use case A | PASS | PASS | Shell `Uma Use-Case`, Use case A `auth-user` `pass: Uma Use-Case`. [dev](img/static-proof-dev-switched.png), [build](img/static-proof-build-switched.png) |
| 4 | Nested navigation keeps shell URL and history; Back; deep-link reload | PASS | PASS | Open report: window path `/app-host/use-case-a/reports/42` (prod `/V1/...`), shell pathname identical. Back returns to `/app-host/use-case-a`. Deep link and its reload: 7/7 pass. [dev](img/static-report-dev.png), [build](img/static-report-build.png) |
| 5 | Shell bundle and config have no reference to Use case A | n/a (config and source) | PASS | `grep -rniE "useCaseA\|use-case-a" apps/shell/dist apps/shell/vite.config.ts apps/shell/src` prints nothing. The shell does not rebuild for this switch. |
| 6 | When is `remoteEntry.js` requested | EAGER | EAGER | See below. Not requested for a user without App Host access: PASS in both (`?user=billing`: redirected home, 0 requests to App Host or Use case A). |
| 7 | Failure isolation (`--block=use-case-a`) | PASS | PASS | App Host fallback `Module "useCaseA" is currently unavailable`, App Host sidebar and shell stay alive (`h2` "App Host" still present). [build](img/static-failure-use-case-a-blocked.png), [dev](img/static-failure-dev-blocked.png). Blocking App Host itself: fallback at the shell level, Use case A is never requested (build). |
| 7b | Retry without page reload, as-is (static `import()` only) | FAIL | FAIL | After unblocking, Retry shows the same fallback and sends **no new request** to Use case A (build log: exactly one `404 /V1/mf/use-case-a/remoteEntry.js`; dev: exactly one failed request). |
| 7c | Retry with the fallback in `load-static.ts` | PASS | PASS | Retry, and navigating Catalog then back, load Use case A with 7/7 pass on the same page (a window marker survived in dev; no reload). Requests: `404 .../remoteEntry.js` then `200 .../remoteEntry.js?retry=1`. [build](img/static-failure-use-case-a-retry-fixed.png), [nav](img/static-failure-use-case-a-nav-fixed.png), [dev after retry](img/static-failure-dev-after-retry.png) |
| 8 | `strictVersion`: Use case A built with `UCA_REACT_REQUIRED=19.1.0` | n/a | PASS | Contained failure: `Version 19.0.0 from portal_host of shared singleton module react does not satisfy the requirement of useCaseA which needs 19.1.0`. Fallback only inside App Host, shell user still shown. [shot](img/static-failure-strict-mismatch.png). Use case A rebuilt healthy afterwards. Dev was not repeated. |
| 9 | Switch OFF: original healthy verify, nothing regressed | PASS (7/7) | PASS (7/7) | Default `npm run build`, `npm run typecheck`, then the verify steps: all pass, user switch, Back, deep link and billing redirect (0 remote requests) as before. With the switch off, the catalog page requests nothing from Use case A (lazy). |

Dev note: restarting Use case A's dev server for the retry test triggers Vite's optimizer reload on the next page that loads it (this happens in any variant). The recorded no-reload run warmed the restarted server in a second page first.

## When is the entry fetched (question 6)

- **Static (this variant): eagerly, when App Host loads.** Opening only `/app-host` (the catalog, without clicking Use case A) already requests Use case A's `remoteEntry.js` plus its init chunks (`virtualExposes`, `preload-helper`, `runtimeInit`): 4 requests in the build, 10 in dev. The `App` chunk and the UI (`App-*.js`, `ProofPanel`, report pages) load only when the route is opened.
- **Runtime variant:** nothing is requested from Use case A until the route is opened (verified with the same script: 0 requests on the catalog page, then the entry and chunks after the click).
- Access control is unchanged: a user without App Host access never loads App Host, so never the entry.
- If the entry is down when App Host loads, App Host itself still mounts (the 404 is swallowed by the init) and the failure surfaces on the route.

## Failure and retry

- First failure: contained exactly like the runtime variant (fallback in App Host only).
- Retry as-is does not recover. The browser memoises the failed dynamic `import()`, and so does the generated `appHost__loadRemote__useCaseA_mf_1_App__loadRemote__` wrapper module (it is an ES module whose evaluation rejected). Re-registering the remote cannot help while the code keeps importing that wrapper.
- **Smallest fix (implemented, `apps/app-host/src/load-static.ts`, about 12 lines):** after the first failure, switch to the runtime path for the same remote name: `registerRemotes([{ name, entry: <entry>?retry=n, type: "module" }], { force: true })` then `loadRemote("useCaseA/App")`. This is the same cache-busting trick as the runtime variant, reusing its `resolveEntry`. It recovered in dev and in the build, without a page reload. A runtime plugin was not tried.
- Once the fix exists, the static variant and the runtime variant share the same retry code, which weakens the case for the static form.

## Comparison with the runtime variant

| | Runtime (`registerRemotes` + `loadRemote`, default) | Static (`remotes` + `import("useCaseA/App")`) |
|---|---|---|
| Use case A's URL | Data (`USE_CASES` entry), resolved at runtime | In App Host's build config (`/V1/mf/use-case-a/remoteEntry.js` baked in, so the stage prefix and path are coupled to the build) |
| Adding a use case | Edit the list and rebuild App Host (or make the list data) | Edit config and code and rebuild App Host. A rebuild either way as long as the list is in code |
| Shell knowledge of Use case A | None | None (grep of the shell dist is empty) |
| Fetch of the entry | Lazy, on the route | Eager, when App Host loads (small: entry and init chunks) |
| Retry after a failed entry | Built in (cache-busting re-registration) | Needs the runtime fallback; plain static `import()` never recovers |
| Types | `loadRemote<RemoteModule>` | `declare module "useCaseA/App"` per remote (hand-written; no dts generation in 1.7.2) |
| Build wiring | None | A switch or per-remote config; unresolved import when absent (needed `external` / dynamic import to keep the default clean) |
| Dev | Entry URL in code | Same, plus dev/prod URL in config |

Pros of static: the dependency is visible in config, and the standard `import()` reads naturally. Cons: eager entry fetch, URL baked into the build, no recovery without the runtime fallback, per-remote type declarations.

## Verdict (brief's terms): **works**

The static variant works on 1.7.2 with root-relative entries in production and no new blocker. Not a "fallback" in the brief's sense (it does not require `loadRemote` to load). Caveat: failure recovery relies on a small runtime-API fallback, and the entry is fetched eagerly.

## Unverified

- The string form `useCaseA@<url>` of `remotes`.
- Dev-mode `strictVersion` mismatch; a runtime-plugin retry.
- Several static remotes at once; a remote built in another repo (`VITE_USE_CASE_B`) in static mode.
- Single run per check, headless Chromium only.
