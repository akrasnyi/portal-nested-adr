// Glue 2/2: what the built-in dts of newer plugin versions does in the host build. Needs the remote to be reachable.
import { consumeTypes } from "@module-federation/dts-plugin/core";

await consumeTypes({
  host: {
    moduleFederationConfig: {
      name: "typesHost",
      remotes: { typesRemote: `typesRemote@${process.env.REMOTE_URL ?? "http://localhost:5176"}/remoteEntry.js` },
    },
    context: process.cwd(),
    typesFolder: "@mf-types",
    abortOnError: true,
    maxRetries: 1,
  },
});
console.log("consumeTypes done");
