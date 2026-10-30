# Results: types and versions across repositories

Spike on Vite 5.4.14 + `@module-federation/vite` 1.7.2 (runtime 0.17.1), React 19.0.0, TypeScript 5.5.4. The remote repos ran in a sandbox outside this repo (`os.tmpdir()/portal-separate-repos/`) with the public registry. The contract was "published" as `npm pack` tarballs. Commands: [experiments/separate-repos/README.md](../experiments/separate-repos/README.md).

Setup facts, verified:

- `@module-federation/vite` 1.7.2 has no type generation: `dts` is only copied during option normalization and `@module-federation/dts-plugin` is not a dependency (1.23.5 depends on dts-plugin 2.9.2). Confirmed again: `MF_DTS=true vite build` with `dts: true` produced 0 `@mf-types` / `.d.ts` / `.zip` files.
- Isolation: `setup.mjs proof` prints `.../T/portal-separate-repos/repos/use-case-b/node_modules/@portal/contract/dist/index.js` (and the same for `react`); nothing resolves inside the repo. `npm query .workspace` lists no sandbox or template package.
- The contract is now 1.0.0 (was 0.1.0, see 3c). The workspace apps still consume `src/`; only the tarball has `dist`, `exports` and `types`.

## Results

| # | Scenario | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Types shell to remote: `use-case-b` against the packed contract | `tsc` passes. Wrong usage fails | Passes (rc 0). Negative controls fail with clear errors | PASS | `Property 'session' does not exist on type '{ user: AuthUser \| null; }'`; `Property 'Payroll' does not exist on type '{ readonly Billing: "billing"; ... }'` |
| 2 | Runtime identity: `use-case-b` built in the sandbox, loaded by the real shell to App Host chain (production) | shell user, same `AuthContext`, one contract provider | All 5 rows pass: `auth-user` = Alice Admin, `auth-context` identity, `contract-module` 11 exports identical, `share-scope` providers `[portal_host@1.0.0]` | PASS | [types-s2-identity-1.0.0.png](img/types-s2-identity-1.0.0.png); share scope `portal_host/1.0.0`, `appHost/1.0.0`, `useCaseB/1.0.0` all `loaded=true from=portal_host` |
| 3a1 | Shell 1.1.0 (tarball), remote built against 1.0.0, exact `requiredVersion` | contained load failure | App Host shows "Module "useCaseB" is currently unavailable", shell and App Host keep working | PASS (as expected failure) | `[ Federation Runtime ]: Version 1.1.0 from portal_host of shared singleton module @portal/contract does not satisfy the requirement of useCaseB which needs 1.0.0)`; [png](img/types-s3a-exact-shell1.1.0-remote1.0.0.png) |
| 3a2 | Same, remote with `^1.0.0` for the contract only (react etc. exact) | loads, uses the shell's 1.1.0 | Loads. `contract-module` compares 12 exports (the shell's 1.1.0 set). `share-scope` loaded `[portal_host@1.1.0]`; the remote's own 1.0.0 is registered but `loaded=false` | PASS | `portal_host/1.0.0: loaded=false from=useCaseB shareConfig.requiredVersion=^1.0.0`; [png](img/types-s3a-caret-shell1.1.0-remote1.0.0.png) |
| 3b | Remote built against 2.0.0 (`^2.0.0`), shell 1.1.0 | contained failure, clear message | Contained fallback in App Host | PASS (as expected failure) | `Version 1.1.0 from portal_host of shared singleton module @portal/contract does not satisfy the requirement of useCaseB which needs ^2.0.0)`; [png](img/types-s3b-caret-shell1.1.0-remote2.0.0.png) |
| 3c | semver 0.x caret | `^0.1.0` rejects 0.2.0 | `satisfies('0.2.0','^0.1.0')` = false; `0.1.5` true; `^1.0.0` accepts 1.1.0, rejects 2.0.0 | PASS | `node -p` on `semver` from the root `node_modules`. Not run through the MF runtime (it has its own `satisfy`) |
| 3d | Type drift: remote on 1.0.0 imports the 1.1.0-only `useHasRole` | `tsc` fails | Fails. With 1.1.0 installed the same file passes | PASS | `negative/new-export.ts(1,10): error TS2305: Module '"@portal/contract"' has no exported member 'useHasRole'.` |
| 3e | (extra) remote built against 1.1.0 with `^1.1.0`, shell still 1.0.0 | contained failure | Contained fallback | PASS (as expected failure) | `Version 1.0.0 from portal_host ... does not satisfy the requirement of useCaseB which needs ^1.1.0)`; [png](img/types-s3e-caret-shell1.0.0-remote1.1.0.png). The shell here also came from the 1.0.0 tarball (dist), so the main apps build and run on the packed contract too |
| 4 | Types remote to host: `RemoteModule` / `RemoteApp` | loaders use one contract type; a component that needs props is rejected | Added `RemoteApp`/`RemoteModule` to the contract. Shell and App Host loaders now use `loadRemote<RemoteModule>`; before, each spelled `{ default: ComponentType }` inline. `use-case-b` types its default export as `RemoteApp` | PASS | `negative/needs-props.tsx`: `Type '(props: { id: string; }) => JSX.Element' is not assignable to type 'RemoteApp'. ... Property 'id' is missing in type '{}' but required in type '{ id: string; }'.` |
| 5 | Different `@types/react` in the remote (18.3.12 vs 19.0.0) | irrelevant at runtime; check `tsc` | `tsc` passes with 18.3.12, also with `--skipLibCheck false`. Runtime unaffected (types are erased) | PASS (limited) | See finding below |
| 6 | MF-native types by hand: `@module-federation/dts-plugin@0.17.1` `generateTypes` (remote) + `consumeTypes` (host) on a 1.7.2 build, `./Widget` with props | `@mf-types` in the host, typed `loadRemote`/`import`, wrong prop fails | Works. Details below | PASS | `Type 'string' is not assignable to type 'number'.` (`src/use-widget.tsx(6,54): error TS2322`) |

