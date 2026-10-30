import { useBreadcrumb } from "@portal/contract";
import { Route, Routes } from "react-router-dom";

import { Dashboard } from "./pages/Dashboard";
import { ReportDetails } from "./pages/ReportDetails";

const Crash = () => {
  throw new Error("Use case A crash route: deliberate render error");
};

export default function App() {
  useBreadcrumb("Use case A");
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="crash" element={<Crash />} />
      <Route path="reports/:reportId" element={<ReportDetails />} />
    </Routes>
  );
}
