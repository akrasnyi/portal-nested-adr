import { loadRemote, registerRemotes } from "@module-federation/runtime";
import React, { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthContext, AuthProvider } from "shellx/contract";

(window as any).__host = { React, AuthContext };

registerRemotes([{ name: "midx", entry: `${__URLS__.mid}/remoteEntry.js`, type: "module" }]);
const Mid = lazy(async () => (await loadRemote<{ default: React.ComponentType }>("midx/App"))!);

const users = ["Alice Admin", "Uma Use-Case"];

const App = () => {
  const [user, setUser] = useState(users[0]);
  return (
    <AuthProvider user={user}>
      <p>
        host ({__MODE__}) user:{" "}
        <select data-testid="user" value={user} onChange={(e) => setUser(e.target.value)}>
          {users.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </p>
      <BrowserRouter>
        <Suspense fallback="loading mid...">
          <Routes>
            <Route path="/mid/*" element={<Mid />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
