import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { federationShared } from "../../config/federation-shared";

// local | self (see docs/results-expose-contract.md)
export const mode = process.env.CONTRACT_MODE ?? "local";
const ports = { host: 5180, mid: 5181, leaf: 5182 } as const;
type App = keyof typeof ports;
const bind = process.env.BIND ? true : undefined; // BIND=1: listen on all interfaces (needed to reach 127.0.0.1)

// dev: :518x, build (vite preview): :418x; override with HOST_URL / MID_URL / LEAF_URL (origin only)
const origin = (app: App, build: boolean) =>
  process.env[`${app.toUpperCase()}_URL`] ?? `http://localhost:${ports[app] - (build ? 1000 : 0)}`;

export const makeConfig = (
  app: App,
  name: string,
  fed: (urls: Record<App, string>) => Record<string, unknown>,
  alias: Record<string, string> = {},
) =>
  defineConfig(({ command }) => {
    const build = command === "build";
    const urls = Object.fromEntries((Object.keys(ports) as App[]).map((a) => [a, origin(a, build)])) as Record<
      App,
      string
    >;
    return {
      // absolute base: remote chunks must load from the remote's origin, not the host's
      base: build ? `${urls[app]}/` : "/",
      server: { host: bind, port: ports[app], strictPort: true, origin: urls[app], cors: true },
      preview: { host: bind, port: ports[app] - 1000, strictPort: true, cors: true },
      resolve: { alias },
      define: { __MODE__: JSON.stringify(mode), __URLS__: JSON.stringify(urls) },
      plugins: [
        react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }),
        federation({
          name,
          filename: "remoteEntry.js",
          // contract is not a package here, so it is NOT shared
          shared: Object.fromEntries(Object.entries(federationShared).filter(([k]) => k !== "@portal/contract")),
          ...fed(urls),
        }),
      ],
      build: { target: "esnext" },
    };
  });
