import path from "node:path";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { chunkFileName } from "../../config/chunk-names";
import { federationShared } from "../../config/federation-shared";

export default defineConfig(({ command, mode }) => {
  // NFR-05: VITE_APP_HOST_URL is the full URL of App Host's remoteEntry.js; the defaults are the dev server and the single-origin build
  const { VITE_APP_HOST_URL } = loadEnv(mode, __dirname, "VITE_");
  const appHostEntry =
    VITE_APP_HOST_URL || (command === "build" ? "/V1/mf/app-host/remoteEntry.js" : "http://localhost:5174/remoteEntry.js");

  return {
    base: command === "build" ? "/V1/mf/shell/" : "/",
    server: { port: 5170, strictPort: true },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    plugins: [
      react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
      federation({
        name: "portal_host",
        // FR-03, NFR-03: the shell's only remote. Use cases are never named here; App Host loads them at runtime
        remotes: { appHost: { type: "module", name: "appHost", entry: appHostEntry } },
        // The default version-first fetches the remoteEntry of every remote named in an import() in source, so the
        // home page would load App Host before its route opens. loaded-first fetches it on first use
        shareStrategy: "loaded-first",
        shared: federationShared,
      }),
    ],
    build: { target: "esnext", rollupOptions: { output: { chunkFileNames: chunkFileName } } },
  };
});
