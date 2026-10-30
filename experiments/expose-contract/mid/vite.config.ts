import { makeConfig } from "../common";

export default makeConfig("mid", "midx", () => ({ exposes: { "./App": "./src/App.tsx" } }));
