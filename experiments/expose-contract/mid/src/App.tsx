import { loadRemote, registerRemotes } from "@module-federation/runtime";
import { type ComponentType, lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const Leaf = lazy(async () => {
  registerRemotes([{ name: "leafx", entry: `${__URLS__.leaf}/remoteEntry.js`, type: "module" }]);
  return (await loadRemote<{ default: ComponentType }>("leafx/App"))!;
});

export default () => (
  <Suspense fallback="loading leaf...">
    <Routes>
      <Route path="leaf/*" element={<Leaf />} />
    </Routes>
  </Suspense>
);
