// Simulates "separate repos" honestly: everything lives OUTSIDE this repo, so node/vite resolution can never reach
// this repo's node_modules. Node built-ins only.
//   node setup.mjs init                     pack contract 1.0.0/1.1.0/2.0.0 to tarballs, copy templates, npm install (public registry)
//   node setup.mjs set-contract <version>   reinstall a repo's @portal/contract from a tarball (default repo: use-case-b)
//   node setup.mjs use <workspace|version>  swap THIS repo's node_modules/@portal/contract: workspace symlink or an extracted tarball
//   node setup.mjs proof                    print where the sandbox resolves @portal/contract from
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const sandbox = path.join(fs.realpathSync(os.tmpdir()), "portal-separate-repos");
const tarballs = path.join(sandbox, "tarballs");
const repos = path.join(sandbox, "repos");
const tgz = (v) => path.join(tarballs, `portal-contract-${v}.tgz`);
// Contract versions: 1.0.0 = the workspace source as is; the others add an overlay on top of it
const variants = { "1.0.0": null, "1.1.0": "variants/1.1.0", "2.0.0": "variants/2.0.0" };

// A clean env: nothing from an outer `npm run` (npm_config_*, NODE_PATH) may leak into the sandbox
const cleanEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_|^NODE_PATH$|^INIT_CWD$/.test(k)));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit", env: cleanEnv() });

const [cmd, a1] = process.argv.slice(2);

if (cmd === "init") {
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(repos, { recursive: true });
  for (const [v, overlay] of Object.entries(variants))
    run("node", [path.join(repo, "scripts/pack-contract.mjs"), `--out=${tarballs}`, `--version=${v}`, ...(overlay ? [`--overlay=${path.join(here, overlay)}`] : [])], repo);
  for (const name of fs.readdirSync(path.join(here, "templates"))) {
    const dest = path.join(repos, name);
    fs.cpSync(path.join(here, "templates", name), dest, { recursive: true });
    const p = path.join(dest, "package.json");
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("SET_BY_SETUP", `file:${tgz("1.0.0")}`));
    run("npm", ["install", "--no-audit", "--no-fund"], dest);
  }
} else if (cmd === "set-contract") {
  const dest = path.join(repos, process.argv[4] ?? "use-case-b");
  run("npm", ["install", "--save-exact", "--no-audit", "--no-fund", `file:${tgz(a1)}`], dest);
} else if (cmd === "use") {
  const link = path.join(repo, "node_modules/@portal/contract");
  fs.rmSync(link, { recursive: true, force: true });
  if (a1 === "workspace") fs.symlinkSync("../../packages/contract", link);
  else {
    fs.mkdirSync(link, { recursive: true });
    run("tar", ["-xzf", tgz(a1), "-C", link, "--strip-components=1"], repo);
  }
  console.log(`root @portal/contract -> ${a1}:`, JSON.parse(fs.readFileSync(path.join(link, "package.json"), "utf8")).version);
} else if (cmd === "proof") {
  const dest = path.join(repos, "use-case-b");
  console.log("sandbox:", dest, "\nrepo   :", repo);
  const out = execFileSync("node", ["-p", "require.resolve('@portal/contract')+'\\n'+require.resolve('react')"], { cwd: dest, env: cleanEnv(), encoding: "utf8" });
  console.log(out.trim());
  if (out.includes(repo)) throw new Error("sandbox resolves from the repo");
  console.log("OK: nothing resolves inside the repo");
} else console.log("usage: node setup.mjs init | set-contract <version> | use <workspace|version> | proof");
