const ROLE_PERMISSIONS = {
  ADMINISTRADOR: {
    modules: ['dashboard', 'inventory_stock', 'recipes_production', 'orders_delivery', 'reports_simulations', 'administration'],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete', 'download'],
  },
  OPERARIO_LOGISTICO: {
    modules: ['inventory_stock', 'orders_delivery'],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete'],
  },
  SUPERVISOR_PRODUCCION: {
    modules: ['recipes_production'],
    read_modules: ['inventory_stock'],
    can: ['create', 'read', 'update', 'delete'],
  },
  CONTADOR: {
    modules: ['reports_simulations'],
    read_modules: [],
    can: ['read', 'download'],
  },
  TRANSPORTISTA: {
    modules: ['orders_delivery'],
    read_modules: [],
    can: ['create', 'read', 'update'],
  },
};

const ROLE_LABELS = {
  ADMINISTRADOR: 'Administrador',
  OPERARIO_LOGISTICO: 'Operario Logístico',
  SUPERVISOR_PRODUCCION: 'Supervisor Producción',
  CONTADOR: 'Contador',
  TRANSPORTISTA: 'Transportista',
};

export const REGISTRABLE_ROLES = [
  {
    value: 'OPERARIO_LOGISTICO',
    label: 'Operario Logístico',
    description: 'Inventario, lotes y despachos de bodega',
  },
  {
    value: 'SUPERVISOR_PRODUCCION',
    label: 'Supervisor de Producción',
    description: 'Recetas, costos y simulación de escalamiento',
  },
  {
    value: 'CONTADOR',
    label: 'Contador',
    description: 'Reportes, conciliaciones y descargas (solo lectura)',
  },
  {
    value: 'TRANSPORTISTA',
    label: 'Transportista / Conductor',
    description: 'Rutas en campo, GPS, cobro con OTP y novedades',
  },
];

export const REGISTRATION_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
};

export const REGISTRATION_STATUS_META = {
  PENDING: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  ACTIVE: { label: 'Activo', badge: 'bg-green-500/10 text-green-700 border-green-200', dot: 'bg-green-500' },
  REJECTED: { label: 'Rechazado', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export const NAV_ITEMS = [
  { id: '01', label: 'INICIO', icon: 'speedometer2', path: '/', module: 'dashboard', section: 'principal', description: 'KPIs y estado general' },
  { id: '02', label: 'INVENTARIO & STOCK', icon: 'box-seam', path: '/stock', module: 'inventory_stock', section: 'operacion', description: 'Lotes FEFO, proveedor y QR' },
  { id: '03', label: 'RECETAS & PRODUCCIÓN', icon: 'gear', path: '/cost', module: 'recipes_production', section: 'operacion', description: 'Recetas, costos y simulación' },
  { id: '04', label: 'PEDIDOS & ENTREGAS', icon: 'list-task', path: '/orders', altPaths: ['/delivery'], module: 'orders_delivery', section: 'operacion', description: 'Órdenes, rutas y cobro OTP' },
  { id: '05', label: 'REPORTES & SIMULACIONES', icon: 'bar-chart-line', path: '/reports', module: 'reports_simulations', section: 'analisis', description: 'Exportación y conciliación' },
  { id: '06', label: 'ADMINISTRACIÓN', icon: 'sliders', path: '/settings', module: 'administration', section: 'analisis', description: 'Sistema y equipo' },
];

function permsFor(role) {
  return ROLE_PERMISSIONS[role] || { modules: [], read_modules: [], can: [] };
}

export function getModules(role) {
  return permsFor(role).modules;
}

export function getReadModules(role) {
  return permsFor(role).read_modules;
}

export function getVisibleNavItems(role) {
  const allowed = permsFor(role).modules;
  return NAV_ITEMS.filter(item => allowed.includes(item.module));
}

export function getDefaultRoute(role) {
  const moduleMap = {
    OPERARIO_LOGISTICO: '/orders',
    SUPERVISOR_PRODUCCION: '/cost',
    CONTADOR: '/reports',
    ADMINISTRADOR: '/',
    TRANSPORTISTA: '/delivery',
  };
  return moduleMap[role] || '/orders';
}

export function hasModuleAccess(role, module) {
  return permsFor(role).modules.includes(module);
}

export function hasReadAccess(role, module) {
  const p = permsFor(role);
  return p.modules.includes(module) || p.read_modules.includes(module);
}

export function can(role, action) {
  return permsFor(role).can.includes(action);
}

export function hasPermission(role, permission) {
  return can(role, permission);
}

export { ROLE_PERMISSIONS, ROLE_LABELS };
