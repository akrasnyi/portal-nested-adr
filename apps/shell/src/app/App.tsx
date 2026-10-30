import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/core/providers/app-providers";

import { router } from "./router";

export const App = () => (
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
