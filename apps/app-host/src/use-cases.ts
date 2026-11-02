import type { RemoteModule } from "@portal/contract";

// Single source for catalog, sidebar and routes. Remote names and entries live in vite.config.ts (static remotes)
const useCaseA = {
  id: "use-case-a",
  remoteId: "useCaseA",
  path: "use-case-a",
  title: "Use case A",
  subtitle: "Example use case loaded by App Host.",
  // FR-07: static import of a build-time remote; @module-federation/vite turns it into loadRemote("useCaseA/App")
  load: (): Promise<RemoteModule> => import("useCaseA/App"),
};

// Experiment only (experiments/separate-repos): a remote built in another repo. Off unless VITE_USE_CASE_B is set at build time
const useCaseB = {
  id: "use-case-b",
  remoteId: "useCaseB",
  path: "use-case-b",
  title: "Use case B",
  subtitle: "Remote built in a separate repo.",
  load: (): Promise<RemoteModule> => import("useCaseB/App"),
};

export const USE_CASES: readonly (typeof useCaseA | typeof useCaseB)[] = import.meta.env.VITE_USE_CASE_B
  ? [useCaseA, useCaseB]
  : [useCaseA];

export type UseCase = (typeof USE_CASES)[number];
