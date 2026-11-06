// Types for App Host, the shell's only remote (apps/shell/vite.config.ts). Loaded at runtime from the remote's URL
declare module "appHost/App" {
  const App: import("@portal/contract").RemoteApp;
  export default App;
}
