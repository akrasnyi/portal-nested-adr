import { useAuth } from "@portal/contract";

export const HomePage = () => (
  <>
    <h1>Home</h1>
    <p>Signed in as {useAuth().user?.name}. Open App Host to load app-host, then Use case A.</p>
  </>
);
