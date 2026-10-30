import { createContext, type ReactNode, useContext } from "react";
import { Navigate } from "react-router-dom";

export const ModuleId = {
  Billing: "billing",
  Observability: "observability",
  Documentation: "documentation",
  AppHub: "app-hub",
} as const;

export type ModuleId = (typeof ModuleId)[keyof typeof ModuleId];

export interface AuthUser {
  name: string;
  roles: string[];
  allowedModules: ModuleId[];
}

export const AuthContext = createContext<{ user: AuthUser | null } | null>(null);

// Only the shell renders this
export const AuthProvider = ({ user, children }: { user: AuthUser | null; children: ReactNode }) => (
  <AuthContext value={{ user }}>{children}</AuthContext>
);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside the shell's AuthProvider (second copy of @portal/contract?)");
  return ctx;
};

export const useCanAccess = (moduleId: ModuleId) => !!useAuth().user?.allowedModules.includes(moduleId);

// Redirects before children render, so the remote below is never requested
export const RequireModule = ({ moduleId, children }: { moduleId: ModuleId; children: ReactNode }) =>
  useCanAccess(moduleId) ? children : <Navigate to="/" replace />;
