import { useBreadcrumb } from "@portal/contract";
import { Route, Routes } from "react-router-dom";

import { Dashboard } from "./pages/Dashboard";
import { ReportDetails } from "./pages/ReportDetails";

const Crash = () => {
  throw new Error("Use case A crash route: deliberate render error");
};

// FR-09 / FR-11a: Use case A (= CAD) root; sets its breadcrumb
export default function App() {
  useBreadcrumb("Use case A");
  // FR-10: internal routes (index, reports/:reportId) on the shell's router; no own Router
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="crash" element={<Crash />} />
      <Route path="reports/:reportId" element={<ReportDetails />} />
    </Routes>
  );
}
