import { loadRemote, registerRemotes } from "@module-federation/runtime";
import type { ComponentType } from "react";

import { getRuntimeConfig } from "@/shared/config/runtime-config";

import { resolveRemoteEntry } from "./resolve-remote-entry";

export const initFederation = () => {
  const remotes = getRuntimeConfig().remotes ?? [];
  if (remotes.length === 0) return;
  registerRemotes(remotes.map(({ id, entry }) => ({ name: id, entry: resolveRemoteEntry(entry), type: "module" })));
};

const failures = new Map<string, number>();

export const loadRemoteApp = async (id: string): Promise<{ default: ComponentType }> => {
  let mod: { default: ComponentType } | null;
  try {
    mod = await loadRemote<{ default: ComponentType }>(`${id}/App`);
  } catch (e) {
    // The browser memoises a failed import() per URL: the next attempt needs a new entry URL
    const n = (failures.get(id) ?? 0) + 1;
    failures.set(id, n);
    const entry = getRuntimeConfig().remotes?.find((r) => r.id === id)?.entry;
    if (entry)
      registerRemotes([{ name: id, entry: `${resolveRemoteEntry(entry)}?retry=${n}`, type: "module" }], {
        force: true,
      });
    throw e;
  }
  if (!mod) throw new Error(`Remote "${id}" returned no module`);
  return mod;
};
