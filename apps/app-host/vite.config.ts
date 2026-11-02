import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// Experiment: declare Use case A as a build-time remote instead of registering it at runtime
// (variants d and e in docs/results-timing.md turn this on too)
const variant = process.env.APP_HOST_VARIANT ?? "a";
if (!["a", "b", "c", "d", "e"].includes(variant)) throw new Error(`APP_HOST_VARIANT must be a|b|c|d|e, got "${variant}"`);
const staticRemotes = process.env.APP_HOST_STATIC_REMOTES === "1" || ["d", "e"].includes(variant);
// Experiment: load Use case A through its mf-manifest.json instead of remoteEntry.js
const manifest = process.env.APP_HOST_MANIFEST === "1";
// Experiment, variants b/c: the entry comes from dist/use-cases.json, written at build time only (not in the repo)
const useCasesJson = {
  name: "write-use-cases-json",
  apply: "build" as const,
  closeBundle() {
    const entries = [
      {
        id: "use-case-a",
        remoteId: "useCaseA",
        path: "use-case-a",
        title: "Use case A",
        subtitle: "Example use case loaded by App Host.",
        entry: "mf/use-case-a/remoteEntry.js",
      },
    ];
    fs.writeFileSync(fileURLToPath(new URL("./dist/use-cases.json", import.meta.url)), JSON.stringify(entries, null, 2));
  },
};

export default defineConfig(({ command }) => ({
  define: {
    "import.meta.env.VITE_STATIC_REMOTES": JSON.stringify(staticRemotes),
    "import.meta.env.VITE_MANIFEST": JSON.stringify(manifest),
    "import.meta.env.VITE_VARIANT": JSON.stringify(variant),
  },
  base: command === "build" ? "/V1/mf/app-host/" : "/",
  server: { port: 5174, strictPort: true, origin: "http://localhost:5174", cors: true },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "appHost",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      ...(staticRemotes && {
        remotes: {
          useCaseA: {
            type: "module",
            name: "useCaseA",
            entry: command === "build" ? "/V1/mf/use-case-a/remoteEntry.js" : "http://localhost:5175/remoteEntry.js",
          },
        },
      }),
      // Experiment, variant e only: avoids the eager remote entry fetch (docs/results-static-remotes.md)
      ...(variant === "e" && { shareStrategy: "loaded-first" as const }),
      shared: federationShared,
    }),
    ...(["b", "c"].includes(variant) ? [useCasesJson] : []),
  ],
  // OFF: the never-called static import must not fail resolution
  build: { target: "esnext", rollupOptions: { external: staticRemotes ? [] : ["useCaseA/App"] } },
}));
