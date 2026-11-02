import { BreadcrumbsProvider } from "@portal/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { StubAuthProvider } from "@/features/auth";

import { queryClient } from "./query-client";

// FR-01: TODO spec wants BrowserRouter + LayoutProvider; here one QueryClient, fake-user auth and breadcrumbs (router in App.tsx)
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <StubAuthProvider>
      <BreadcrumbsProvider>{children}</BreadcrumbsProvider>
    </StubAuthProvider>
  </QueryClientProvider>
);
