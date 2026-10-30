import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// Failure experiment switches (default: healthy build). UCA_REACT_REQUIRED=19.1.0 makes Use case A demand a React the shell does not provide;
// UCA_STRICT=false turns strictVersion off for that mismatch.
const { UCA_REACT_REQUIRED, UCA_STRICT } = process.env;
const shared = UCA_REACT_REQUIRED
  ? {
      ...federationShared,
      ...Object.fromEntries(
        ["react", "react-dom"].map((k) => [
          k,
          { ...federationShared[k], requiredVersion: UCA_REACT_REQUIRED, strictVersion: UCA_STRICT !== "false" },
        ]),
      ),
    }
  : federationShared;

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/V1/mf/use-case-a/" : "/",
  server: { port: 5175, strictPort: true, origin: "http://localhost:5175", cors: true },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "useCaseA",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      shared,
    }),
  ],
  build: { target: "esnext" },
}));