### 3: findings

- Today's exact `requiredVersion` makes every shell contract bump a coordinated release of all remotes. A range on the contract only turns an additive bump into a non-event.
- The caret range must be the remote's own lower bound (`^<installed>`): a remote built against 1.1.0 refuses a shell on 1.0.0 (3e) instead of crashing later on a missing export. `^1.0.0` is not a safe default for a remote that uses 1.1 APIs.
- A major bump is a contained failure with a readable message (3b). Both sides must ship the new major together, so a major needs a migration window: the shell must provide both majors, or remotes upgrade first.
- With the range, the remote still bundles and registers its own contract copy (1.0.0) as a fallback, never loaded when the shell provides a satisfying version.
- 0.x ranges do not accept minor bumps, so the contract starts at 1.0.0.

### 5: @types/react

At runtime the only React is the shell's; the remote's `@types/react` never ships. It matters for `tsc` only. I installed `@types/react@18.3.12` and `@types/react-dom@18.3.1` against the contract `.d.ts`, which were emitted with React 19 types, and `tsc` still passed. The emitted `RequireModule` type inlines React 19's `ReactNode` (it includes `Promise<...>`), so a remote on older types can in principle accept or reject things differently from the shell. That wasn't hit here, and only 18.3 against the 19 emit was tried. Recommendation: pin `@types/react` and `@types/react-dom` to the same exact versions as the runtime packages in `federationShared`, and let the same Renovate group move them together.

### 6: dts-plugin by hand on 1.7.2

- **Versions:** `@module-federation/dts-plugin` 0.17.1 (same line as runtime 0.17.1 and sdk 0.17.1), `@module-federation/vite` 1.7.2, TypeScript 5.5.4. Newer plugin lines (the 1.23.x vite plugin with dts-plugin 2.9.2) were not run.
- **Glue:** `generate-types.mjs` (16 lines including comments, about 11 of code) in the remote, `consume-types.mjs` (16 lines) in the host, `mf-config.mjs` (7 lines) so the options are written once. Plus a host `tsconfig` `paths: { "*": ["./@mf-types/*"] }`.
- **Remote output after `vite build` + `generateTypes`:** `dist/@mf-types.zip` (891 B), `dist/@mf-types.d.ts` (the API types), `dist/@mf-types/compiled-types/{Widget,format}.d.ts`, next to `remoteEntry.js`. `generateTypes` took about 1.6 s.
- **Host:** `consumeTypes` with `remotes: { typesRemote: "typesRemote@http://localhost:5176/remoteEntry.js" }` downloads `@mf-types.zip` (URL derived from the `remoteEntry.js` URL) and writes `@mf-types/typesRemote/{Widget,format}.d.ts` + `compiled-types/`. `tsc` passes on `loadRemote<typeof import("typesRemote/Widget")>("typesRemote/Widget")` and `import("typesRemote/format")`. Wrong prop (`count="3"`): TS2322 as in the table. Missing required prop after the remote added `subtitle: string`: `error TS2741: Property 'subtitle' is missing in type '{ title: string; count: number; }' but required in type 'WidgetProps'.`
- **Compatibility with the 1.7.2 build:** none found. The 1.7.2 build writes no `mf-manifest.json`, and consume does not need one: it takes the zip URL from the `remoteEntry.js` URL. The generation ignores the Vite plugin and reads the config object plus the tsconfig, so 1.7.2 does not run it for you: it is a second, manual step after `vite build`.
- **Remote unreachable during host typecheck:** `consumeTypes` logs `Failed to download types archive from "http://localhost:5176/@mf-types.zip"` and exits 0 (`consume rc=0`), even with `abortOnError: true`. With no cache, the later `tsc` fails with `TS2307: Cannot find module 'typesRemote/Widget'`, far from the cause. With a cached `@mf-types` present, the old types stay and `tsc` passes. In CI the consume step must be checked explicitly (assert the folder exists), or the remote must be reachable in the pipeline.
- **Staleness:** after the remote changed `WidgetProps` and was rebuilt, the host `tsc` without re-consuming passed (rc 0) against the old types. After `consumeTypes`, it failed with TS2741. Nothing tells the host that types changed, so consumption has to run on every host CI run, or on a trigger.

