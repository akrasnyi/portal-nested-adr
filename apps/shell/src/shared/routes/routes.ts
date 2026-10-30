export const ROUTES = {
  HOME: "/",
  APP_HUB: "/app-hub",
} as const;

// Public URL prefix: "/V1" behind the API gateway, none in dev
export const ROUTER_BASENAME = import.meta.env.DEV ? "/" : "/V1";
