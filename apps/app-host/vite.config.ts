import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// Experiment (docs/results-manifest.md): load Use case A through its mf-manifest.json instead of remoteEntry.js
const manifest = process.env.APP_HOST_MANIFEST === "1";

// Static remote entry: dev server origin in dev, absolute path on the single origin in the build (scripts/serve.mjs)
const remote = (name: string, devPort: number, app: string, dev: boolean, file = "remoteEntry.js") => ({
  type: "module",
  name,
  entry: dev ? `http://localhost:${devPort}/${file}` : `/V1/mf/${app}/${file}`,
});

export default defineConfig(({ command }) => {
  const dev = command !== "build";
  return {
    // NFR-06: base is an absolute path on the single origin (/V1/mf/app-host/), not an absolute URL (http://localhost:5174/)
    base: dev ? "/" : "/V1/mf/app-host/",
    // NFR-07: port 5174, strictPort, CORS on the dev server (no vite preview: the build is served by scripts/serve.mjs)
    server: { port: 5174, strictPort: true, origin: "http://localhost:5174", cors: true },
    plugins: [
      react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
      federation({
        name: "appHost",
        filename: "remoteEntry.js",
        // FR-06: exposes ./App
        exposes: { "./App": "./src/App.tsx" },
        // FR-07 / NFR-05: static remote useCaseA (spec: cad). TODO: hardcoded URL instead of VITE_CAD_URL, remoteEntry.js instead of mf-manifest.json
        // FR-15: TODO static loader only, no runtime loader and no VITE_CAD_LOADER switch
        remotes: {
          useCaseA: remote("useCaseA", 5175, "use-case-a", dev, manifest ? "mf-manifest.json" : undefined),
          // Experiment only (experiments/separate-repos): declared so import("useCaseB/App") resolves; with loaded-first
          // its entry is fetched only when the route exists (VITE_USE_CASE_B) and is opened
          useCaseB: remote("useCaseB", 5176, "use-case-b", dev),
        },
        // NFR-02: shared config from config/federation-shared.ts (identical in all apps)
        shared: federationShared,
        // NFR-08: loaded-first, so the shell (loaded first) provides the singletons and remote entries load only when used;
        // version-first fetched every declared entry at startup and let the last remote provide React. Identical in all apps (NFR-02)
        shareStrategy: "loaded-first",
      }),
    ],
    // NFR-06: build.target esnext
    build: { target: "esnext" },
  };
});
