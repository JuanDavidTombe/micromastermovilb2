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
        { icon: 'file-earmark-text', label: 'Reportes de Bodega', desc: 'Movimientos, filtros y exportación', to: '/stock/alertas' },
      ],
    },
  ],

  SUPERVISOR_PRODUCCION: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Tablero de Cocina', desc: 'Tandas y órdenes del día', to: '/cost' },
      ],
    },
    {
      id: 'produccion',
      num: '02',
      label: 'PRODUCCIÓN & RECETAS',
      items: [
        { icon: 'egg-fried', label: 'Catálogo de Recetas (BOM)', desc: 'Fórmulas, mermas y costeo', to: '/cost/recetas' },
        { icon: 'printer', label: 'Nueva Tanda (Orden Papel)', desc: 'Emisión y hoja de alistamiento', to: '/cost/tandas' },
        { icon: 'check2-square', label: 'Cierre de Producción', desc: 'Consumo real y producto terminado', to: '/cost/cierre' },
        { icon: 'calculator', label: 'Simulador de Escala', desc: 'Kg para producción masiva', to: '/cost/simulador' },
        { icon: 'check2-circle', label: 'Disponibilidad de Insumos', desc: 'Check automático de stock', to: '/cost/insumos' },
      ],
    },
    {
      id: 'calidad',
      num: '03',
      label: 'CONTROL DE CALIDAD',
      items: [
        { icon: 'trash3', label: 'Registro de Mermas', desc: 'Bajas rápidas de desperdicio diario', to: '/cost/mermas' },
      ],
    },
  ],

  CONTADOR: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: 'speedometer2', label: 'Inicio · Resumen Financiero', desc: 'Cartera, inventario, COGS y mermas', to: '/reports' },
      ],
    },
    {
      id: 'auditoria',
      num: '02',
      label: 'CONTABILIDAD & AUDITORÍA',
      items: [
        { icon: 'boxes', label: 'Valoración de Inventario', desc: 'Cierre contable y congelación de stock', to: '/reports/inventario' },
        { icon: 'bank', label: 'Conciliación Bancaria y Caja', desc: 'Cruce con extractos bancarios', to: '/reports/pedidos' },
        { icon: 'graph-up-arrow', label: 'Reportes de Ventas B2B', desc: 'Ingresos y cobros confirmados', to: '/reports/ventas' },
      ],
    },
    {
      id: 'exportacion',
      num: '03',
      label: 'INFORMES & EXCEL',
      items: [
        { icon: 'file-earmark-excel', label: 'Descarga de Informes', desc: 'Kardex, ventas y mermas DIAN', to: '/reports/exportar' },
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
        { icon: 'box-arrow-in-down', label: 'Entradas de Proveedores', desc: 'Recepción de mercancía', to: '/stock/entradas' },
        { icon: 'file-earmark-text', label: 'Reportes de Bodega', desc: 'Movimientos, filtros y exportación', to: '/stock/alertas' },
      ],
    },
    {
      id: 'produccion',
      num: '03',
      label: 'PRODUCCIÓN',
      items: [
        { icon: 'gear', label: 'Recetas & Producción', desc: 'Tablero de cocina y stock', to: '/cost' },
        { icon: 'egg-fried', label: 'Catálogo de Recetas (BOM)', desc: 'Fórmulas, mermas y costeo', to: '/cost/recetas' },
        { icon: 'printer', label: 'Nueva Tanda (Orden Papel)', desc: 'Emisión y hoja de alistamiento', to: '/cost/tandas' },
        { icon: 'check2-square', label: 'Cierre de Producción', desc: 'Consumo real y producto terminado', to: '/cost/cierre' },
        { icon: 'trash3', label: 'Registro de Mermas', desc: 'Bajas rápidas de planta', to: '/cost/mermas' },
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