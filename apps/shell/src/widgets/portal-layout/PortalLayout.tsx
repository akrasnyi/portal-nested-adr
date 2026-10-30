import { useAuth, useBreadcrumb, useBreadcrumbs } from "@portal/contract";
import { Link, Outlet, useLocation } from "react-router-dom";

import { TEST_USER_KEYS, useUserSwitch } from "@/features/auth";
import { ROUTES } from "@/shared/routes/routes";

import "./portal-layout.css";

export const PortalLayout = () => {
  useBreadcrumb("Home");
  const crumbs = useBreadcrumbs();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { key, setKey } = useUserSwitch();
  return (
    <>
      <header className="portal-header">
        <strong>Portal shell</strong>
        <Link to={ROUTES.HOME}>Home</Link>
        <Link to={ROUTES.APP_HUB}>App Hub</Link>
        <label>
          User{" "}
          <select data-testid="user-select" value={key} onChange={(e) => setKey(e.target.value)}>
            {TEST_USER_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="shell-user">{user?.name}</span>
        <span>
          path: <code data-testid="shell-pathname">{pathname}</code>
        </span>
        <nav data-testid="breadcrumbs">{crumbs.join(" > ")}</nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
};
