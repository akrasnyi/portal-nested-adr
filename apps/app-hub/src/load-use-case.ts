import { getInstance, loadRemote, registerRemotes } from "@module-federation/runtime";
import type { ComponentType } from "react";

import type { UseCase } from "./use-cases";

const stagePrefix = () => (import.meta.env.DEV ? "" : "/V1");
const resolveEntry = (entry: string) =>
  /^https?:\/\//.test(entry) ? entry : new URL(entry, `${window.location.origin}${stagePrefix()}/`).href;

const registered = new Set<string>();
const failures = new Map<string, number>();

// Lazy: registered on the first render of the use-case route, not when App Hub mounts
export const loadUseCase = async (uc: UseCase): Promise<{ default: ComponentType }> => {
  // Evidence for docs/results.md: which runtime instance the module-level functions hit
  const g = globalThis as any;
  g.__appHubProbe = {
    moduleLevelInstance: getInstance()?.name ?? null,
    instances: (g.__FEDERATION__?.__INSTANCES__ ?? []).map((i: any) => i.name),
  };
  if (!registered.has(uc.remoteId)) {
    registerRemotes([{ name: uc.remoteId, entry: resolveEntry(uc.entry), type: "module" }]);
    registered.add(uc.remoteId);
  }
  let mod: { default: ComponentType } | null;
  try {
    mod = await loadRemote<{ default: ComponentType }>(`${uc.remoteId}/App`);
  } catch (e) {
    // The browser memoises a failed import() per URL: the next attempt needs a new entry URL
    const n = (failures.get(uc.remoteId) ?? 0) + 1;
    failures.set(uc.remoteId, n);
    registerRemotes([{ name: uc.remoteId, entry: `${resolveEntry(uc.entry)}?retry=${n}`, type: "module" }], {
      force: true,
    });
    throw e;
  }
  if (!mod) throw new Error(`Remote "${uc.remoteId}" returned no module`);
  return mod;
};
