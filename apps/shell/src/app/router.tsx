import { RemoteBoundary, RequireModule } from "@portal/contract";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { loadRemoteApp } from "@/core/federation";
import { HomePage } from "@/pages/home";
import { ROUTER_BASENAME } from "@/shared/routes/routes";
import { PortalLayout } from "@/widgets/portal-layout/PortalLayout";

export const router = createBrowserRouter(
  [
    {
      element: <PortalLayout />,
      children: [
        { path: "/", element: <HomePage /> },
        // Option A: the route loads appHost at runtime (loadRemoteApp → loadRemote); FR-02: /app-host/* renders App Host
        {
          path: "/app-host/*",
          element: (
            <RequireModule moduleId="app-host">
              {/* canRetryLoad: loadRemoteApp re-registers appHost after a failure, so Retry works in place */}
              <RemoteBoundary id="appHost" load={Object.assign(() => loadRemoteApp("appHost"), { canRetryLoad: true })} />
            </RequireModule>
          ),
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: ROUTER_BASENAME },
);
