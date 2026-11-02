import { useBreadcrumb } from "@portal/contract";
import { Link, useNavigate } from "react-router-dom";

import { ProofPanel } from "../proof/ProofPanel";

export const Dashboard = () => {
  // FR-10: Link and useNavigate for in-app navigation. TODO Forward not verified (Back only, results.md)
  useBreadcrumb("Dashboard");
  const navigate = useNavigate();
  return (
    <>
      <h2>Use case A Dashboard</h2>
      <Link to="reports/42">Report 42</Link>{" "}
      <button type="button" data-testid="navigate-report" onClick={() => navigate("reports/42")}>
        useNavigate("reports/42")
      </button>{" "}
      <Link to="crash">Crash (failure experiment)</Link>
      <ProofPanel />
    </>
  );
};
