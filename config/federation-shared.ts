/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

// Exact installed version, read from node_modules (workspace packages are symlinked there too)
const installedVersion = (key: string) => {
  const pkg = key
    .split("/")
    .slice(0, key.startsWith("@") ? 2 : 1)
    .join("/");
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "node_modules", pkg, "package.json"), "utf8"))
    .version as string;
};

// Libraries: exact and identical in the shell and every remote.
// react-router holds the router contexts that react-router-dom re-exports, so both are shared
const exact = ["react", "react-dom", "react-router", "react-router-dom", "@tanstack/react-query"];

// The contract follows semver, so a remote accepts any shell contract with the same major that is
// at least the version it was built against (docs/adr/0002-type-sharing.md)
export const federationShared = Object.fromEntries([
  ...exact.map((key) => [key, { singleton: true, strictVersion: true, requiredVersion: installedVersion(key) }]),
  [
    "@portal/contract",
    { singleton: true, strictVersion: true, requiredVersion: `^${installedVersion("@portal/contract")}` },
  ],
]);
