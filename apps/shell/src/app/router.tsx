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
        {
          path: "/app-host/*",
          element: (
            <RequireModule moduleId="app-host">
              <RemoteBoundary id="appHost" load={() => loadRemoteApp("appHost")} />
            </RequireModule>
          ),
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: ROUTER_BASENAME },
);
