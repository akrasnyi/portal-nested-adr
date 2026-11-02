import { RemoteBoundary, type RemoteModule, RequireModule } from "@portal/contract";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { HomePage } from "@/pages/home";
import { ROUTER_BASENAME } from "@/shared/routes/routes";
import { PortalLayout } from "@/widgets/portal-layout/PortalLayout";

// Static import of the build-time remote; @module-federation/vite turns it into loadRemote("appHost/App")
const loadAppHost = (): Promise<RemoteModule> => import("appHost/App");

export const router = createBrowserRouter(
  [
    {
      element: <PortalLayout />,
      children: [
        { path: "/", element: <HomePage /> },
        {
          // FR-02: /app-host/* (spec: /app-hub/*) renders App Host via RemoteBoundary = React.lazy(() => import("appHost/App"))
          path: "/app-host/*",
          element: (
            <RequireModule moduleId="app-host">
              <RemoteBoundary id="appHost" load={loadAppHost} />
            </RequireModule>
          ),
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: ROUTER_BASENAME },
);
