import { BreadcrumbsProvider } from "@portal/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { StubAuthProvider } from "@/features/auth";

import { queryClient } from "./query-client";

// FR-01: single QueryClientProvider, AuthProvider with fake user (StubAuthProvider), BreadcrumbsProvider in place of LayoutProvider
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <StubAuthProvider>
      <BreadcrumbsProvider>{children}</BreadcrumbsProvider>
    </StubAuthProvider>
  </QueryClientProvider>
);
