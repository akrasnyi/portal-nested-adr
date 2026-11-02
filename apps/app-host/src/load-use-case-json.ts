import type { RemoteModule } from "@portal/contract";

import { loadUseCase, resolveEntry } from "./load-use-case";
import type { UseCase } from "./use-cases";

// Experiment, variants b/c (docs/results-timing.md): the entry comes from mf/app-host/use-cases.json, resolved by id.
// `early` is the fetch that variant c starts in App.tsx; variant b fetches here, on the route.
// shortcut: a rejected `early` is reused on Retry, no re-fetch; fine for this timing run only.
type Entries = { id: string; entry: string }[];

export const loadUseCaseJson = async (uc: UseCase, early?: Promise<Entries>): Promise<RemoteModule> => {
  const entries = await (early ??
    fetch(resolveEntry("mf/app-host/use-cases.json")).then((r) => {
      if (!r.ok) throw new Error(`use-cases.json: HTTP ${r.status}`);
      return r.json() as Promise<Entries>;
    }));
  const entry = entries.find((e) => e.id === uc.id)?.entry;
  if (!entry) throw new Error(`"${uc.id}" is missing from use-cases.json`);
  return loadUseCase({ ...uc, entry } as UseCase);
};
