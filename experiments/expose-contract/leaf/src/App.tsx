import React from "react";
import { AuthContext, useAuth } from "shellx/contract";

export default () => {
  const g = globalThis as any;
  const host = (window as any).__host;
  let user: string | undefined;
  let error = "";
  try {
    user = useAuth().user;
  } catch (e) {
    error = String(e);
  }
  const rows: [string, boolean, string][] = [
    ["auth-context", AuthContext === host.AuthContext, "leaf AuthContext === host AuthContext"],
    ["auth-user", !!user, error || `user=${user}`],
    ["react", React === host.React, `React ${React.version}`],
    ["contract-evaluations", g.__contractEvaluations === 1, `evaluations=${g.__contractEvaluations}`],
  ];
  return (
    <>
      <p data-testid="leaf-user">leaf sees: {user ?? error}</p>
      <table border={1}>
        <tbody>
          {rows.map(([check, ok, detail]) => (
            <tr key={check} data-check={check} data-result={ok ? "PASS" : "FAIL"}>
              <td>{check}</td>
              <td>{ok ? "PASS" : "FAIL"}</td>
              <td>{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <pre data-testid="urls">{JSON.stringify(g.__contractUrls, null, 1)}</pre>
    </>
  );
};
