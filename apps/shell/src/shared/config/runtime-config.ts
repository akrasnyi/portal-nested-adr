export interface RemoteDescriptor {
  id: string;
  moduleId: string;
  entry: string;
}

export interface RuntimeConfig {
  remotes?: RemoteDescriptor[];
}

let config: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const file = import.meta.env.DEV ? "config.dev.json" : "config.json";
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!res.ok) throw new Error(`Cannot load ${file}: ${res.status}`);
  config = await res.json();
  return config as RuntimeConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!config) throw new Error("Runtime config not loaded");
  return config;
}
