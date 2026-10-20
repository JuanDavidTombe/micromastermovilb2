import { api } from '@/services/api';
import type {
  DashboardPayload,
  DeliveryIncident,
  DeliveryOrder,
  DeliveryRoute,
  IncidentSummary,
  Kpis,
  RouteSummary,
} from '@/types/models';
import { pickCollection, pickObject } from '@/utils/payload';

export const dashboardService = {
  getSummary: () => api.get<DashboardPayload>('/dashboard'),

  getDeliveryOrders: () => api.get<{ orders: DeliveryOrder[] }>('/delivery/orders'),

  getRoutes: () => api.get<{ routes: DeliveryRoute[]; summary: RouteSummary }>('/delivery/routes'),

  getIncidents: () =>
    api.get<{ incidents: DeliveryIncident[]; summary: IncidentSummary }>('/delivery/incidents'),

  async fetchDashboard(): Promise<DashboardPayload> {
    const { data } = await api.get<DashboardPayload>('/dashboard');
    return data ?? {};
  },

  async fetchKpis(): Promise<Kpis> {
    const { data } = await api.get('/dashboard');
    return (pickObject(data, 'kpis') ?? {}) as unknown as Kpis;
  },

  async fetchRoutesSummary(): Promise<RouteSummary> {
    const { data } = await api.get('/delivery/routes');
    return (pickObject(data, 'summary') ?? {}) as unknown as RouteSummary;
  },
};

export function pickDashboardKpis(data: unknown): Kpis {
  return (pickObject(data, 'kpis') ?? {}) as unknown as Kpis;
}

export function pickOrderCollection(data: unknown): DeliveryOrder[] {
  return pickCollection(data, 'orders') as DeliveryOrder[];
}

export type { Kpis, DeliveryOrder as Order };
