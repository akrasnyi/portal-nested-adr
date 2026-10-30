# Separate repos: how types and versions travel

Question: how should `@portal/contract` types be shared with micro-frontends that live in other repositories? Results: [docs/results-types.md](../../docs/results-types.md).

## Layout

| Path | Purpose |
|---|---|
| `templates/use-case-b/` | a remote repo: like `apps/use-case-a`, minimal, with its own `federation-shared.ts` and a proof panel |
| `templates/types-remote/`, `templates/types-host/` | scenario 6: hand-driven `@module-federation/dts-plugin` (remote with a `./Widget` that takes props, and a consumer) |
| `variants/1.1.0`, `variants/2.0.0` | overlays on `packages/contract/src` that fake a later contract version (additive, breaking) |
| `setup.mjs` | creates the sandbox, packs tarballs, installs. Node built-ins only |
| `../../scripts/pack-contract.mjs` | "publish": builds the contract into a staging copy and runs `npm pack` |

The sandbox is `os.tmpdir()/portal-separate-repos/` (`repos/`, `tarballs/`). It is outside this repo, so nothing resolves from this repo's `node_modules`. The templates sit 3 levels deep, so the `experiments/*/*` workspace glob does not match them (`npm query .workspace` lists no `use-case-b`).

## Contract packaging

`packages/contract/package.json` is unchanged for the workspace (`main`/`types` point at `src/index.ts`, so workspace apps keep consuming source). `scripts/pack-contract.mjs` copies `src` to `packages/contract/.pack-staging` (gitignored, so `tsc` finds `@types/react`; removed afterwards), runs `tsc` (`dist/*.js` + `*.d.ts`), writes a package.json with `exports`/`types`/`files: ["dist"]` and no `private`, and runs `npm pack`. Limit: the emitted ESM keeps extensionless relative imports, so consumers must use a bundler (`moduleResolution: bundler`), which every Vite app does.

```bash
node scripts/pack-contract.mjs --out=/some/dir [--version=1.1.0] [--overlay=experiments/separate-repos/variants/1.1.0]
```

## Commands

```bash
SB=$(node -p "require('fs').realpathSync(require('os').tmpdir())")/portal-separate-repos
node experiments/separate-repos/setup.mjs init     # tarballs 1.0.0/1.1.0/2.0.0, copy templates, npm install
node experiments/separate-repos/setup.mjs proof    # sandbox resolves @portal/contract inside the sandbox
```

**1. Types shell to remote**

```bash
cd $SB/repos/use-case-b
./node_modules/.bin/tsc --noEmit -p tsconfig.json            # passes
./node_modules/.bin/tsc --noEmit -p tsconfig.negative.json   # 4 deliberate errors
```

**2. Runtime identity** (production, real shell, App Host)

```bash
cd $SB/repos/use-case-b && ./node_modules/.bin/vite build
cd - && VITE_USE_CASE_B=1 npm run build
node scripts/serve.mjs --mount=use-case-b=$SB/repos/use-case-b/dist     # :4174
# open http://localhost:4174/V1/app-host/use-case-b?user=admin   (rows data-check=...)
```

Without `VITE_USE_CASE_B` the App Host build is unchanged (one use case). `--mount` is off unless given.

**3. Version policy** (the root workspace is switched to a tarball; restore it at the end)

```bash
node experiments/separate-repos/setup.mjs use 1.1.0            # root node_modules/@portal/contract = tarball 1.1.0
VITE_USE_CASE_B=1 npm run build -w apps/shell -w apps/app-host -w apps/use-case-a
# a) remote built against 1.0.0, exact range (fails), then caret (loads)
node experiments/separate-repos/setup.mjs set-contract 1.0.0
(cd $SB/repos/use-case-b && ./node_modules/.bin/vite build)                       # exact
(cd $SB/repos/use-case-b && CONTRACT_RANGE=caret ./node_modules/.bin/vite build)  # ^1.0.0
# b) remote built against 2.0.0
node experiments/separate-repos/setup.mjs set-contract 2.0.0
(cd $SB/repos/use-case-b && CONTRACT_RANGE=caret ./node_modules/.bin/vite build)
# c) semver 0.x
node -p "require('semver').satisfies('0.2.0','^0.1.0')"
# d) type drift: with 1.0.0 installed, negative/new-export.ts fails; with 1.1.0 it passes
# e) remote ahead of shell: setup.mjs use 1.0.0, rebuild shell/app-host, remote at 1.1.0 with caret
node experiments/separate-repos/setup.mjs use workspace         # restore
```

**4. Remote to host**: `RemoteModule` / `RemoteApp` live in the contract (`remote-boundary.tsx`). The shell and App Host loaders use `loadRemote<RemoteModule>`; `use-case-b` types its default export as `RemoteApp`; `negative/needs-props.tsx` fails.

**5. @types/react**: `npm install --no-save @types/react@18.3.12 @types/react-dom@18.3.1` in `use-case-b`, then `tsc` (also with `--skipLibCheck false`).

**6. dts-plugin by hand** (needs `vite build` output of `types-remote`)

```bash
cd $SB/repos/types-remote && ./node_modules/.bin/vite build && node generate-types.mjs
(python3 -m http.server 5176 --directory dist &)
cd $SB/repos/types-host && node consume-types.mjs && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
```

`MF_DTS=true vite build` in `use-case-b` confirms 1.7.2 produces no `@mf-types`.
