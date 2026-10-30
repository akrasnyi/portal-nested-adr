import path from "node:path";
import { makeConfig, mode } from "../common";

// SELF_URL overrides the host's own self-remote entry (URL-sensitivity test)
export default makeConfig(
  "host",
  "shellx",
  (urls) => ({
    exposes: { "./contract": "./src/contract/index.ts" },
    ...(mode === "self" && {
      remotes: {
        shellx: { type: "module", name: "shellx", entry: process.env.SELF_URL ?? `${urls.host}/remoteEntry.js` },
      },
    }),
  }),
  // host code always imports "shellx/contract": local mode points it at the local file, self mode leaves it to the self-remote
  mode === "self" ? {} : { "shellx/contract": path.resolve(__dirname, "src/contract") },
);
