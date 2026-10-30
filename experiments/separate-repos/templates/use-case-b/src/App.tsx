import { type RemoteApp, useAuth, useBreadcrumb } from "@portal/contract";

import { ProofPanel } from "./proof/ProofPanel";

// Typed as RemoteApp: the same type the loaders use in loadRemote<RemoteModule>("useCaseB/App")
const App: RemoteApp = () => {
  useBreadcrumb("Use case B");
  const { user } = useAuth();
  return (
    <>
      <h2>Use case B Dashboard</h2>
      <p data-testid="b-user">Hello {user?.name ?? "nobody"}</p>
      <ProofPanel />
    </>
  );
};

export default App;
