import { RemoteBoundary, ShellPortal, useBreadcrumb } from "@portal/contract";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import { loadUseCase } from "./load-use-case";
import { USE_CASES } from "./use-cases";

import "./app-host.css";

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
      <ShellPortal target="shell-breadcrumbs">
        <span data-testid="app-host-portal">App Host portal</span>
      </ShellPortal>
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
          {/* FR-08: relative use-case-a/* routes built from USE_CASES; no own Router here */}
          {/* canRetryLoad: loadUseCase re-registers the remote after a failure, so Retry works in place */}
          {USE_CASES.map((uc) => (
            <Route
              key={uc.id}
              path={`${uc.path}/*`}
              element={
                <RemoteBoundary id={uc.remoteId} load={Object.assign(() => loadUseCase(uc), { canRetryLoad: true })} />
              }
            />
          ))}
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </div>
    </div>
  );
}
