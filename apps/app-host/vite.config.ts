import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// Experiment: declare Use case A as a build-time remote instead of registering it at runtime
const staticRemotes = process.env.APP_HOST_STATIC_REMOTES === "1";

export default defineConfig(({ command }) => ({
  define: { "import.meta.env.VITE_STATIC_REMOTES": JSON.stringify(staticRemotes) },
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
      shared: federationShared,
    }),
  ],
  // OFF: the never-called static import must not fail resolution
  build: { target: "esnext", rollupOptions: { external: staticRemotes ? [] : ["useCaseA/App"] } },
}));
