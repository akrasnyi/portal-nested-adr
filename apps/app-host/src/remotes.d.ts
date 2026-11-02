// Types for the static remotes declared in vite.config.ts
declare module "useCaseA/App" {
  const App: import("@portal/contract").RemoteApp;
  export default App;
}

declare module "useCaseB/App" {
  const App: import("@portal/contract").RemoteApp;
  export default App;
}
