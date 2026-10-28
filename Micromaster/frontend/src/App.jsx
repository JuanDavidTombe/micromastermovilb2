import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import MicroCost from './pages/MicroCost';
import MicroStock from './pages/MicroStock';
import MicroDelivery from './pages/MicroDelivery';
import MicroDeliveryOptimized from './pages/MicroDeliveryOptimized';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import { getDefaultRoute, hasModuleAccess, hasReadAccess } from './constants/roles';
import ErrorBoundary from './components/ErrorBoundary';

const ROUTE_MODULES = {
  '/': 'dashboard',
  '/stock': 'inventory_stock',
  '/stock/lotes': 'inventory_stock',
  '/stock/entradas': 'inventory_stock',
  '/stock/qr': 'inventory_stock',
  '/stock/alertas': 'inventory_stock',
  '/cost': 'recipes_production',
  '/cost/recetas': 'recipes_production',
  '/cost/tandas': 'recipes_production',
  '/cost/cierre': 'recipes_production',
  '/cost/mermas': 'recipes_production',
  '/cost/simulador': 'recipes_production',
  '/cost/insumos': 'recipes_production',
  '/orders': 'orders_delivery',
  '/delivery': 'orders_delivery',
  '/delivery/cobro': 'orders_delivery',
  '/delivery/incidencias': 'orders_delivery',
  '/reports': 'reports_simulations',
  '/reports/ventas': 'reports_simulations',
  '/reports/pedidos': 'reports_simulations',
  '/reports/inventario': 'reports_simulations',
  '/reports/exportar': 'reports_simulations',
  '/settings': 'administration',
  '/settings/config': 'administration',
};

function AuthenticatedApp({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moduleKey, setModuleKey] = useState(0);
  const mainRef = useRef(null);

  const role = user?.role || 'ADMINISTRADOR';

  const userRef = useRef(user);
  userRef.current = user;

  const handleProfileUpdated = useCallback((patch) => {
    if (!patch) return;
    const next = { ...(userRef.current || {}), ...patch };
    localStorage.setItem('micromaster_user', JSON.stringify(next));
    setUser(next);
  }, [setUser]);

  useEffect(() => {
    if (!user || location.pathname === '/login') return;

    const module = ROUTE_MODULES[location.pathname];
    const allowed =
      location.pathname === '/stock' || location.pathname.startsWith('/stock/')
        ? hasReadAccess(role, 'inventory_stock')
        : hasModuleAccess(role, module);

    if (!module || !allowed) {
      navigate(getDefaultRoute(role), { replace: true });
    }
  }, [role, location.pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('micromaster_token');
    localStorage.removeItem('micromaster_user');
    setUser(null);
    navigate('/login', { replace: true });
  }, [setUser, navigate]);

  return (
    <div className="flex h-dvh bg-cream overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        user={user}
        sidebarOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        <Topbar user={user} onMenuToggle={() => setSidebarOpen((v) => !v)} onProfileUpdated={handleProfileUpdated} />
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 md:p-6 bg-cream dark:bg-slate-900 transition-colors">
          <ErrorBoundary key={`${location.pathname}-${moduleKey}`} onReload={() => setModuleKey((k) => k + 1)}>
          <Routes>
            {hasModuleAccess(role, 'dashboard') && (
              <Route path="/" element={<Dashboard user={user} />} />
            )}

            {hasReadAccess(role, 'inventory_stock') && (
              <>
                <Route path="/stock" element={<MicroStock user={user} />} />
                <Route path="/stock/lotes" element={<Navigate to="/stock" replace />} />
                <Route path="/stock/entradas" element={<MicroStock user={user} />} />
                <Route path="/stock/qr" element={<MicroStock user={user} />} />
                <Route path="/stock/alertas" element={<MicroStock user={user} />} />
              </>
            )}

            {hasModuleAccess(role, 'recipes_production') && (
              <>
                <Route path="/cost" element={<MicroCost user={user} />} />
                <Route path="/cost/recetas" element={<MicroCost user={user} />} />
                <Route path="/cost/tandas" element={<MicroCost user={user} />} />
                <Route path="/cost/cierre" element={<MicroCost user={user} />} />
                <Route path="/cost/mermas" element={<MicroCost user={user} />} />
                <Route path="/cost/simulador" element={<MicroCost user={user} />} />
                <Route path="/cost/insumos" element={<MicroCost user={user} />} />
              </>
            )}

            {hasModuleAccess(role, 'orders_delivery') && (
              <>
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/delivery" element={<MicroDeliveryOptimized user={user} />} />
                <Route path="/delivery/cobro" element={<MicroDelivery user={user} />} />
                <Route path="/delivery/incidencias" element={<MicroDelivery user={user} />} />
              </>
            )}

            {hasModuleAccess(role, 'reports_simulations') && (
              <>
                <Route path="/reports" element={<Reports user={user} />} />
                <Route path="/reports/ventas" element={<Reports user={user} />} />
                <Route path="/reports/pedidos" element={<Reports user={user} />} />
                <Route path="/reports/inventario" element={<Reports user={user} />} />
                <Route path="/reports/exportar" element={<Reports user={user} />} />
              </>
            )}

            {hasModuleAccess(role, 'administration') && (
              <>
                <Route path="/settings" element={<Settings user={user} />} />
                <Route path="/settings/config" element={<Settings user={user} />} />
              </>
            )}

            <Route path="*" element={<Navigate to={getDefaultRoute(role)} replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', user?.theme === 'dark');
  }, [user?.theme]);

  useEffect(() => {
    const token = localStorage.getItem('micromaster_token');
    const userData = localStorage.getItem('micromaster_user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('micromaster_token', token);
    localStorage.setItem('micromaster_user', JSON.stringify(userData));
    setUser(userData);
  };

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <AuthenticatedApp user={user} setUser={setUser} />
    </Router>
  );
}

export default App;