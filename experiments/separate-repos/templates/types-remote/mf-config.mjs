// Single source for the federation options, used by the build and by the type generation
export const mfConfig = {
  name: "typesRemote",
  filename: "remoteEntry.js",
  exposes: { "./Widget": "./src/Widget.tsx", "./format": "./src/format.ts" },
  shared: { react: { singleton: true, requiredVersion: "19.0.0" }, "react-dom": { singleton: true, requiredVersion: "19.0.0" } },
};
