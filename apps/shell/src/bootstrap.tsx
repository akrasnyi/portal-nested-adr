import * as contractModule from "@portal/contract";
import { AuthContext } from "@portal/contract";
import React from "react";
import ReactDOM from "react-dom/client";
import * as ReactRouter from "react-router";

import { App } from "@/app/App";
import { initFederation } from "@/core/federation";
import { queryClient } from "@/core/providers/query-client";
import { loadRuntimeConfig } from "@/shared/config/runtime-config";

declare global {
  interface Window {
    __shell: Record<string, any>;
  }
}

await loadRuntimeConfig();
initFederation();
// Spike proof globals: set BEFORE any remote loads, remotes compare their imports against these
window.__shell = { React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
