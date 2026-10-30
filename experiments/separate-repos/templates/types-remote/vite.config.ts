import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// @ts-expect-error plain .mjs shared with generate-types.mjs
import { mfConfig } from "./mf-config.mjs";

export default defineConfig({
  base: "/",
  server: { port: 5176, strictPort: true, origin: "http://localhost:5176", cors: true },
  plugins: [react(), federation(mfConfig)],
  build: { target: "esnext" },
});
