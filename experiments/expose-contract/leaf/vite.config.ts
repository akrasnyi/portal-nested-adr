import { makeConfig } from "../common";

// leaf reaches the host's contract through a build-time remote (the colleague's setup)
export default makeConfig("leaf", "leafx", (urls) => ({
  exposes: { "./App": "./src/App.tsx" },
  remotes: { shellx: { type: "module", name: "shellx", entry: `${urls.host}/remoteEntry.js` } },
}));
