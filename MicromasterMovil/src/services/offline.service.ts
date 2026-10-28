import AsyncStorage from '@react-native-async-storage/async-storage';

import { deliveryService } from '@/services/delivery.service';
import type { DeliveryOrder, IncidentType, PaymentMethod } from '@/types/models';
import { toNumber } from '@/utils/format';

export type OutboxActionType =
  | 'COMPLETE_DELIVERY'
  | 'REPORT_INCIDENT'
  | 'REJECT_DELIVERY'
  | 'REGISTER_PAYMENT'
  | 'SEND_SOS';

export interface OutboxAction {
  id: string;
  type: OutboxActionType;
  orderId?: number | string;
  payload: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  errorMessage?: string;
  retryCount?: number;
}

export interface CashEntry {
  id: string;
  orderId: number | string;
  clientName: string;
  amount: number;
  timestamp: number;
}

export interface SosAlert {
  id: string;
  type: 'Falla Mecánica' | 'Accidente' | 'Vía Bloqueada' | string;
  latitude: number | null;
  longitude: number | null;
  timestamp: number;
  synced: boolean;
}

const STORAGE_KEYS = {
  orders: '@micromaster/offline/orders',
  cashTally: '@micromaster/offline/cash_tally',
  cashHistory: '@micromaster/offline/cash_history',
  outbox: '@micromaster/offline/outbox',
  sos: '@micromaster/offline/sos',
};

// Seed de pedidos iniciales para el conductor si la API local no tiene pedidos cargados aún
const SEED_ORDERS: DeliveryOrder[] = [
  {
    id: 101,
    client_name: 'Distribuidora El Éxito',
    destination: 'Av. Las Palmas #45-12, Sector Industrial',
    latitude: 6.2088,
    longitude: -75.5658,
    status: 'assigned',
    status_label: 'Asignado',
    payment_method: 'cash',
    payment_status: 'pending',
    payment_status_label: 'Por cobrar',
    amount: 350000,
    original_amount: 350000,
    route: { id: 1, route_code: 'RUTA-SUR-01' },
    items: [
      {
        id: '101-1',
        name: 'Aceite Vegetal Palma Real (Caja x 12 und)',
        quantity: 3,
        unit: 'Cajas',
        unit_price: 60000,
        total_price: 180000,
      },
      {
        id: '101-2',
        name: 'Arroz Graneado Especial (Bulto x 50 kg)',
        quantity: 2,
        unit: 'Bultos',
        unit_price: 85000,
        total_price: 170000,
      },
    ],
  },
  {
    id: 102,
    client_name: 'Supermercado Central La 14',
    destination: 'Cra. 52 #28-40, Barrio San Benito',
    latitude: 6.2518,
    longitude: -75.5636,
    status: 'assigned',
    status_label: 'Asignado',
    payment_method: 'cash',
    payment_status: 'pending',
    payment_status_label: 'Por cobrar',
    amount: 620000,
    original_amount: 620000,
    route: { id: 1, route_code: 'RUTA-SUR-01' },
    items: [
      {
        id: '102-1',
        name: 'Pechuga de Pollo Deshuesada a Granel',
        quantity: 20,
        unit: 'Kg',
        unit_price: 16000,
        total_price: 320000,
      },
      {
        id: '102-2',
        name: 'Carne de Res - Bola Negra Seleccionada',
        quantity: 10,
        unit: 'Kg',
        unit_price: 30000,
        total_price: 300000,
      },
    ],
  },
  {
    id: 103,
    client_name: 'Panadería San José',
    destination: 'Calle 10 #43E-10, El Poblado',
    latitude: 6.2104,
    longitude: -75.5714,
    status: 'delivered',
    status_label: 'Entregado',
    payment_method: 'cash',
    payment_status: 'completed',
    payment_status_label: 'Cobrado',
    amount: 180000,
    original_amount: 180000,
    route: { id: 1, route_code: 'RUTA-SUR-01' },
    items: [
      {
        id: '103-1',
        name: 'Harina de Trigo Fortificada Especial',
        quantity: 2,
        unit: 'Bultos',
        unit_price: 90000,
        total_price: 180000,
      },
    ],
  },
  {
    id: 104,
    client_name: 'Tiendas Don Lucho',
    destination: 'Calle 44 #70-30, San Juan',
    latitude: 6.2486,
    longitude: -75.5921,
    status: 'assigned',
    status_label: 'Asignado',
    payment_method: 'qr',
    payment_status: 'pending',
    payment_status_label: 'Transferencia pendiente',
    amount: 245000,
    original_amount: 245000,
    route: { id: 1, route_code: 'RUTA-SUR-01' },
    items: [
      {
        id: '104-1',
        name: 'Paca Gaseosa Tropical Pet (12 x 1.5L)',
        quantity: 5,
        unit: 'Pacas',
        unit_price: 25000,
        total_price: 125000,
      },
      {
        id: '104-2',
        name: 'Caja Maní Especial Salado (24 und)',
        quantity: 3,
        unit: 'Cajas',
        unit_price: 40000,
        total_price: 120000,
      },
    ],
  },
  {
    id: 105,
    client_name: 'Minimarket Los Pinos',
    destination: 'Diagonal 75B #2A-120, Belén',
    latitude: 6.2241,
    longitude: -75.6015,
    status: 'assigned',
    status_label: 'Asignado',
    payment_method: 'cash',
    payment_status: 'pending',
    payment_status_label: 'Por cobrar',
    amount: 410000,
    original_amount: 410000,
    route: { id: 1, route_code: 'RUTA-SUR-01' },
    items: [
      {
        id: '105-1',
        name: 'Salchichón Cervecero Tradicional',
        quantity: 10,
        unit: 'Cajas',
        unit_price: 25000,
        total_price: 250000,
      },
      {
        id: '105-2',
        name: 'Queso Costeño Pasteurizado Bloque',
        quantity: 8,
        unit: 'Kg',
        unit_price: 20000,
        total_price: 160000,
      },
    ],
  },
];

