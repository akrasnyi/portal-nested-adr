/// <reference types="node" />
// Same policy as config/federation-shared.ts in the portal repo, but versions come from THIS repo's node_modules.
// In production this file would come from a shared package or a template.
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);

const installedVersion = (pkg: string) =>
  JSON.parse(fs.readFileSync(path.join(here, "node_modules", pkg, "package.json"), "utf8")).version as string;

// CONTRACT_RANGE=caret: only @portal/contract accepts any later minor/patch of its own major (react & co stay exact)
const required = (key: string) =>
  key === "@portal/contract" && process.env.CONTRACT_RANGE === "caret"
    ? `^${installedVersion(key)}`
    : installedVersion(key);

export const federationShared = Object.fromEntries(
  ["react", "react-dom", "react-router", "react-router-dom", "@tanstack/react-query", "@portal/contract"].map((key) => [
    key,
    { singleton: true, strictVersion: true, requiredVersion: required(key) },
  ]),
);
