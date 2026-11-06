import { ShellPortal, useBreadcrumb } from "@portal/contract";
import { Route, Routes } from "react-router-dom";

import { Dashboard } from "./pages/Dashboard";
import { ReportDetails } from "./pages/ReportDetails";

const Crash = () => {
  throw new Error("Use case A crash route: deliberate render error");
};

// FR-09: exposed as ./App; the user name is shown by ProofPanel
export default function App() {
  // FR-11: (a) breadcrumb via the shell's context, (b) content in the shell's #shell-breadcrumbs node
  useBreadcrumb("Use case A");
  return (
    <>
      <ShellPortal target="shell-breadcrumbs">
        <span data-testid="use-case-a-portal">Use case A portal</span>
      </ShellPortal>
      {/* FR-10: nested relative routes; no Router here (the shell's and App Host's are used) */}
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="crash" element={<Crash />} />
        <Route path="reports/:reportId" element={<ReportDetails />} />
      </Routes>
    </>
  );
}
