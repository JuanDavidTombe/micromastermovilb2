import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('micromaster_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('micromaster_token');
      localStorage.removeItem('micromaster_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const dashboard = {
  getKpis: () => api.get('/dashboard'),
};

export const cost = {
  getRecipes: () => api.get('/cost/recipes'),
  getStockCheck: (recipeId) => api.get(`/cost/recipes/${recipeId}/stock-check`),
  createRecipe: (data) => api.post('/cost/recipes', data),
  updateRecipe: (id, data) => api.patch(`/cost/recipes/${id}`, data),
  deleteRecipe: (id) => api.delete(`/cost/recipes/${id}`),
  simulateScale: (data) => api.post('/cost/simulate-scale', data),
  getIngredients: () => api.get('/cost/ingredients'),
  // Fase 2 & 3: Órdenes de Producción / Tandas
  getProductionOrders: (params) => api.get('/cost/production-orders', { params }),
  createProductionOrder: (data) => api.post('/cost/production-orders', data),
  getProductionOrder: (id) => api.get(`/cost/production-orders/${id}`),
  closeProductionOrder: (id, data) => api.post(`/cost/production-orders/${id}/close`, data),
  // Fase 4: Ajuste de Mermas de Planta
  getFloorWastes: () => api.get('/cost/floor-waste'),
  storeFloorWaste: (data) => api.post('/cost/floor-waste', data),
};

export const stock = {
  getInventorySummary: () => api.get('/inventory/summary'),
  getBatches: (params) => api.get('/stock/batches', { params }),
  createBatch: (data) => api.post('/stock/batches', data),
  blockBatch: (id, data) => api.patch(`/stock/batches/${id}/block`, data),
  getPurchaseOrders: () => api.get('/stock/purchase-orders'),
  getPurchaseOrder: (code) => api.get(`/stock/purchase-orders/${code}`),
  receptionMatch: (data) => api.post('/stock/reception-match', data),
  getAlerts: () => api.get('/stock/alerts'),
  getIngredientStock: () => api.get('/stock/ingredients'),
  createEntry: (data) => api.post('/stock/entry', data),
  createExit: (data) => api.post('/stock/exit', data),
  getMovements: (params) => api.get('/stock/movements', { params }),
  qrScan: (data) => api.post('/stock/qr-scan', data),
};

export const reports = {
  get: () => api.get('/reports'),
  getFinancialKpis: () => api.get('/reports/financial-kpis'),
  getInventoryValuation: () => api.get('/reports/inventory-valuation'),
  closeInventorySnapshot: (data) => api.post('/reports/inventory-snapshots', data),
  getBankReconciliation: () => api.get('/reports/bank-reconciliation'),
  reconcileOrder: (id, data) => api.post(`/reports/reconcile-order/${id}`, data),
  exportFiltered: (params) => api.get('/reports/export-filtered', { params, responseType: 'blob' }),
  costs: () => api.get('/reports/costs'),
  stock: () => api.get('/reports/stock'),
  orders: () => api.get('/reports/orders'),
  download: (type) => api.get('/reports/download', { params: { type }, responseType: 'blob' }),
};

export const delivery = {
  getRoutes: (params) => api.get('/delivery/routes', { params }),
  getRouteDetail: (id) => api.get(`/delivery/routes/${id}`),
  createRoute: (data) => api.post('/delivery/routes', data),
  updateRoute: (id, data) => api.patch(`/delivery/routes/${id}`, data),

  getDrivers: () => api.get('/delivery/drivers'),

  getOrders: (params) => api.get('/delivery/orders', { params }),
  verifyOtp: (code) => api.post('/delivery/verify-otp', { otp_code: code }),
  updatePayment: (data) => api.patch('/delivery/update-payment', data),
  completePayment: (data) => api.post('/delivery/complete-payment', data),

  sendLocation: (data) => api.post('/delivery/location', data),

  getIncidents: (params) => api.get('/delivery/incidents', { params }),
  createIncident: (data) => api.post('/delivery/incidents', data),
  updateIncident: (id, data) => api.patch(`/delivery/incidents/${id}`, data),
};

export const orders = {
  list: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  bulkRelease: (data) => api.post('/orders/bulk-release', data),
  simulateIntake: () => api.post('/orders/simulate-intake'),
  get: (id) => api.get(`/orders/${id}`),
  update: (id, data) => api.patch(`/orders/${id}`, data),
  remove: (id) => api.delete(`/orders/${id}`),
};

export const profile = {
  get: () => api.get('/profile'),
  update: (data) => api.patch('/profile', data),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post('/profile/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getPhoto: () => api.get('/profile/photo', { responseType: 'blob' }),
  deletePhoto: () => api.delete('/profile/photo'),

  changePassword: (data) => api.patch('/profile/password', data),
  revokeSessions: () => api.delete('/profile/sessions'),

  updatePreferences: (data) => api.patch('/profile/preferences', data),
};

export const admin = {
  getUsers: () => api.get('/settings/users'),
  createUser: (data) => api.post('/settings/users', data),
  updateUser: (id, data) => api.patch(`/settings/users/${id}`, data),
  toggleUserStatus: (id) => api.patch(`/settings/users/${id}/status`),

  getPendingUsers: () => api.get('/admin/pending-users'),
  approveUser: (id, data) => api.post(`/admin/users/${id}/approve`, data || {}),
  rejectUser: (id, data) => api.post(`/admin/users/${id}/reject`, data || {}),

  getCompany: () => api.get('/settings/company'),
  updateCompany: (data) => api.patch('/settings/company', data),
};

export default api;