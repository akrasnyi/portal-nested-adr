// Single source for catalog, sidebar and routes
const useCaseA = {
    id: "use-case-a",
    remoteId: "useCaseA",
    path: "use-case-a",
    title: "Use case A",
    subtitle: "Example use case loaded by App Host.",
    entry: import.meta.env.DEV ? "http://localhost:5175/remoteEntry.js" : "mf/use-case-a/remoteEntry.js",
} as const;

// Experiment only (experiments/separate-repos): a remote built in another repo. Off unless VITE_USE_CASE_B is set at build time
const useCaseB = {
  id: "use-case-b",
  remoteId: "useCaseB",
  path: "use-case-b",
  title: "Use case B",
  subtitle: "Remote built in a separate repo.",
  entry: import.meta.env.DEV ? "http://localhost:5176/remoteEntry.js" : "mf/use-case-b/remoteEntry.js",
} as const;

export const USE_CASES: readonly (typeof useCaseA | typeof useCaseB)[] = import.meta.env.VITE_USE_CASE_B
  ? [useCaseA, useCaseB]
  : [useCaseA];

export type UseCase = (typeof USE_CASES)[number];
