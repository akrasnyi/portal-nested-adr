// Packs @portal/contract for consumers OUTSIDE the monorepo (a stand-in for "publish").
// The workspace package.json is NOT touched: it keeps pointing at src/ for the workspace apps.
// Usage: node scripts/pack-contract.mjs --out=<dir> [--version=x.y.z] [--overlay=<dir>]
//   --overlay: files copied over src/ before the build (used to fake a later contract version in the experiments)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = path.resolve(arg("out") ?? "");
if (!arg("out")) throw new Error("--out=<dir> is required");
const pkgDir = path.join(root, "packages/contract");
// Staging lives inside the repo so tsc finds @types/react; it is gitignored and removed afterwards
const stage = path.join(pkgDir, ".pack-staging");

fs.rmSync(stage, { recursive: true, force: true });
fs.cpSync(path.join(pkgDir, "src"), path.join(stage, "src"), { recursive: true });
if (arg("overlay")) fs.cpSync(path.resolve(arg("overlay")), path.join(stage, "src"), { recursive: true });

fs.writeFileSync(
  path.join(stage, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx", lib: ["ES2022", "DOM"], module: "ESNext", moduleResolution: "bundler", target: "ES2022",
      strict: true, skipLibCheck: true, verbatimModuleSyntax: true, declaration: true, outDir: "dist", types: [],
    },
    include: ["src"],
  }),
);
execFileSync(path.join(root, "node_modules/.bin/tsc"), ["-p", path.join(stage, "tsconfig.json")], { stdio: "inherit" });

const src = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
const { private: _p, ...rest } = src;
fs.writeFileSync(
  path.join(stage, "package.json"),
  JSON.stringify({
    ...rest,
    version: arg("version") ?? src.version,
    main: "dist/index.js",
    types: "dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    files: ["dist"],
    sideEffects: false,
  }, null, 2),
);
fs.mkdirSync(out, { recursive: true });
console.log(execFileSync("npm", ["pack", "--pack-destination", out, "--silent"], { cwd: stage, encoding: "utf8" }).trim());
fs.rmSync(stage, { recursive: true, force: true });
