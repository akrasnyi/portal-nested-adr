export type Recovery = "retry" | "reload";

// A remount that fails again within this window is not transient; another Retry would just loop.
const RECENT_REMOUNT_MS = 10_000;

// Browser and MF runtime messages for a failed remote import (Chromium, Firefox, Safari, @module-federation/runtime)
const LOAD_ERROR_MESSAGE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|RUNTIME-\d{3}|Federation Runtime/i;

export class RemoteLoadError extends Error {
  constructor(id: string, cause: unknown) {
    super(`Failed to load remote "${id}"`, { cause });
    this.name = "RemoteLoadError";
  }
}

// The error followed by its cause chain; capped so a cyclic cause cannot loop.
export const errorChain = (error: unknown): unknown[] => {
  const chain: unknown[] = [];
  for (let e: unknown = error; e !== undefined && chain.length < 10 && !chain.includes(e); ) {
    chain.push(e);
    e = e instanceof Error ? e.cause : undefined;
  }
  return chain;
};

export const isLoadError = (error: unknown) =>
  errorChain(error).some(
    (e) =>
      e instanceof RemoteLoadError ||
      (e instanceof Error && (e.name === "ChunkLoadError" || LOAD_ERROR_MESSAGE.test(e.message))),
  );

// A load error is retried in place only when the loader re-registers the remote itself.
// Why a build-time `remotes` entry cannot do that: the browser module map memoises the failed import by URL,
// and the MF runtime keeps the rejected remoteEntry promise in its globalLoading cache, so a remount re-throws
// the same error until reload. The runtime API can: registerRemotes with force: true and a ?retry=n entry
// gets a new URL and clears the runtime cache (see load-use-case.ts).
export const pickRecovery = ({
  error,
  canRetryLoad,
  remountedAt,
  now = Date.now(),
}: {
  error: unknown;
  canRetryLoad: boolean;
  remountedAt: number | null;
  now?: number;
}): Recovery => {
  if (remountedAt !== null && now - remountedAt < RECENT_REMOUNT_MS) return "reload";
  if (isLoadError(error)) return canRetryLoad ? "retry" : "reload";
  return "retry";
};
