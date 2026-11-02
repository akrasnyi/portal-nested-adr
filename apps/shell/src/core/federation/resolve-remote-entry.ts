const stagePrefix = () => (import.meta.env.DEV ? "" : "/V1");

// Option A: the entry comes from config.json at runtime (FR-03)
// NFR-05: TODO URLs are config data, not VITE_APP_HOST_URL / VITE_USE_CASE_A_URL
// Relative entries resolve against origin + stage prefix, not the current URL, so deep links don't break them
export const resolveRemoteEntry = (entry: string): string =>
  /^https?:\/\//.test(entry) ? entry : new URL(entry, `${window.location.origin}${stagePrefix()}/`).href;
