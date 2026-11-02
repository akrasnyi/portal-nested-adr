import { RemoteBoundary, useBreadcrumb } from "@portal/contract";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import { loadUseCase, resolveEntry } from "./load-use-case";
import { USE_CASES } from "./use-cases";

import "./app-host.css";

// Experiment, variant c: start the use-cases.json fetch at module evaluation, so it overlaps with the route chunk
const useCaseEntries =
  import.meta.env.VITE_VARIANT === "c" ? fetch(resolveEntry("mf/app-host/use-cases.json")).then((r) => r.json()) : undefined;

const Catalog = () => (
  <section>
    <h2>Catalog</h2>
    {USE_CASES.map((uc) => (
      <article key={uc.id}>
        <h3>{uc.title}</h3>
        <p>{uc.subtitle}</p>
        <Link to={uc.path}>Open {uc.title}</Link>
      </article>
    ))}
  </section>
);

export default function App() {
  useBreadcrumb("App Host");
  return (
    <div className="app-host">
      <aside>
        <h2>App Host</h2>
        <ul>
          <li>
            <Link to=".">Catalog</Link>
          </li>
          {USE_CASES.map((uc) => (
            <li key={uc.id}>
              <Link to={uc.path}>{uc.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
      <div className="content">
        <Routes>
          <Route index element={<Catalog />} />
          {USE_CASES.map((uc) => (
            <Route
              key={uc.id}
              path={`${uc.path}/*`}
              element={<RemoteBoundary id={uc.remoteId} load={() =>
                import.meta.env.VITE_STATIC_REMOTES
                  ? import("./load-static").then((m) => m.loadStatic(uc))
                  : import.meta.env.VITE_VARIANT === "b" || import.meta.env.VITE_VARIANT === "c"
                    ? import("./load-use-case-json").then((m) => m.loadUseCaseJson(uc, useCaseEntries))
                    : loadUseCase(uc)
              } />}
            />
          ))}
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </div>
    </div>
  );
}
