import { ModuleId } from "@portal/contract";

// Same role mapping as the reference portal
const rolePermissions: Record<string, ModuleId[]> = {
  admin: [ModuleId.Billing, ModuleId.Observability, ModuleId.Documentation, ModuleId.AppHub],
  use_case_viewer: [ModuleId.AppHub],
  metrics_viewer: [ModuleId.Observability],
  billing_viewer: [ModuleId.Billing],
};

export const resolveModules = (userRoles: string): ModuleId[] => {
  if (!userRoles) return [ModuleId.Documentation];
  const modules = new Set<ModuleId>();
  for (const role of userRoles.split(",").map((r) => r.trim())) {
    for (const m of rolePermissions[role] ?? []) modules.add(m);
  }
  modules.add(ModuleId.Documentation);
  return [...modules];
};
