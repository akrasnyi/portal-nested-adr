import { useAuth } from "@portal/contract";

export const HomePage = () => (
  <>
    <h1>Home</h1>
    <p>Signed in as {useAuth().user?.name}. Open App Hub to load app-hub, then Use case A.</p>
  </>
);
