import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { chunkFileName } from "../../config/chunk-names";
import { federationShared } from "../../config/federation-shared";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/V1/mf/app-host/" : "/",
  server: { port: 5174, strictPort: true, origin: "http://localhost:5174", cors: true },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "appHost",
      filename: "remoteEntry.js",
      // FR-06: exposes ./App for the shell
      exposes: { "./App": "./src/App.tsx" },
      // FR-07: TODO the spec names mf-manifest.json; this remote is remoteEntry.js (its URL is in use-cases.ts)
      // NFR-08: shareStrategy is not set here, so the default (version-first) applies; the shell uses loaded-first
      shared: federationShared,
    }),
  ],
  build: { target: "esnext", rollupOptions: { output: { chunkFileNames: chunkFileName } } },
}));
