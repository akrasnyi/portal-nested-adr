import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

const installedVersion = (key: string) => {
  const pkg = key
    .split("/")
    .slice(0, key.startsWith("@") ? 2 : 1)
    .join("/");
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "node_modules", pkg, "package.json"), "utf8"))
    .version as string;
};

// NFR-01: exact pins, the same for every app. NFR-02: subpaths are listed too, otherwise each remote
// bundles its own jsx-runtime (plugin-react imports it in dev) and the React singleton is not shared.
const exact = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/client",
  "react-router",
  "react-router-dom",
  "@tanstack/react-query",
];

export const federationShared = Object.fromEntries([
  ...exact.map((key) => [key, { singleton: true, strictVersion: true, requiredVersion: installedVersion(key) }]),
  [
    "@portal/contract",
    { singleton: true, strictVersion: true, requiredVersion: `^${installedVersion("@portal/contract")}` },
  ],
]);
