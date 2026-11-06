import * as contract from "@portal/contract";
import { AuthContext, useAuth } from "@portal/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect } from "react";
import * as ReactRouter from "react-router";
import { useInRouterContext, useLocation } from "react-router-dom";

import styles from "./ProofPanel.module.css";

// Set by the shell before any remote loads (spike proof globals)
const shell = () => (window as any).__shell as Record<string, any>;

// FR-13: on in dev; a production build needs VITE_MF_DEBUG=true (build-time, so the logging is compiled out otherwise)
const diagnosticsEnabled = import.meta.env.DEV || import.meta.env.VITE_MF_DEBUG === "true";

let tenantFetched = false;

const shareScopeReport = () => {
  const fed = (globalThis as any).__FEDERATION__;
  const instances: string[] = (fed?.__INSTANCES__ ?? []).map((i: any) => i.name);
  // __SHARE__ = { <instanceName>: { <scope>: { <pkg>: { <version>: entry } } } }. Every instance's
  // map points at the same provider entry (entry.from), so providers are counted by origin, not by instance
  const providers = new Set<string>();
  const loadedFrom = new Set<string>();
  for (const scopes of Object.values<any>(fed?.__SHARE__ ?? {})) {
    for (const scope of Object.values<any>(scopes)) {
      for (const [version, entry] of Object.entries<any>(scope.react ?? {})) {
        providers.add(`${entry.from}@${version}`);
        if (entry.loaded) loadedFrom.add(`${entry.from}@${version}`);
      }
    }
  }
  const loaded = [...loadedFrom].join(", ") || "none";
  return { instances, providers: [...providers], loaded };
};

// FR-13: the table is the proof; with diagnostics on, the same identity checks also go to the console as [mf-check]
export const ProofPanel = () => {
  const queryClient = useQueryClient();
  // FR-09: the auth-user row shows useAuth().user.name
  const { user } = useAuth();
  const { pathname } = useLocation();
  const inRouter = useInRouterContext();
  const tenant = useQuery<{ id: string; name: string }>({
    queryKey: ["tenant"],
    queryFn: () => {
      tenantFetched = true;
      return Promise.reject(new Error("Use case A fetched ['tenant']: cache not shared"));
    },
  });
  const s = shell();
  // NFR-08: one react provider, counted by origin (portal_host), see results.md
  const share = shareScopeReport();
  const sameContract = Object.keys(contract).every((k) => (contract as any)[k] === s.contractModule?.[k]);
  // react-router is shared by react-router-dom: Use case A's router contexts must be the shell's
  const sameRouter =
    ReactRouter.UNSAFE_LocationContext === s.ReactRouter?.UNSAFE_LocationContext &&
    ReactRouter.UNSAFE_NavigationContext === s.ReactRouter?.UNSAFE_NavigationContext;
  const livePathname = window.location.pathname.replace(/^\/V1(?=\/|$)/, "") || "/";

  const checks: { id: string; ok: boolean; detail: string }[] = [
    { id: "react", ok: s.React === React, detail: `React ${React.version}` },
    {
      id: "query-client",
      ok:
        queryClient === s.queryClient &&
        !tenantFetched &&
        !!tenant.data &&
        tenant.data === s.queryClient.getQueryData(["tenant"]),
      detail: `tenant=${JSON.stringify(tenant.data)} fetched=${tenantFetched}`,
    },
    { id: "auth-context", ok: AuthContext === s.AuthContext, detail: "AuthContext identity" },
    { id: "contract-module", ok: sameContract, detail: `${Object.keys(contract).length} exports compared` },
    { id: "auth-user", ok: !!user?.name, detail: user?.name ?? "no user" },
    {
      id: "router",
      ok: inRouter && sameRouter && livePathname === pathname,
      detail: `router path ${pathname}; window path ${window.location.pathname}`,
    },
    {
      id: "share-scope",
      ok: share.providers.length === 1 && share.loaded !== "none",
      detail: `react providers: [${share.providers.join(", ")}]; loaded: ${share.loaded}; instances: [${share.instances.join(", ")}]`,
    },
  ];

  useEffect(() => {
    if (!diagnosticsEnabled) return;
    const w = window as any;
    const results: [string, boolean, string][] = [
      ["react", w.__shellReact === React, `shell React ${w.__shellReact ? "set" : "missing"}`],
      ["query-client", queryClient === w.__shellQueryClient, `shell QueryClient ${w.__shellQueryClient ? "set" : "no"}`],
      ["in-router-context", inRouter, `pathname ${pathname}`],
      ["auth-user", !!user, user?.name ?? "no user"],
    ];
    for (const [id, ok, detail] of results) console.info(`[mf-check] ${id}=${ok} ${detail}`);
  }, [queryClient, user, inRouter, pathname]);

  return (
    <section className={styles.panel} data-testid="proof-panel">
      <h3>Proof panel</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Check</th>
            <th>Result</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} data-check={c.id} data-result={c.ok ? "pass" : "fail"}>
              <td>{c.id}</td>
              <td className={c.ok ? styles.pass : styles.fail}>{c.ok ? "PASS" : "FAIL"}</td>
              <td>{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
