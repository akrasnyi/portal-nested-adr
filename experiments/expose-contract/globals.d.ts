declare const __MODE__: string;
declare const __URLS__: Record<"host" | "mid" | "leaf", string>;
declare module "shellx/contract" {
  export * from "../host/src/contract";
}
