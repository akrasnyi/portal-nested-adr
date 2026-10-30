const stagePrefix = () => (import.meta.env.DEV ? "" : "/V1");

// Relative entries resolve against origin + stage prefix, not the current URL, so deep links don't break them
export const resolveRemoteEntry = (entry: string): string =>
  /^https?:\/\//.test(entry) ? entry : new URL(entry, `${window.location.origin}${stagePrefix()}/`).href;
