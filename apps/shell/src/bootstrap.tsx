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
  }
}

// Spike proof globals: set BEFORE any remote loads, remotes compare their imports against these
// FR-12: diagnostics globals as window.__shell.{React, queryClient}. TODO: set unconditionally (not behind VITE_MF_DEBUG), names differ from __shellReact / __shellQueryClient
window.__shell = { React, ReactDOM, ReactRouter, queryClient, AuthContext, contractModule };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
