import { useAuth } from "./auth";

// Added in 1.1.0 (additive)
export const useHasRole = (role: string) => !!useAuth().user?.roles.includes(role);
