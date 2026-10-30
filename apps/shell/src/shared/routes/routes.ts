export const ROUTES = {
  HOME: "/",
  APP_HOST: "/app-host",
} as const;

// Public URL prefix: "/V1" behind the API gateway, none in dev
export const ROUTER_BASENAME = import.meta.env.DEV ? "/" : "/V1";
