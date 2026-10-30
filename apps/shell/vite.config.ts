import path from "node:path";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/V1/mf/shell/" : "/",
  server: { port: 5170, strictPort: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    // Host only: remotes are registered at runtime from config.json (src/core/federation)
    federation({ name: "portal_host", shared: federationShared }),
  ],
  build: { target: "esnext" },
}));
