export const SIDEBAR_MENU = {
  OPERARIO_LOGISTICO: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Resumen Bodega', desc: 'Alertas de stock y entregas del día', to: '/stock' },
      ],
    },
    {
      id: 'operacion',
      num: '02',
      label: 'OPERACIÓN & LOGÍSTICA',
      items: [
        { icon: 'box-seam', label: 'Lotes FEFO', desc: 'Vencimiento, proveedor y cantidad', to: '/stock/lotes' },
        { icon: 'box-arrow-in-down', label: 'Entradas de Proveedores', desc: 'Recepción de mercancía', to: '/stock/entradas' },
        { icon: 'truck', label: 'Gestión de Pedidos', desc: 'Órdenes B2B y estados', to: '/orders' },
        { icon: 'geo-alt', label: 'Rutas & Mapa GPS', desc: 'Trazado en vivo de conductores', to: '/delivery' },
        { icon: 'cash-coin', label: 'Cobros, Caja & OTP', desc: 'Verificación y registro de pago', to: '/delivery/cobro' },
      ],
    },
    {
      id: 'campo',
      num: '03',
      label: 'CONTROL DE CAMPO',
      items: [
        { icon: 'exclamation-octagon', label: 'Novedades e Incidencias', desc: 'Alertas de conductores en ruta', to: '/delivery/incidencias' },
        { icon: 'file-earmark-text', label: 'Reportes de Bodega', desc: 'Estado y alertas de inventario', to: '/stock/alertas' },
      ],
    },
  ],

  SUPERVISOR_PRODUCCION: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Tablero de Cocina', desc: 'Tandas programadas para hoy', to: '/cost' },
      ],
    },
    {
      id: 'produccion',
      num: '02',
      label: 'PRODUCCIÓN & RECETAS',
      items: [
        { icon: 'egg-fried', label: 'Catálogo de Recetas', desc: 'Fórmulas y mermas', to: '/cost/recetas' },
        { icon: 'calculator', label: 'Simulador de Escala', desc: 'Kg para producción masiva', to: '/cost/simulador' },
        { icon: 'check2-circle', label: 'Disponibilidad de Insumos', desc: 'Check automático de stock', to: '/cost/insumos' },
      ],
    },
    {
      id: 'calidad',
      num: '03',
      label: 'CONTROL DE CALIDAD',
      items: [
        { icon: 'trash3', label: 'Registro de Mermas', desc: 'Mermas e imprevistos de cocina', to: '/cost/recetas' },
      ],
    },
  ],

  CONTADOR: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Resumen Financiero', desc: 'Ingresos, costos y margen', to: '/reports' },
      ],
    },
    {
      id: 'auditoria',
      num: '02',
      label: 'AUDITORÍA & CONCILIACIÓN',
      items: [
        { icon: 'graph-up-arrow', label: 'Reportes de Ventas B2B', desc: 'Ingresos y cobros confirmados', to: '/reports/ventas' },
        { icon: 'cash-stack', label: 'Conciliación de Caja & OTP', desc: 'Verificación de dinero recaudado', to: '/reports/pedidos' },
        { icon: 'boxes', label: 'Valoración de Inventario', desc: 'Costo total del stock en bodega', to: '/reports/inventario' },
      ],
    },
    {
      id: 'exportacion',
      num: '03',
      label: 'EXPORTACIÓN',
      items: [
        { icon: 'download', label: 'Descarga de Informes', desc: 'Exportador masivo en CSV', to: '/reports/exportar' },
      ],
    },
  ],

  ADMINISTRADOR: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Torre de Control', desc: 'KPIs y estado general', to: '/' },
      ],
    },
    {
      id: 'inventario',
      num: '02',
      label: 'INVENTARIO & STOCK',
      items: [
        { icon: 'box-seam', label: 'Inventario & Stock', desc: 'Resumen de alertas de bodega', to: '/stock' },
        { icon: 'calendar2-check', label: 'Lotes FEFO', desc: 'Vencimiento, proveedor y QR', to: '/stock/lotes' },
        { icon: 'box-arrow-in-down', label: 'Entradas de Proveedores', desc: 'Recepción de mercancía', to: '/stock/entradas' },
      ],
    },
    {
      id: 'produccion',
      num: '03',
      label: 'PRODUCCIÓN',
      items: [
        { icon: 'gear', label: 'Recetas & Producción', desc: 'Tablero de cocina y stock', to: '/cost' },
        { icon: 'egg-fried', label: 'Catálogo de Recetas', desc: 'Fórmulas y mermas', to: '/cost/recetas' },
        { icon: 'calculator', label: 'Simulador de Escala', desc: 'Kg para producción masiva', to: '/cost/simulador' },
      ],
    },
    {
      id: 'logistica',
      num: '04',
      label: 'PEDIDOS & LOGÍSTICA',
      items: [
        { icon: 'list-task', label: 'Pedidos & Entregas', desc: 'Órdenes B2B y estados', to: '/orders' },
        { icon: 'geo-alt', label: 'Rutas & Mapa GPS', desc: 'Rutas y novedades de campo', to: '/delivery' },
        { icon: 'cash-coin', label: 'Cobros, Caja & OTP', desc: 'Verificación y registro de pago', to: '/delivery/cobro' },
        { icon: 'exclamation-octagon', label: 'Novedades e Incidencias', desc: 'Alertas de conductores en ruta', to: '/delivery/incidencias' },
      ],
    },
    {
      id: 'analisis',
      num: '05',
      label: 'ANÁLISIS & SISTEMA',
      items: [
        { icon: 'bar-chart-line', label: 'Reportes & Simulaciones', desc: 'Resumen financiero', to: '/reports' },
        { icon: 'graph-up-arrow', label: 'Ventas & Conciliación', desc: 'Ingresos y cobros confirmados', to: '/reports/ventas' },
        { icon: 'download', label: 'Descarga de Informes', desc: 'Exportador masivo en CSV', to: '/reports/exportar' },
      ],
    },
    {
      id: 'administracion',
      num: '06',
      label: 'ADMINISTRACIÓN',
      items: [
        { icon: 'people', label: 'Gestión de Usuarios & Roles', desc: 'Equipo y matriz de permisos', to: '/settings' },
        { icon: 'sliders', label: 'Configuración del Sistema', desc: 'Parámetros generales', to: '/settings/config' },
      ],
    },
  ],

  TRANSPORTISTA: [
    {
      id: 'operacion',
      num: '01',
      label: 'MI OPERACIÓN',
      items: [
        { icon: 'truck', label: 'Mis Pedidos', desc: 'Órdenes asignadas a mi ruta', to: '/orders' },
        { icon: 'geo-alt', label: 'Mi Ruta & Mapa GPS', desc: 'Trazado y posición en vivo', to: '/delivery' },
        { icon: 'exclamation-octagon', label: 'Reportar Novedad', desc: 'Incidencias de campo', to: '/delivery/incidencias' },
        { icon: 'cash-coin', label: 'Cobro OTP', desc: 'Verificación de pago en ruta', to: '/delivery/cobro' },
      ],
    },
  ],
};