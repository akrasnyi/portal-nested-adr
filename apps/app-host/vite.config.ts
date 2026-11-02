import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// Option A: default is the runtime API. Build-time remotes only with APP_HOST_STATIC_REMOTES=1 (Option B, FR-15)
// Experiment: declare Use case A as a build-time remote instead of registering it at runtime
const staticRemotes = process.env.APP_HOST_STATIC_REMOTES === "1";
// Experiment: load Use case A through its mf-manifest.json instead of remoteEntry.js
const manifest = process.env.APP_HOST_MANIFEST === "1";

export default defineConfig(({ command }) => ({
  define: {
    "import.meta.env.VITE_STATIC_REMOTES": JSON.stringify(staticRemotes),
    "import.meta.env.VITE_MANIFEST": JSON.stringify(manifest),
  },
  base: command === "build" ? "/V1/mf/app-host/" : "/",
  server: { port: 5174, strictPort: true, origin: "http://localhost:5174", cors: true },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "appHost",
      filename: "remoteEntry.js",
      // FR-06: exposes ./App for the shell
      exposes: { "./App": "./src/App.tsx" },
      // FR-07: TODO no remote by default (Option A: URL in use-cases.ts); spec wants mf-manifest.json from a VITE_* URL
      ...(staticRemotes && {
        remotes: {
          useCaseA: {
            type: "module",
            name: "useCaseA",
            entry: command === "build" ? "/V1/mf/use-case-a/remoteEntry.js" : "http://localhost:5175/remoteEntry.js",
          },
        },
      }),
      // NFR-08: shareStrategy is not set, so the default (version-first) applies in every app
      shared: federationShared,
    }),
  ],
  // OFF: the never-called static import must not fail resolution
  build: { target: "esnext", rollupOptions: { external: staticRemotes ? [] : ["useCaseA/App"] } },
}));
