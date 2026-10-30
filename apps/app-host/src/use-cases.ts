// Single source for catalog, sidebar and routes
export const USE_CASES = [
  {
    id: "use-case-a",
    remoteId: "useCaseA",
    path: "use-case-a",
    title: "Use case A",
    subtitle: "Example use case loaded by App Host.",
    entry: import.meta.env.DEV ? "http://localhost:5175/remoteEntry.js" : "mf/use-case-a/remoteEntry.js",
  },
] as const;

export type UseCase = (typeof USE_CASES)[number];
