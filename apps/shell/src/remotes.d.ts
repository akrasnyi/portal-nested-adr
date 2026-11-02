// Types for the static remote declared in vite.config.ts
declare module "appHost/App" {
  const App: import("@portal/contract").RemoteApp;
  export default App;
}
