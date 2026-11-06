import * as contractModule from "@portal/contract";
import { AuthContext } from "@portal/contract";
import React from "react";
import ReactDOM from "react-dom/client";
import * as ReactRouter from "react-router";

import { App } from "@/app/App";
import { queryClient } from "@/core/providers/query-client";

declare global {
  interface Window {
    __shell: Record<string, any>;
    __shellReact?: typeof React;
    __shellQueryClient?: typeof queryClient;
  }
}

// VITE_MF_DEBUG=true (dev or build, e.g. `VITE_MF_DEBUG=true npm run build`) turns on the [mf-check] diagnostics.
// Read at build time; unset or any other value means off, and then no __shellReact / __shellQueryClient globals.
const MF_DEBUG = import.meta.env.VITE_MF_DEBUG === "true";

// Spike proof globals: set BEFORE any remote loads, remotes compare their imports against these
window.__shell = { React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule };

// FR-12: the names the spec uses for the remote-side [mf-check] comparison (ProofPanel)
if (MF_DEBUG) {
  window.__shellReact = React;
  window.__shellQueryClient = queryClient;
  console.info("[mf-check] shell: __shellReact and __shellQueryClient set");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
