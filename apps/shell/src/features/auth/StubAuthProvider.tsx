import { AuthProvider, type AuthUser } from "@portal/contract";
import { createContext, type ReactNode, useContext, useState } from "react";

import { resolveModules } from "./permissions";

const TEST_USERS: Record<string, { name: string; roles: string }> = {
  admin: { name: "Alice Admin", roles: "admin" },
  usecase: { name: "Uma Use-Case", roles: "use_case_viewer" },
  billing: { name: "Bob Billing", roles: "billing_viewer" },
  noroles: { name: "Nick NoRoles", roles: "" },
};
export const TEST_USER_KEYS = Object.keys(TEST_USERS);

const STORAGE_KEY = "portal-test-user";

const initialKey = () => {
  const fromUrl = new URLSearchParams(window.location.search).get("user");
  let key = fromUrl && fromUrl in TEST_USERS ? fromUrl : null;
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else key = localStorage.getItem(STORAGE_KEY);
  } catch {}
  return key && key in TEST_USERS ? key : "admin";
};

const toAuthUser = (key: string): AuthUser => {
  const { name, roles } = TEST_USERS[key];
  return { name, roles: roles ? roles.split(",") : [], allowedModules: resolveModules(roles) };
};

const UserSwitchContext = createContext<{ key: string; setKey: (k: string) => void } | null>(null);

export const useUserSwitch = () => {
  const ctx = useContext(UserSwitchContext);
  if (!ctx) throw new Error("useUserSwitch outside StubAuthProvider");
  return ctx;
};

export const StubAuthProvider = ({ children }: { children: ReactNode }) => {
  const [key, setKeyState] = useState(initialKey);
  const setKey = (k: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, k);
    } catch {}
    setKeyState(k);
  };
  return (
    <UserSwitchContext value={{ key, setKey }}>
      <AuthProvider user={toAuthUser(key)}>{children}</AuthProvider>
    </UserSwitchContext>
  );
};