type SyncListener = () => void;
const listeners = new Set<SyncListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

function ensureOrderItems(order: DeliveryOrder): DeliveryOrder {
  if (order.items && order.items.length > 0) return order;
  const seed = SEED_ORDERS.find((s) => String(s.id) === String(order.id));
  if (seed?.items && seed.items.length > 0) {
    return {
      ...order,
      items: seed.items,
      original_amount: order.original_amount ?? order.amount,
    };
  }
  const amt = toNumber(order.amount) || 100000;
  return {
    ...order,
    items: [
      {
        id: `${order.id}-1`,
        name: 'Mercancía General Alimentos MicroMaster',
        quantity: Math.max(1, Math.round(amt / 50000)),
        unit: 'Cajas',
        unit_price: 50000,
        total_price: amt,
      },
    ],
    original_amount: order.original_amount ?? order.amount,
  };
}

export const offlineService = {
  subscribe(listener: SyncListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // --- PEDIDOS (OFFLINE STORE) ---
  async getOrders(): Promise<DeliveryOrder[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.orders);
      if (raw) {
        const parsed = JSON.parse(raw) as DeliveryOrder[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(ensureOrderItems);
        }
      }
      // Inicializar con seed si está vacío
      await AsyncStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(SEED_ORDERS));
      return SEED_ORDERS;
    } catch {
      return SEED_ORDERS;
    }
  },

  async saveOrders(orders: DeliveryOrder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  async getOrderById(id: number | string): Promise<DeliveryOrder | null> {
    const orders = await this.getOrders();
    const found = orders.find((o) => String(o.id) === String(id));
    return found ? ensureOrderItems(found) : null;
  },

  async updateLocalOrder(id: number | string, patch: Partial<DeliveryOrder>): Promise<DeliveryOrder | null> {
    const orders = await this.getOrders();
    let updatedOrder: DeliveryOrder | null = null;
    const nextOrders = orders.map((o) => {
      if (String(o.id) === String(id)) {
        updatedOrder = { ...o, ...patch };
        return updatedOrder;
      }
      return o;
    });
    if (updatedOrder) {
      await this.saveOrders(nextOrders);
    }
    return updatedOrder;
  },

  // --- ARQUEO DE BOLSILLO (EFECTIVO RECAUDADO HOY) ---
  async getCashTally(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.cashTally);
      if (raw != null) return Number(raw) || 0;

      // Calcular a partir de los pedidos entregados en efectivo
      const orders = await this.getOrders();
      const initialCash = orders.reduce((sum, order) => {
        if (order.status === 'delivered' && (order.payment_method === 'cash' || !order.payment_method)) {
          return sum + toNumber(order.amount);
        }
        return sum;
      }, 0);

      await AsyncStorage.setItem(STORAGE_KEYS.cashTally, String(initialCash));
      return initialCash;
    } catch {
      return 0;
    }
  },

  async addCash(amount: number, orderId: number | string, clientName: string): Promise<number> {
    try {
      const current = await this.getCashTally();
      const next = current + Math.max(0, amount);
      await AsyncStorage.setItem(STORAGE_KEYS.cashTally, String(next));

      // Historial
      const historyRaw = await AsyncStorage.getItem(STORAGE_KEYS.cashHistory);
      const history: CashEntry[] = historyRaw ? JSON.parse(historyRaw) : [];
      history.unshift({
        id: `cash-${Date.now()}`,
        orderId,
        clientName,
        amount,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(STORAGE_KEYS.cashHistory, JSON.stringify(history.slice(0, 50)));

      notifyListeners();
      return next;
    } catch {
      return 0;
    }
  },

  // --- COLA DE SINCRONIZACIÓN (OUTBOX SILENCIOSA) ---
  async getOutbox(): Promise<OutboxAction[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.outbox);
      if (!raw) return [];
      return JSON.parse(raw) as OutboxAction[];
    } catch {
      return [];
    }
  },

  async getPendingCount(): Promise<number> {
    const outbox = await this.getOutbox();
    return outbox.filter((a) => a.status === 'pending' || a.status === 'failed').length;
  },

  async enqueueAction(type: OutboxActionType, payload: Record<string, unknown>, orderId?: number | string): Promise<OutboxAction> {
    const action: OutboxAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      orderId,
      payload,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    const outbox = await this.getOutbox();
    outbox.push(action);
    await AsyncStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify(outbox));
    notifyListeners();

    // Intentar sincronizar silenciosamente en segundo plano
    void this.syncOutbox();

    return action;
  },

  // --- ALERTA S.O.S. (PÁNICO LOGÍSTICO) ---
  async sendSos(emergencyType: 'Falla Mecánica' | 'Accidente' | 'Vía Bloqueada', coords: { latitude: number; longitude: number } | null): Promise<void> {
    const alert: SosAlert = {
      id: `sos-${Date.now()}`,
      type: emergencyType,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      timestamp: Date.now(),
      synced: false,
    };

    // Guardar localmente
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.sos);
      const list: SosAlert[] = raw ? JSON.parse(raw) : [];
      list.unshift(alert);
      await AsyncStorage.setItem(STORAGE_KEYS.sos, JSON.stringify(list));
    } catch {
      // ignore
    }

    // Encolar para sync silencioso
    await this.enqueueAction('SEND_SOS', {
      emergencyType,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      reported_at: new Date().toISOString(),
    });
  },

  // --- EJECUCIÓN DEL MOTOR DE SINCRONIZACIÓN ---
  async syncOutbox(): Promise<{ synced: number; failed: number }> {
    const outbox = await this.getOutbox();
    const pending = outbox.filter((a) => a.status === 'pending' || a.status === 'failed');

    if (pending.length === 0) return { synced: 0, failed: 0 };

    let syncedCount = 0;
    let failedCount = 0;

    for (const item of pending) {
      item.status = 'syncing';
      try {
        switch (item.type) {
          case 'COMPLETE_DELIVERY': {
            const orderId = (item.orderId ?? item.payload.orderId) as string | number | undefined;
            if (orderId) {
              await deliveryService.setOrderStatus(orderId, 'delivered');
              if (item.payload.otpCode) {
                await deliveryService.completePayment(orderId, String(item.payload.otpCode)).catch(() => undefined);
              }
            }
            break;
          }

          case 'REGISTER_PAYMENT': {
            const orderId = (item.orderId ?? item.payload.orderId) as string | number | undefined;
            if (orderId) {
              await deliveryService.updatePayment({
                orderId,
                paymentMethod: (item.payload.paymentMethod as PaymentMethod) ?? 'cash',
                receivedAmount: Number(item.payload.receivedAmount ?? 0),
              });
            }
            break;
          }

          case 'REPORT_INCIDENT': {
            const orderId = (item.orderId ?? item.payload.orderId) as string | number | undefined;
            if (orderId) {
              await deliveryService.reportIncident({
                orderId,
                type: (item.payload.type as IncidentType) ?? 'OTHER',
                description: String(item.payload.description ?? ''),
                routeId: typeof item.payload.routeId === 'number' ? item.payload.routeId : null,
              });
            }
            break;
          }

          case 'REJECT_DELIVERY': {
            const orderId = (item.orderId ?? item.payload.orderId) as string | number | undefined;
            if (orderId) {
              await deliveryService.setOrderStatus(orderId, 'cancelled');
              await deliveryService.reportIncident({
                orderId,
                type: 'CLIENT_NOT_FOUND',
                description: `Entrega rechazada: ${String(item.payload.reason ?? 'Rechazo por cliente')}`,
              }).catch(() => undefined);
            }
            break;
          }

          case 'SEND_SOS': {
            if (typeof item.payload.latitude === 'number' && typeof item.payload.longitude === 'number') {
              await deliveryService.sendLocation({
                latitude: item.payload.latitude,
                longitude: item.payload.longitude,
              }).catch(() => undefined);
            }
            // Registrar incidente de SOS general
            await deliveryService.reportIncident({
              orderId: 0,
              type: 'VEHICLE_BREAKDOWN',
              description: `[ALERTA S.O.S. CONDUCTOR] ${String(item.payload.emergencyType)} - Coords: ${item.payload.latitude}, ${item.payload.longitude}`,
            }).catch(() => undefined);
            break;
          }
        }

        item.status = 'synced';
        syncedCount++;
      } catch (err: unknown) {
        item.status = 'failed';
        item.retryCount = (item.retryCount ?? 0) + 1;
        item.errorMessage = err instanceof Error ? err.message : 'Error de conexión';
        failedCount++;
      }
    }

    // Conservar las que aún no están 'synced' o mantener registro limpio
    const remaining = outbox.filter((a) => a.status !== 'synced');
    await AsyncStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify(remaining));
    notifyListeners();

    return { synced: syncedCount, failed: failedCount };
  },
};
