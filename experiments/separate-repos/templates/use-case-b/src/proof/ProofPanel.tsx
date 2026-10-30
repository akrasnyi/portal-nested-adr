import * as contract from "@portal/contract";
import { AuthContext, useAuth } from "@portal/contract";
import React from "react";

// Set by the shell before any remote loads (spike proof globals)
const shell = () => (window as any).__shell as Record<string, any>;

const contractShare = () => {
  const fed = (globalThis as any).__FEDERATION__;
  // __SHARE__ = { <instance>: { <scope>: { <pkg>: { <version>: entry } } } }; every instance points at the same entry (entry.from)
  const providers = new Set<string>();
  const loaded = new Set<string>();
  for (const scopes of Object.values<any>(fed?.__SHARE__ ?? {}))
    for (const scope of Object.values<any>(scopes))
      for (const [version, entry] of Object.entries<any>(scope["@portal/contract"] ?? {})) {
        providers.add(`${entry.from}@${version}`);
        if (entry.loaded) loaded.add(`${entry.from}@${version}`);
      }
  return { providers: [...providers], loaded: [...loaded] };
};

export const ProofPanel = () => {
  const { user } = useAuth();
  const s = shell();
  const share = contractShare();
  const sameContract = Object.keys(contract).every((k) => (contract as any)[k] === s.contractModule?.[k]);
  const checks = [
    { id: "react", ok: s.React === React, detail: `React ${React.version}` },
    { id: "auth-context", ok: AuthContext === s.AuthContext, detail: "AuthContext identity" },
    { id: "contract-module", ok: sameContract, detail: `${Object.keys(contract).length} exports compared` },
    { id: "auth-user", ok: !!user?.name, detail: user?.name ?? "no user" },
    {
      id: "share-scope",
      ok: share.loaded.length === 1 && share.loaded[0].startsWith("portal_host@"),
      detail: `@portal/contract providers: [${share.providers.join(", ")}]; loaded: [${share.loaded.join(", ")}]`,
    },
  ];
  return (
    <section data-testid="proof-panel">
      <h3>Proof panel (Use case B)</h3>
      <table>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} data-check={c.id} data-result={c.ok ? "pass" : "fail"}>
              <td>{c.id}</td>
              <td>{c.ok ? "PASS" : "FAIL"}</td>
              <td>{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
