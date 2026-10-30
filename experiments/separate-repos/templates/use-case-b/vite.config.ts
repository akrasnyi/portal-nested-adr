import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "./federation-shared";

export default defineConfig({
  base: "/V1/mf/use-case-b/",
  server: { port: 5176, strictPort: true, origin: "http://localhost:5176", cors: true },
  plugins: [
    react(),
    federation({
      name: "useCaseB",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      shared: federationShared,
      // MF_DTS=true: scenario "does 1.7.2 generate types?" (it does not)
      ...(process.env.MF_DTS === "true" ? { dts: true } : {}),
    } as Parameters<typeof federation>[0]),
  ],
  build: { target: "esnext" },
});
