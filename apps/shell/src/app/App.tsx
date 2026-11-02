import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/core/providers/app-providers";

import { router } from "./router";

// FR-01: providers mounted once at the root. Router is RouterProvider(createBrowserRouter), not BrowserRouter
export const App = () => (
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
