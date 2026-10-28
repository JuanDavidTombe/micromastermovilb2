import type { RolePermissions, User } from '@/types/models';

export const MODULE_IDS = {
  dashboard: 'dashboard',
  inventory: 'inventory_stock',
  orders: 'orders_delivery',
  recipes: 'recipes_production',
  reports: 'reports_simulations',
  administration: 'administration',
} as const;

export type ModuleId = (typeof MODULE_IDS)[keyof typeof MODULE_IDS];

const FALLBACK_PERMISSIONS: Record<string, RolePermissions> = {
  ADMINISTRADOR: {
    modules: [
      MODULE_IDS.dashboard,
      MODULE_IDS.inventory,
      MODULE_IDS.recipes,
      MODULE_IDS.orders,
      MODULE_IDS.reports,
      MODULE_IDS.administration,
    ],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete', 'download'],
  },
  OPERARIO_LOGISTICO: {
    modules: [MODULE_IDS.inventory, MODULE_IDS.orders],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete'],
  },
  SUPERVISOR_PRODUCCION: {
    modules: [MODULE_IDS.recipes],
    read_modules: [MODULE_IDS.inventory],
    can: ['create', 'read', 'update', 'delete'],
  },
  CONTADOR: {
    modules: [MODULE_IDS.reports],
    read_modules: [],
    can: ['read', 'download'],
  },
  TRANSPORTISTA: {
    modules: [MODULE_IDS.orders],
    read_modules: [],
    can: ['create', 'read', 'update'],
  },
};

export function getRolePermissions(user: User | null): RolePermissions {
  const remote = user?.role_permissions;
  if (remote && ((remote.modules?.length ?? 0) > 0 || (remote.read_modules?.length ?? 0) > 0)) {
    return remote;
  }
  return FALLBACK_PERMISSIONS[user?.role ?? ''] ?? { modules: [], read_modules: [], can: [] };
}

export function canReadModule(user: User | null, moduleId: string): boolean {
  const perms = getRolePermissions(user);
  return (
    (perms.modules?.includes(moduleId) ?? false) ||
    (perms.read_modules?.includes(moduleId) ?? false)
  );
}

export function canWriteModule(user: User | null, moduleId: string): boolean {
  const perms = getRolePermissions(user);
  return (perms.modules?.includes(moduleId) ?? false) && (perms.can?.includes('create') ?? false);
}

export function isDriver(user: User | null): boolean {
  return user?.role === 'TRANSPORTISTA';
}

export function isLogistics(user: User | null): boolean {
  return user?.role === 'OPERARIO_LOGISTICO' || user?.role === 'AUXILIAR_BODEGA';
}

export function isWarehouseOperator(user: User | null): boolean {
  return isLogistics(user);
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'ADMINISTRADOR';
}

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  OPERARIO_LOGISTICO: 'Operario Logístico',
  SUPERVISOR_PRODUCCION: 'Supervisor de Producción',
  CONTADOR: 'Contador',
  TRANSPORTISTA: 'Conductor',
};

export function roleLabel(role?: string): string {
  return (role && ROLE_LABELS[role]) ?? 'Operador';
}
