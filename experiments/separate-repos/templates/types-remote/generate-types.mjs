// Glue 1/2: what the built-in dts of newer plugin versions does at build time. Run after `vite build`.
import { generateTypes } from "@module-federation/dts-plugin/core";
import { mfConfig } from "./mf-config.mjs";

await generateTypes({
  remote: {
    moduleFederationConfig: mfConfig,
    context: process.cwd(),
    tsConfigPath: "./tsconfig.json",
    typesFolder: "@mf-types",
    outputDir: "dist", // zip lands next to remoteEntry.js
    generateAPITypes: true,
    compileInChildProcess: false,
  },
});
console.log("generateTypes done");
