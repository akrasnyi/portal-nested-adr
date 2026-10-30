/// <reference types="vite/client" />
declare global {
  interface Window {
    __shell: Record<string, any>;
  }
}
export {};
