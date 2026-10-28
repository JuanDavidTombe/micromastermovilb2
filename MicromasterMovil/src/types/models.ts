export interface RolePermissions {
  modules?: string[];
  read_modules?: string[];
  can?: string[];
}

export interface User {
  id: number | string;
  name: string;
  email: string;
  role?: string;
  role_label?: string;
  role_permissions?: RolePermissions;
  identity_document?: string;
  employee_code?: string;
  phone?: string;
  photo_url?: string | null;
  status?: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
}

export type RegistrableRole =
  | 'OPERARIO_LOGISTICO'
  | 'SUPERVISOR_PRODUCCION'
  | 'CONTADOR'
  | 'TRANSPORTISTA';

export interface RegisterPayload {
  name: string;
  identity_document: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: RegistrableRole;
}

export interface Kpis {
  pending_orders?: number;
  completed_orders?: number;
  critical_batches?: number;
  warning_batches?: number;
  optimal_batches?: number;
  total_batches?: number;
  total_ingredients?: number;
  total_recipes?: number;
  total_inventory_kg?: number;
  total_inventory_value?: number;
  total_waste_kg?: number;
  total_revenue?: number;
  total_collected?: number;
}

export interface Order {
  id: number | string;
  destination?: string;
  client_name?: string;
  status?: string;
  status_label?: string;
  payment_status?: string;
  payment_status_label?: string;
  amount?: number | string;
  created_at?: string;
}

export interface DashboardFefoEntry {
  type: string;
  count: number;
  color: string;
}

export interface DashboardPayload {
  user?: {
    role?: string;
    role_label?: string;
    modules?: string[];
  };
  kpis?: Kpis;
  alerts?: {
    expiring_this_week?: StockBatch[];
  };
  fefo_matrix?: DashboardFefoEntry[];
}

export interface RouteStop {
  order_id: number;
  client_name?: string | null;
  destination?: string | null;
  latitude: number;
  longitude: number;
  status?: string;
  payment_status?: string;
  amount: number | string;
}

export interface DeliveryRoute {
  id: number;
  route_code: string;
  destination?: string | null;
  origin_label?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  status: 'pending' | 'in_progress' | 'completed' | string;
  status_label?: string;
  scheduled_date?: string | null;
  distance_km?: number | null;
  duration_min?: number | null;
  progress?: number;
  stops_count?: number;
  delivered_count?: number;
  stops?: RouteStop[];
  open_incidents?: number;
  driver?: {
    id: number;
    name?: string;
    phone?: string | null;
    vehicle?: string | null;
  } | null;
}

export interface RouteSummary {
  total?: number;
  active?: number;
  pending?: number;
  completed?: number;
  open_incidents?: number;
}

export interface OrderRouteRef {
  id: number;
  route_code?: string;
  destination?: string | null;
}

export interface DeliveryOrderItem {
  id: number | string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  rejected_quantity?: number;
  rejection_reason?: string;
  confirmed?: boolean;
}

export interface DeliveryOrder {
  id: number;
  route_id?: number | null;
  driver_id?: number | null;
  client_name?: string | null;
  destination?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  status_label?: string;
  payment_method?: 'cash' | 'qr' | null;
  payment_status?: string;
  payment_status_label?: string;
  amount?: number | string;
  original_amount?: number | string;
  adjusted_amount?: number | string;
  received_amount?: number | string | null;
  change_due?: number | string | null;
  route?: OrderRouteRef | null;
  items?: DeliveryOrderItem[];
  pod_photo_uri?: string | null;
  transfer_receipt_uri?: string | null;
  signature_captured?: boolean | null;
}

export type PaymentMethod = 'cash' | 'qr';

export type IncidentType =
  | 'CLIENT_NOT_FOUND'
  | 'VEHICLE_BREAKDOWN'
  | 'WRONG_ADDRESS'
  | 'OTHER';

export interface DeliveryIncident {
  id: number;
  order_id?: number;
  route_id?: number | null;
  driver_id?: number | null;
  type?: IncidentType | string;
  type_label?: string;
  description?: string | null;
  status?: 'OPEN' | 'RESOLVED' | string;
  status_label?: string;
  severity?: string;
  reported_at?: string | null;
}

export interface IncidentSummary {
  total?: number;
  open?: number;
  resolved?: number;
}

export type BatchStatus = 'optimal' | 'warning' | 'critical';

export interface StockIngredient {
  id: number;
  name: string;
  unit?: string | null;
  cost_per_unit?: number | string;
}

export interface StockBatch {
  id: number;
  ingredient_id: number;
  batch_code: string;
  supplier_name?: string | null;
  qr_code_hash?: string | null;
  quantity: number | string;
  initial_quantity?: number | string;
  expiration_date: string;
  status?: BatchStatus | string;
  status_color?: string;
  days_to_expire?: number;
  remaining_percentage?: number;
  received_at?: string | null;
  ingredient?: StockIngredient | null;
}

export interface StockSummary {
  total?: number;
  optimal?: number;
  warning?: number;
  critical?: number;
  total_quantity?: number;
  suppliers?: number;
}

export interface StockPageMeta {
  total?: number;
  current_page?: number;
  pages?: number;
}

export interface StockAlerts {
  critical_count?: number;
  warning_count?: number;
  critical_batches?: StockBatch[];
  warning_batches?: StockBatch[];
}

export interface StockEntryPayload {
  ingredient_id: number;
  batch_code: string;
  supplier_name?: string;
  quantity: number;
  expiration_date: string;
}