## 4: when generation would matter

`./App` exposes a component with no props, so `RemoteModule` (`{ default: ComponentType }`) is the whole contract and a per-remote type adds nothing. Generation matters as soon as a remote exposes components with props or utilities (scenario 6). Options: the hand-driven dts-plugin 0.17.1 above on 1.7.2, or the built-in dts of newer plugin versions. The main apps were not upgraded.

## Recommendation

**What goes in the contract package (published to the private registry, built to `dist` + `.d.ts`):**
the shell-owned runtime API (auth, `ModuleId`, breadcrumbs, `RemoteBoundary`), the loader types (`RemoteModule`, `RemoteApp`), and nothing app-specific. Ship `exports` + `types`, `peerDependencies` on React and router. Keep workspace apps on source in the monorepo; `scripts/pack-contract.mjs` shows that the dist build needs no change to the workspace `package.json`.

**Version policy:**
- Start at 1.0.0 (0.x carets reject minor bumps).
- Semver for real: new export = minor, removed or changed export = major.
- `federationShared`: react and friends stay exact. `@portal/contract` uses `^<installed>` in remotes, so remotes get an automatic lower bound and the shell can move through minors without a remote release. Pin `@types/*` to the same exact versions as the runtime packages.
- Shell bumps a minor freely; a major needs a window (see 3b).
- Types and runtime come from the same version because both come from one package (3d, 3e): `tsc` and the share scope cannot disagree.

**CI / Renovate:**
- Publish the contract from its own pipeline; the shell and remotes depend on it by version.
- One Renovate group for `react`, `react-dom`, `react-router*`, `@tanstack/react-query`, their `@types/*` and the contract in every repo (exact pins for the first ones), so a remote never lags with half the set.
- Remote CI runs `tsc --noEmit` against the contract version it builds for. Add a compatibility job that builds against the oldest `^` floor it claims.
- Remote built against a newer minor than the shell fails at runtime (3e); release the shell first.

**Contract npm package vs dts-plugin by hand (1.7.2) vs upgrading the plugin:**

| | Contract npm package | dts-plugin by hand on 1.7.2 | Upgrade to a plugin with built-in dts |
|---|---|---|---|
| Covers | shell to remote: APIs the shell provides (shared singleton). Also the `RemoteModule` shape for remote to host | remote to host: whatever a remote exposes (components with props, utilities) | same as by hand, wired into the build |
| Needed for today's `./App` (no props) | yes | no | no |
| CI coupling | none at build time; the registry is the only coupling | host build needs each remote reachable at typecheck, or cached types. A failed download exits 0 | same, but the plugin handles the steps |
| Staleness | none: the version is in the lockfile | stale until re-consumed; nothing warns | same unless consumption runs on every build |
| Cost | publish pipeline, version discipline | about 40 lines of glue per repo, a second build step | a plugin upgrade across the portal; not tried here |

Use the package now (it covers everything the current topology needs). Add generated types only for a remote that exposes props or utilities, preferably via the plugin upgrade, because the manual path works but leaves staleness and the silent-failure CI step to us.

## Not verified

- Dev mode (`vite dev`) for the sandbox remote, and any registry other than tarballs.
- The upgraded plugin (1.23.x) and its built-in dts.
- Type-level behaviour with React types other than 18.3.12 vs 19.0.0.
- The MF runtime's own `satisfy` for 0.x ranges (3c used `semver`).
