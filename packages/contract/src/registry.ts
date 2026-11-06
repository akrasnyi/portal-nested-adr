import { type Context, createContext } from "react";

// FR-14: a copy of this module bundled twice must still resolve to the SAME context object,
// otherwise a remote's useAuth() or useBreadcrumb() reads an empty default from its own copy.
// The global registry (keyed by Symbol.for) is shared by every copy in the realm.
export const getOrCreateContext = <T>(name: string, defaultValue: T): Context<T> => {
  const key = Symbol.for(`shell.${name}.context`);
  const registry = globalThis as unknown as Record<symbol, Context<T> | undefined>;
  registry[key] ??= createContext<T>(defaultValue);
  return registry[key];
};
