import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
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
      // FR-07: TODO no remote by default (Option A: URL in use-cases.ts); spec wants mf-manifest.json from a VITE_* URL
      // NFR-08: shareStrategy is not set, so the default (version-first) applies in every app
      shared: federationShared,
    }),
  ],
  build: { target: "esnext" },
}));
