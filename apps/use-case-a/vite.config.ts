import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// NFR-09: fail-fast experiment (docs/results-failures.md, section 4)
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
  // NFR-06: base is an absolute path on the single origin (/V1/mf/use-case-a/), not an absolute URL (http://localhost:5175/)
  base: command === "build" ? "/V1/mf/use-case-a/" : "/",
  // NFR-07: port 5175, strictPort, CORS on the dev server
  server: { port: 5175, strictPort: true, origin: "http://localhost:5175", cors: true },
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
    federation({
      name: "useCaseA",
      filename: "remoteEntry.js",
      // FR-09: Use case A (= CAD) exposes ./App
      exposes: { "./App": "./src/App.tsx" },
      shared,
      // NFR-08: loaded-first, so the shell (loaded first) provides the singletons and remote entries load only when used;
      // version-first fetched every declared entry at startup and let the last remote provide React. Identical in all apps (NFR-02)
      shareStrategy: "loaded-first",
    }),
  ],
  // NFR-06: build.target esnext
  build: { target: "esnext" },
}));
