import { useBreadcrumb } from "@portal/contract";
import { Link, useParams } from "react-router-dom";

import { ProofPanel } from "../proof/ProofPanel";

export const ReportDetails = () => {
  const { reportId } = useParams();
  useBreadcrumb(`Report ${reportId}`);
  return (
    <>
      <h2>Report {reportId}</h2>
      <Link to="..">Back to dashboard</Link>
      <ProofPanel />
    </>
  );
};
