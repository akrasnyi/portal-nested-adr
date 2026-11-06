import { RemoteBoundary, RequireModule } from "@portal/contract";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { HomePage } from "@/pages/home";
import { ROUTER_BASENAME } from "@/shared/routes/routes";
import { PortalLayout } from "@/widgets/portal-layout/PortalLayout";

export const router = createBrowserRouter(
  [
    {
      element: <PortalLayout />,
      children: [
        { path: "/", element: <HomePage /> },
        // FR-02: /app-host/* renders App Host from the static remote (shell vite.config.ts), loaded on first visit
        {
          path: "/app-host/*",
          element: (
            <RequireModule moduleId="app-host">
              {/* No canRetryLoad: a failed static remote stays failed in the browser module map and the MF runtime, so only a page reload recovers */}
              <RemoteBoundary id="appHost" load={() => import("appHost/App")} />
            </RequireModule>
          ),
        },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename: ROUTER_BASENAME },
);
