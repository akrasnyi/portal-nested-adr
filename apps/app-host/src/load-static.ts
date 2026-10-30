import { loadRemote, registerRemotes } from "@module-federation/runtime";
import type { RemoteModule } from "@portal/contract";

import { resolveEntry } from "./load-use-case";
import type { UseCase } from "./use-cases";

let failures = 0;

// Experiment (APP_HOST_STATIC_REMOTES=1): Use case A is a build-time remote of App Host.
// A failed static import() is memoised by the browser (also the generated loadRemote wrapper module), so a
// retry re-registers the same name with a cache-busting entry and goes through the runtime loadRemote.
export const loadStatic = async (uc: UseCase): Promise<RemoteModule> => {
  if (!failures) {
    try {
      return await import("useCaseA/App");
    } catch (e) {
      failures++;
      throw e;
    }
  }
  registerRemotes([{ name: uc.remoteId, entry: `${resolveEntry(uc.entry)}?retry=${failures++}`, type: "module" }], {
    force: true,
  });
  const mod = await loadRemote<RemoteModule>(`${uc.remoteId}/App`);
  if (!mod) throw new Error(`Remote "${uc.remoteId}" returned no module`);
  return mod;
};
