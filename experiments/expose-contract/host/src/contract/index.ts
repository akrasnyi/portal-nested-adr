import { createContext, createElement, type ReactNode, useContext } from "react";

// negative-control signal: how many times (and from which URLs) this module is evaluated
const g = globalThis as any;
g.__contractEvaluations = (g.__contractEvaluations ?? 0) + 1;
g.__contractUrls = [...(g.__contractUrls ?? []), import.meta.url];

export const AuthContext = createContext<{ user: string } | null>(null);

export const AuthProvider = ({ user, children }: { user: string; children: ReactNode }) =>
  createElement(AuthContext.Provider, { value: { user } }, children);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider (second copy of the contract?)");
  return ctx;
};
