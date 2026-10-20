import { api } from '@/services/api';
import type {
  DeliveryIncident,
  DeliveryOrder,
  DeliveryRoute,
  IncidentSummary,
  IncidentType,
  PaymentMethod,
  RouteSummary,
} from '@/types/models';
import { pickCollection, pickObject } from '@/utils/payload';

function unwrap<T>(data: unknown, key: string): T {
  const found = pickObject(data, key);
  if (!found) throw new Error('La respuesta del servidor no incluye los datos esperados.');
  return found as unknown as T;
}

export const deliveryService = {
  async getRoutes(): Promise<{ routes: DeliveryRoute[]; summary: RouteSummary }> {
    const { data } = await api.get('/delivery/routes');
    return {
      routes: pickCollection(data, 'routes') as DeliveryRoute[],
      summary: (pickObject(data, 'summary') ?? {}) as unknown as RouteSummary,
    };
  },

  async getRoute(routeId: number | string): Promise<DeliveryRoute> {
    const { data } = await api.get(`/delivery/routes/${routeId}`);
    return unwrap<DeliveryRoute>(data, 'route');
  },

  async getOrders(params?: { route_id?: number | string; status?: string }): Promise<{
    orders: DeliveryOrder[];
    summary: Record<string, number>;
  }> {
    const { data } = await api.get('/orders', { params });
    return {
      orders: pickCollection(data, 'orders') as DeliveryOrder[],
      summary: (pickObject(data, 'summary') ?? {}) as unknown as Record<string, number>,
    };
  },

  async getOrder(orderId: number | string): Promise<DeliveryOrder> {
    const { data } = await api.get(`/orders/${orderId}`);
    return unwrap<DeliveryOrder>(data, 'order');
  },

  async verifyOtp(otpCode: string): Promise<DeliveryOrder> {
    const { data } = await api.post('/delivery/verify-otp', { otp_code: otpCode });
    return unwrap<DeliveryOrder>(data, 'order');
  },

  async updatePayment(input: {
    orderId: number | string;
    paymentMethod: PaymentMethod;
    receivedAmount: number;
  }): Promise<{ order: DeliveryOrder; changeDue: number }> {
    const { data } = await api.patch('/delivery/update-payment', {
      order_id: input.orderId,
      payment_method: input.paymentMethod,
      received_amount: input.receivedAmount,
    });
    const order = unwrap<DeliveryOrder>(data, 'order');
    const changeDue =
      typeof data.change_due === 'number' ? data.change_due : Number(data.change_due ?? 0);
    return { order, changeDue };
  },

  async completePayment(orderId: number | string, otpCode: string): Promise<DeliveryOrder> {
    const { data } = await api.post('/delivery/complete-payment', {
      order_id: orderId,
      otp_code: otpCode,
    });
    return unwrap<DeliveryOrder>(data, 'order');
  },

  async setOrderStatus(orderId: number | string, status: string): Promise<DeliveryOrder> {
    const { data } = await api.patch(`/orders/${orderId}`, { status });
    return unwrap<DeliveryOrder>(data, 'order');
  },

  async getIncidents(): Promise<{ incidents: DeliveryIncident[]; summary: IncidentSummary }> {
    const { data } = await api.get('/delivery/incidents');
    return {
      incidents: pickCollection(data, 'incidents') as DeliveryIncident[],
      summary: (pickObject(data, 'summary') ?? {}) as unknown as IncidentSummary,
    };
  },

  async reportIncident(input: {
    orderId: number | string;
    type: IncidentType;
    description?: string;
    routeId?: number | null;
  }): Promise<DeliveryIncident> {
    const { data } = await api.post('/delivery/incidents', {
      order_id: input.orderId,
      type: input.type,
      description: input.description,
      route_id: input.routeId ?? undefined,
    });
    return unwrap<DeliveryIncident>(data, 'incident');
  },

  async sendLocation(input: {
    latitude: number;
    longitude: number;
    speedKmh?: number;
  }): Promise<void> {
    await api.post('/delivery/location', {
      latitude: input.latitude,
      longitude: input.longitude,
      speed_kmh: input.speedKmh,
    });
  },
};
