import type { RemoteApp } from "@portal/contract";

// "./App" takes no props: a component that requires props is not a RemoteApp
export const App: RemoteApp = (props: { id: string }) => <p>{props.id}</p>;
