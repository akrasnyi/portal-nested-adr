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

// FR-12: on in dev; a production build needs VITE_MF_DEBUG=true (build-time, so the branch is compiled out otherwise)
const diagnosticsEnabled = import.meta.env.DEV || import.meta.env.VITE_MF_DEBUG === "true";

// Spike proof globals: set BEFORE any remote loads, remotes compare their imports against these
window.__shell = { React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule };

// FR-12: the names the spec uses for the remote-side [mf-check] comparison (ProofPanel)
if (diagnosticsEnabled) {
  window.__shellReact = React;
  window.__shellQueryClient = queryClient;
  console.info("[mf-check] shell: __shellReact and __shellQueryClient set");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
