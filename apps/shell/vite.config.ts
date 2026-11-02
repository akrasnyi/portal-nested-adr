import path from "node:path";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

export default defineConfig(({ command }) => ({
  // NFR-06: shell base is an absolute path on the single origin (/V1/mf/shell/)
  base: command === "build" ? "/V1/mf/shell/" : "/",
  // NFR-07: fixed port 5170, strictPort
  server: { port: 5170, strictPort: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "portal_host",
      // FR-03 / NFR-03: the only static remote is appHost (spec: appHub); use-case-a is reachable only through App Host
      // NFR-05: TODO hardcoded URL instead of VITE_APP_HUB_URL (dev server origin in dev, absolute path on the single origin in the build)
      remotes: {
        appHost: {
          type: "module",
          name: "appHost",
          entry: command === "build" ? "/V1/mf/app-host/remoteEntry.js" : "http://localhost:5174/remoteEntry.js",
        },
      },
      // NFR-02: shared config from config/federation-shared.ts (identical in all apps)
      shared: federationShared,
      // NFR-08: loaded-first, so the shell (loaded first) provides the singletons and remote entries load only when used;
      // version-first fetched every declared entry at startup and let the last remote provide React. Identical in all apps (NFR-02)
      shareStrategy: "loaded-first",
    }),
  ],
  // NFR-06: build.target esnext (top-level await in the generated remote modules)
  build: { target: "esnext" },
}));
