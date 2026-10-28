import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SosModal } from '@/components/SosModal';
import { StatusPill } from '@/components/StatusPill';
import { isAdmin, isWarehouseOperator } from '@/constants/roles';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { adminService, type AdminDashboardData } from '@/services/admin.service';
import { deliveryService } from '@/services/delivery.service';
import { offlineService } from '@/services/offline.service';
import { warehouseService, type WarehouseHubData } from '@/services/warehouse.service';
import type { DeliveryOrder, User } from '@/types/models';
import { formatMoney, statusTone } from '@/utils/format';

export default function HomeScreen() {
  const { user } = useSession();

  if (isAdmin(user)) {
    return <AdminFinancialHomeScreen user={user} />;
  }

  if (isWarehouseOperator(user)) {
    return <WarehouseActionHubScreen user={user} />;
  }

  return <DriverHomeScreen user={user} />;
}

/* ===================================================================
   VISTA 1: HOME FINANCIERO (ADMINISTRADOR)
   =================================================================== */

function AdminFinancialHomeScreen({ user }: { user: User | null }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    adminService
      .getFinancialDashboard()
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    adminService
      .getFinancialDashboard()
      .then((res) => setData(res))
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'Administrador';
  const pendingApprovals = data?.summary?.pending_approvals_count ?? 0;
  const criticalAlerts = data?.summary?.critical_alerts_count ?? 0;

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CABECERA EJECUTIVA */}
        <View style={styles.adminHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminGreeting}>Hola, {firstName} 👑</Text>
            <Text style={styles.adminSub}>Panel Ejecutivo · Finanzas MicroMaster</Text>
          </View>
          <View style={styles.adminRoleBadge}>
            <Ionicons color="#10B981" name="shield-checkmark" size={16} />
            <Text style={styles.adminRoleText}>ADMINISTRADOR</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Cargando indicadores financieros…</Text>
          </View>
        ) : (
          <>
            {/* 3 TARJETAS DE INDICADORES FINANCIEROS */}
            <View style={styles.financialCardsCol}>
              {/* 1. EFECTIVO EN LA CALLE */}
              <View style={[styles.finCard, styles.finCardCash]}>
                <View style={styles.finCardTop}>
                  <View style={[styles.finIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                    <Ionicons color="#10B981" name="cash" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.finCardTitle, { color: '#10B981' }]}>
                      EFECTIVO EN LA CALLE
                    </Text>
                    <Text style={styles.finCardDesc}>
                      Pedidos en tránsito y entregados hoy
                    </Text>
                  </View>
                </View>
                <Text style={styles.finCardAmount}>
                  {formatMoney(data?.kpis?.cash_in_street ?? 0)}
                </Text>
                <View style={styles.finCardFooter}>
                  <Ionicons color="#10B981" name="checkmark-circle-outline" size={14} />
                  <Text style={styles.finCardFooterText}>
                    Dinero físico y cobros activos en reparto
                  </Text>
                </View>
              </View>

              {/* 2. VALOR DEL INVENTARIO */}
              <View style={[styles.finCard, styles.finCardInventory]}>
                <View style={styles.finCardTop}>
                  <View style={[styles.finIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                    <Ionicons color="#38BDF8" name="cube" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.finCardTitle, { color: '#38BDF8' }]}>
                      VALOR DEL INVENTARIO
                    </Text>
                    <Text style={styles.finCardDesc}>
                      Costo ponderado de mercancía en bodega
                    </Text>
                  </View>
                </View>
                <Text style={styles.finCardAmount}>
                  {formatMoney(data?.kpis?.inventory_value ?? 0)}
                </Text>
                <View style={styles.finCardFooter}>
                  <Ionicons color="#38BDF8" name="layers-outline" size={14} />
                  <Text style={styles.finCardFooterText}>
                    Valoración calculada según compras e insumos
                  </Text>
                </View>
              </View>

              {/* 3. COSTO DE MERMAS DEL DÍA */}
              <View style={[styles.finCard, styles.finCardWaste]}>
                <View style={styles.finCardTop}>
                  <View style={[styles.finIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <Ionicons color="#F59E0B" name="trending-down" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.finCardTitle, { color: '#F59E0B' }]}>
                      COSTO DE MERMAS DEL DÍA
                    </Text>
                    <Text style={styles.finCardDesc}>
                      Bajas y deterioros registrados hoy
                    </Text>
                  </View>
                </View>
                <Text style={styles.finCardAmount}>
                  {formatMoney(data?.kpis?.daily_waste_cost ?? 0)}
                </Text>
                <View style={styles.finCardFooter}>
                  <Ionicons color="#F59E0B" name="alert-circle-outline" size={14} />
                  <Text style={styles.finCardFooterText}>
                    Reportes de bajas emitidos por supervisores
                  </Text>
                </View>
              </View>
            </View>

            {/* SECCIÓN VISTA 2: CENTRO DE APROBACIONES */}
            <Pressable
              onPress={() => router.push('/approvals' as any)}
              style={({ pressed }) => [
                styles.navBannerCard,
                pressed && styles.navBannerPressed,
              ]}
            >
              <View style={styles.navBannerIconBox}>
                <Ionicons color="#10B981" name="shield-checkmark" size={30} />
              </View>
              <View style={styles.navBannerTextBox}>
                <View style={styles.navBannerHeadRow}>
                  <Text style={styles.navBannerTitle}>Centro de Aprobaciones</Text>
                  {pendingApprovals > 0 ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{pendingApprovals} pendientes</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.navBannerDesc}>
                  Peticiones bloqueadas por cupos de crédito, bajas de alto valor o anulaciones en calle.
                </Text>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={22} />
            </Pressable>

            {/* SECCIÓN VISTA 3: ALERTAS CRÍTICAS */}
            <Pressable
              onPress={() => router.push('/critical_alerts' as any)}
              style={({ pressed }) => [
                styles.navBannerCard,
                styles.navBannerAlerts,
                pressed && styles.navBannerPressed,
              ]}
            >
              <View style={[styles.navBannerIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Ionicons color="#EF4444" name="warning" size={30} />
              </View>
              <View style={styles.navBannerTextBox}>
                <View style={styles.navBannerHeadRow}>
                  <Text style={styles.navBannerTitle}>Alertas Críticas Macro</Text>
                  {criticalAlerts > 0 ? (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertBadgeText}>{criticalAlerts} activas</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.navBannerDesc}>
                  Rutas retrasadas &gt;40%, quiebres de insumos vitales y cuarentenas sanitarias automáticas.
                </Text>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={22} />
            </Pressable>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

/* ===================================================================
   VISTA: HUB DE ACCIÓN DEL AUXILIAR DE BODEGA
   Modo Oscuro, 3 botones gigantes para pulgar o guantes
   =================================================================== */

function WarehouseActionHubScreen({ user }: { user: User | null }) {
  const [hubData, setHubData] = useState<WarehouseHubData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    warehouseService
      .getHub()
      .then((res) => {
        if (active) setHubData(res);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    warehouseService
      .getHub()
      .then((res) => setHubData(res))
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'Auxiliar';

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.warehouseScroll}
        refreshControl={
          <RefreshControl
            colors={['#10B981']}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CABECERA EN MODO OSCURO */}
        <View style={styles.whHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.whGreeting}>Hola, {firstName} 📦</Text>
            <Text style={styles.whSub}>Muelle Principal · Turno Bodega Activo</Text>
          </View>
          <View style={styles.whRoleBadge}>
            <Ionicons color="#38BDF8" name="cube" size={16} />
            <Text style={styles.whRoleText}>BODEGA</Text>
          </View>
        </View>

        {/* CONTENEDOR DE ACCIONES PRINCIPALES (ALISTAMIENTO & AUDITORÍA) */}
        <View style={styles.whButtonsContainer}>
          {/* BOTÓN 1: ALISTAMIENTO / PICKING */}
          <Pressable
            onPress={() => router.push('/warehouse/picking')}
            style={({ pressed }) => [
              styles.whGiantBtn,
              styles.whBtnDispatch,
              pressed && styles.whGiantBtnPressed,
            ]}
          >
            <View style={styles.whBtnContent}>
              <View style={[styles.whBtnIconBox, { backgroundColor: '#1E3A8A' }]}>
                <Ionicons color="#60A5FA" name="file-tray-stacked" size={36} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.whBtnTopRow}>
                  <Text style={styles.whBtnTitle}>[ 📦 ALISTAMIENTO / PICKING ]</Text>
                  <View style={styles.whBadgeBlue}>
                    <Text style={styles.whBadgeBlueText}>
                      {hubData?.counts?.pickings ?? 3} Pedidos Aprobados
                    </Text>
                  </View>
                </View>
                <Text style={styles.whBtnSub}>
                  Preparar pedidos aprobados. Checklist de estiba con descuento automático de inventario.
                </Text>
              </View>
            </View>
          </Pressable>

          {/* BOTÓN 2: AUDITORÍA (SELECCIÓN DE MISIÓN) */}
          <Pressable
            onPress={() => router.push('/warehouse/audit-select')}
            style={({ pressed }) => [
              styles.whGiantBtn,
              styles.whBtnAudit,
              pressed && styles.whGiantBtnPressed,
            ]}
          >
            <View style={styles.whBtnContent}>
              <View style={[styles.whBtnIconBox, { backgroundColor: '#78350F' }]}>
                <Ionicons color="#FBBF24" name="clipboard" size={36} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.whBtnTopRow}>
                  <Text style={styles.whBtnTitle}>[ 📋 AUDITORÍA DE INVENTARIO ]</Text>
                  <View style={styles.whBadgeAmber}>
                    <Text style={styles.whBadgeAmberText}>Selección de Misión</Text>
                  </View>
                </View>
                <Text style={styles.whBtnSub}>
                  ¿Qué vas a auditar? Elige entre Insumos (Báscula) o Producto Terminado (Conteo).
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

/* ===================================================================
   VISTA OPERATIVA: HOME DEL CONDUCTOR (TRANSPORTISTA)
   =================================================================== */

function DriverHomeScreen({ user }: { user: User | null }) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [cashTally, setCashTally] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sosVisible, setSosVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const localOrders = await offlineService.getOrders();
      const localCash = await offlineService.getCashTally();
      const pendingCount = await offlineService.getPendingCount();

      setOrders(localOrders);
      setCashTally(localCash);
      setPendingSyncCount(pendingCount);

      try {
        const result = await deliveryService.getOrders();
        if (result?.orders && result.orders.length > 0) {
          await offlineService.saveOrders(result.orders);
          setOrders(result.orders);
        }
      } catch {
        // modo offline
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = offlineService.subscribe(() => {
      void loadData();
    });
    return unsubscribe;
  }, [loadData]);

  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try {
      await offlineService.syncOutbox();
      const pending = await offlineService.getPendingCount();
      setPendingSyncCount(pending);
    } finally {
      setSyncing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
    void handleManualSync();
  }, [loadData, handleManualSync]);

  const openWaze = (order: DeliveryOrder) => {
    const lat = order.latitude ?? 6.2088;
    const lng = order.longitude ?? -75.5658;
    const query = encodeURIComponent(order.destination ?? order.client_name ?? '');

    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const mapsUrl =
      Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${query})`;

    Linking.canOpenURL(wazeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(wazeUrl);
        }
        return Linking.openURL(mapsUrl);
      })
      .catch(() => {
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        ).catch(() => undefined);
      });
  };

  const openOrderDetail = (orderId: number | string) => {
    router.push({
      pathname: '/orders_delivery/[id]',
      params: { id: String(orderId) },
    });
  };

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'delivered').length;
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
  const pendingOrders = totalOrders - completedOrders - cancelledOrders;
  const progressPercent = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  const firstName = user?.name?.split(' ')[0] ?? 'Conductor';

  return (
    <Screen edges={['top']}>
      {/* BARRA SUPERIOR DE SINCRONIZACIÓN OFFLINE-FIRST */}
      <View
        style={[
          styles.syncBanner,
          pendingSyncCount > 0 ? styles.syncBannerPending : styles.syncBannerOk,
        ]}
      >
        <View style={styles.syncBannerLeft}>
          <Ionicons
            color={pendingSyncCount > 0 ? '#F59E0B' : '#10B981'}
            name={pendingSyncCount > 0 ? 'cloud-offline' : 'cloud-done'}
            size={18}
          />
          <Text style={styles.syncBannerText}>
            {pendingSyncCount > 0
              ? `${pendingSyncCount} acción(es) pendiente(s) de sincronizar (Offline)`
              : 'Base de datos sincronizada con la oficina'}
          </Text>
        </View>
        {pendingSyncCount > 0 ? (
          <Pressable
            disabled={syncing}
            onPress={handleManualSync}
            style={styles.syncButton}
          >
            {syncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Sincronizar</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola, {firstName} 🚛</Text>
            <Text style={styles.routeLabel}>Ruta Activa: Centro - Sur</Text>
          </View>
          <View style={styles.driverBadge}>
            <Ionicons color={colors.primary} name="shield-checkmark" size={16} />
            <Text style={styles.driverBadgeText}>EN RUTA</Text>
          </View>
        </View>

        {/* 1. ARQUEO DE BOLSILLO */}
        <View style={styles.cashCard}>
          <View style={styles.cashTopRow}>
            <View style={styles.cashIconBox}>
              <Ionicons color="#10B981" name="wallet" size={28} />
            </View>
            <View style={styles.cashTitleBox}>
              <Text style={styles.cashLabel}>ARQUEO DE BOLSILLO</Text>
              <Text style={styles.cashSubtitle}>
                Efectivo físico a entregar al supervisor
              </Text>
            </View>
          </View>

          <View style={styles.cashAmountBox}>
            <Text style={styles.cashAmount}>{formatMoney(cashTally)}</Text>
          </View>

          <View style={styles.cashFooter}>
            <View style={styles.cashTipRow}>
              <Ionicons color="#10B981" name="checkmark-circle" size={16} />
              <Text style={styles.cashTip}>
                Cuadre instantáneo en cangurera al volver a base
              </Text>
            </View>
          </View>
        </View>

        {/* 2. PROGRESO DEL DÍA */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHead}>
            <View>
              <Text style={styles.progressTitle}>Progreso del Día</Text>
              <Text style={styles.progressSubtitle}>
                Entregas completadas: <Text style={styles.highlight}>{completedOrders}</Text> de {totalOrders}
              </Text>
            </View>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{progressPercent}%</Text>
            </View>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progressPercent, 100)}%` },
              ]}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {completedOrders}
              </Text>
              <Text style={styles.statLabel}>Entregados</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {pendingOrders}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.danger }]}>
                {cancelledOrders}
              </Text>
              <Text style={styles.statLabel}>Novedad/Rechazo</Text>
            </View>
          </View>
        </Card>

        {/* LISTADO DE ENTREGAS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Entregas Asignadas Hoy</Text>
          <Text style={styles.sectionCount}>{orders.length} clientes</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Cargando ruta de hoy…</Text>
          </View>
        ) : (
          orders.map((order, index) => {
            const isDelivered = order.status === 'delivered';
            const isCancelled = order.status === 'cancelled';

            return (
              <Pressable
                key={String(order.id ?? index)}
                onPress={() => openOrderDetail(order.id)}
                style={({ pressed }) => [
                  styles.orderCard,
                  isDelivered && styles.orderCardDelivered,
                  isCancelled && styles.orderCardCancelled,
                  pressed && styles.orderCardPressed,
                ]}
              >
                <View style={styles.orderTopRow}>
                  <View style={styles.orderIndexBadge}>
                    <Text style={styles.orderIndexText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {order.client_name ?? `Pedido #${order.id}`}
                    </Text>
                    <Text style={styles.clientAddress} numberOfLines={2}>
                      📍 {order.destination ?? 'Dirección sin especificar'}
                    </Text>
                  </View>
                  <StatusPill
                    label={
                      isDelivered
                        ? 'Entregado'
                        : isCancelled
                          ? 'Cancelado'
                          : 'Pendiente'
                    }
                    tone={statusTone(order.status)}
                  />
                </View>

                <View style={styles.orderBottomRow}>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Monto a cobrar:</Text>
                    <Text style={styles.orderAmount}>
                      {formatMoney(order.amount)}
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        openWaze(order);
                      }}
                      style={styles.wazeSmallButton}
                    >
                      <Ionicons color="#38BDF8" name="navigate" size={16} />
                      <Text style={styles.wazeSmallText}>Waze</Text>
                    </Pressable>

                    <View
                      style={[
                        styles.openDetailButton,
                        isDelivered ? styles.openDetailButtonDelivered : styles.openDetailButtonPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.openDetailText,
                          isDelivered ? styles.openDetailTextDelivered : styles.openDetailTextPending,
                        ]}
                      >
                        {isDelivered ? 'Ver Remisión' : 'Entregar >'}
                      </Text>
                      <Ionicons
                        color={isDelivered ? colors.textMuted : '#FFFFFF'}
                        name={isDelivered ? 'eye-outline' : 'chevron-forward'}
                        size={16}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* 3. BOTÓN S.O.S. (PÁNICO LOGÍSTICO) */}
      <View style={styles.floatingSosContainer}>
        <Pressable
          onPress={() => setSosVisible(true)}
          style={({ pressed }) => [
            styles.sosButton,
            pressed && styles.sosButtonPressed,
          ]}
        >
          <View style={styles.sosPulseIcon}>
            <Ionicons color="#FFFFFF" name="alert-circle" size={28} />
          </View>
          <View style={styles.sosTextBox}>
            <Text style={styles.sosTitle}>BOTÓN S.O.S.</Text>
            <Text style={styles.sosSubtitle}>Pánico Logístico Inmediato</Text>
          </View>
          <Ionicons color="#FFFFFF" name="chevron-forward" size={24} />
        </Pressable>
      </View>

      <SosModal onClose={() => setSosVisible(false)} visible={sosVisible} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  // ADMIN HOME ESTILOS
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  adminGreeting: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  adminSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  adminRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  adminRoleText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  financialCardsCol: {
    gap: spacing.md,
  },
  finCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
  },
  finCardCash: {
    backgroundColor: '#0E1F1A',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  finCardInventory: {
    backgroundColor: '#0E1E28',
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  finCardWaste: {
    backgroundColor: '#23180E',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  finCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  finIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  finCardDesc: {
    color: colors.textMuted,
    fontSize: 12,
  },
  finCardAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  finCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: spacing.xs,
  },
  finCardFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // BANNERS NAVEGACIÓN (APROBACIONES Y ALERTAS)
  navBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  navBannerAlerts: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  navBannerPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: colors.primary,
  },
  navBannerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBannerTextBox: {
    flex: 1,
    gap: 4,
  },
  navBannerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  navBannerDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  pendingBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pendingBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  alertBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  // CONDUCTOR HOME ESTILOS
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderBottomWidth: 1,
  },
  syncBannerOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  syncBannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  syncBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  syncBannerText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  syncButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  syncButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  routeLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  driverBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  cashCard: {
    backgroundColor: '#0F1E19',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  cashTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cashIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashTitleBox: {
    flex: 1,
  },
  cashLabel: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cashSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cashAmountBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  cashAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cashFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
    paddingTop: spacing.xs,
  },
  cashTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cashTip: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
  },
  progressCard: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  progressSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  highlight: {
    color: colors.primary,
    fontWeight: '800',
  },
  percentBadge: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
  },
  percentText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  progressBarTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.xs,
  },
  statBox: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  orderCardDelivered: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: '#0F1E19',
  },
  orderCardCancelled: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    opacity: 0.85,
  },
  orderCardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: colors.primary,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  orderIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderIndexText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  clientInfo: {
    flex: 1,
    gap: 3,
  },
  clientName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  clientAddress: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  amountBox: {
    gap: 2,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  orderAmount: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wazeSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  wazeSmallText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  openDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  openDetailButtonPending: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  openDetailButtonDelivered: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
  },
  openDetailText: {
    fontSize: 13,
    fontWeight: '800',
  },
  openDetailTextPending: {
    color: '#FFFFFF',
  },
  openDetailTextDelivered: {
    color: colors.textMuted,
  },
  floatingSosContainer: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: radius.xl,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    shadowColor: '#DC2626',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  sosButtonPressed: {
    backgroundColor: '#B91C1C',
    transform: [{ scale: 0.98 }],
  },
  sosPulseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTextBox: {
    flex: 1,
  },
  sosTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sosSubtitle: {
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '600',
  },

  // WAREHOUSE ACTION HUB ESTILOS
  warehouseScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  whHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  whGreeting: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  whSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  whRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  whRoleText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  whButtonsContainer: {
    gap: 16,
    marginTop: spacing.xs,
  },
  whGiantBtn: {
    borderRadius: radius.xl,
    padding: spacing.md,
    minHeight: 124,
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  whGiantBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  whBtnReception: {
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  whBtnDispatch: {
    backgroundColor: '#1D4ED8',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  whBtnAudit: {
    backgroundColor: '#B45309',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  whBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  whBtnIconBox: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whBtnTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  whBtnTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  whBtnSub: {
    color: '#F1F5F9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  whBadgeGreen: {
    backgroundColor: 'rgba(4, 120, 87, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  whBadgeGreenText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '800',
  },
  whBadgeBlue: {
    backgroundColor: 'rgba(30, 58, 138, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  whBadgeBlueText: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '800',
  },
  whBadgeAmber: {
    backgroundColor: 'rgba(120, 53, 15, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  whBadgeAmberText: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '800',
  },
});
