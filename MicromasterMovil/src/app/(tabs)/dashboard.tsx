import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppIconName } from '@/components/AppButton';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { RoleGate } from '@/components/RoleGate';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill, type PillTone } from '@/components/StatusPill';
import { MODULE_IDS, roleLabel } from '@/constants/roles';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboard.service';
import { deliveryService } from '@/services/delivery.service';
import type {
  DashboardFefoEntry,
  DeliveryIncident,
  DeliveryOrder,
  DeliveryRoute,
  IncidentSummary,
  Kpis,
  RouteSummary,
} from '@/types/models';
import { getApiErrorMessage } from '@/utils/errors';
import { formatMoney, formatNumber, statusTone } from '@/utils/format';

interface KpiTile {
  key: keyof Kpis;
  label: string;
  icon: AppIconName;
  color: string;
  money?: boolean;
}

const KPI_TILES: KpiTile[] = [
  { key: 'pending_orders', label: 'Pedidos pendientes', icon: 'time-outline', color: colors.warning },
  { key: 'completed_orders', label: 'Pedidos completados', icon: 'checkmark-circle-outline', color: colors.success },
  { key: 'critical_batches', label: 'Lotes críticos', icon: 'alert-circle-outline', color: colors.danger },
  { key: 'warning_batches', label: 'Lotes por vencer', icon: 'hourglass-outline', color: colors.warning },
  { key: 'total_inventory_value', label: 'Valor inventario', icon: 'cash-outline', color: colors.info, money: true },
  { key: 'total_revenue', label: 'Ingresos', icon: 'trending-up-outline', color: colors.success, money: true },
  { key: 'total_collected', label: 'Cobrado', icon: 'wallet-outline', color: colors.primary, money: true },
  { key: 'total_recipes', label: 'Recetas', icon: 'restaurant-outline', color: colors.primary },
];

function kpiText(tile: KpiTile, kpis: Kpis | null): string {
  const value = kpis ? kpis[tile.key] : undefined;
  if (value == null) return '—';
  return tile.money ? formatMoney(value) : formatNumber(value);
}

function incidentLabel(incident: DeliveryIncident): string {
  return incident.type_label ?? incident.type ?? 'Incidencia';
}

export default function DashboardScreen() {
  const { user } = useSession();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [fefo, setFefo] = useState<DashboardFefoEntry[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary>({});
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([]);
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(() => {
    dashboardService
      .fetchDashboard()
      .then((payload) => {
        setKpis(payload.kpis ?? {});
        setFefo(payload.fefo_matrix ?? []);
        setError(null);
        setUpdatedAt(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err)))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    deliveryService
      .getOrders()
      .then((result) => setOrders(result.orders))
      .catch(() => setOrders([]));

    deliveryService
      .getRoutes()
      .then((result) => {
        setRoutes(result.routes);
        setRouteSummary(result.summary);
      })
      .catch(() => setRoutes([]));

    deliveryService
      .getIncidents()
      .then((result) => {
        setIncidents(result.incidents);
        setIncidentSummary(result.summary);
      })
      .catch(() => setIncidents([]));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      load();
    }, 30000);

    return () => clearInterval(timer);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  const routeChips = [
    { key: 'total', label: 'Rutas', value: routeSummary.total ?? routes.length, tone: 'info' as PillTone },
    { key: 'active', label: 'Activas', value: routeSummary.active ?? 0, tone: 'warning' as PillTone },
    { key: 'completed', label: 'Cerradas', value: routeSummary.completed ?? 0, tone: 'success' as PillTone },
    { key: 'open', label: 'Incidencias', value: incidentSummary.open ?? 0, tone: 'danger' as PillTone },
  ];

  const chipColors: Record<PillTone, string> = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
    neutral: colors.textMuted,
  };

  return (
    <RoleGate module={MODULE_IDS.dashboard}>
      <Screen
        edges={['top']}
        header={
          <ScreenHeader
            subtitle={`${roleLabel(user?.role)} · actualización cada 30 s`}
            title="Panel de control"
          />
        }
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              tintColor={colors.primary}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.liveRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {updatedAt ? `En vivo · ${updatedAt}` : 'Conectado'}
              </Text>
            </View>
            <AppButton
              fullWidth={false}
              icon="refresh-outline"
              title="Actualizar"
              variant="secondary"
              onPress={retry}
            />
          </View>

          {error ? (
            <Card accent>
              <View style={styles.errorRow}>
                <Ionicons color={colors.danger} name="cloud-offline-outline" size={20} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <AppButton icon="refresh-outline" title="Reintentar" variant="secondary" onPress={retry} />
            </Card>
          ) : null}

          {loading && !error ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Sincronizando indicadores…</Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {KPI_TILES.map((tile) => (
              <Card key={tile.key} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: `${tile.color}26` }]}>
                  <Ionicons color={tile.color} name={tile.icon} size={20} />
                </View>
                <Text style={styles.tileValue}>{kpiText(tile, kpis)}</Text>
                <Text style={styles.tileLabel}>{tile.label}</Text>
              </Card>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Semáforo FEFO</Text>
          </View>
          <Card>
            {fefo.length === 0 ? (
              <EmptyState icon="pie-chart-outline" title="Sin datos de vencimiento" />
            ) : (
              fefo.map((entry) => (
                <View key={`${entry.type}-${entry.color}`} style={styles.fefoRow}>
                  <View style={[styles.fefoDot, { backgroundColor: entry.color }]} />
                  <Text style={styles.fefoLabel}>{entry.type}</Text>
                  <Text style={styles.fefoCount}>{formatNumber(entry.count)}</Text>
                </View>
              ))
            )}
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Supervisión de rutas</Text>
          </View>
          <Card>
            <View style={styles.chips}>
              {routeChips.map((chip) => (
                <View key={chip.key} style={styles.chip}>
                  <Text style={[styles.chipValue, { color: chipColors[chip.tone] }]}>
                    {formatNumber(chip.value)}
                  </Text>
                  <Text style={styles.chipLabel}>{chip.label}</Text>
                </View>
              ))}
            </View>

            {routes.length === 0 ? (
              <EmptyState icon="map-outline" title="Sin rutas registradas" />
            ) : (
              routes.map((route) => (
                <View key={route.id} style={styles.supervisionRow}>
                  <View style={styles.supervisionInfo}>
                    <Text style={styles.supervisionTitle}>{route.route_code}</Text>
                    <Text style={styles.supervisionMeta} numberOfLines={1}>
                      {route.driver?.name ?? 'Sin conductor'} · {route.destination ?? '—'}
                    </Text>
                  </View>
                  <StatusPill
                    label={route.status_label ?? route.status}
                    tone={statusTone(route.status)}
                  />
                  <Text style={styles.supervisionCount}>
                    {route.delivered_count ?? 0}/{route.stops_count ?? 0}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pedidos recientes</Text>
          </View>
          <Card>
            {orders.length === 0 ? (
              <EmptyState icon="file-tray-outline" title="Sin pedidos" />
            ) : (
              orders.slice(0, 6).map((order) => (
                <View key={order.id} style={styles.supervisionRow}>
                  <View style={styles.supervisionInfo}>
                    <Text style={styles.supervisionTitle}>
                      {order.client_name ?? `Pedido #${order.id}`}
                    </Text>
                    <Text style={styles.supervisionMeta} numberOfLines={1}>
                      {order.destination ?? '—'} · {formatMoney(order.amount)}
                    </Text>
                  </View>
                  <StatusPill
                    label={order.status_label ?? order.status ?? 'Sin estado'}
                    tone={statusTone(order.status)}
                  />
                </View>
              ))
            )}
            {orders.length > 0 ? (
              <AppButton
                icon="navigate-outline"
                title="Ver todas las entregas"
                variant="secondary"
                onPress={() => router.push('/orders_delivery/index')}
              />
            ) : null}
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Incidencias abiertas</Text>
          </View>
          <Card>
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Text style={[styles.chipValue, { color: colors.danger }]}>
                  {formatNumber(incidentSummary.open ?? 0)}
                </Text>
                <Text style={styles.chipLabel}>Abiertas</Text>
              </View>
              <View style={styles.chip}>
                <Text style={[styles.chipValue, { color: colors.success }]}>
                  {formatNumber(incidentSummary.resolved ?? 0)}
                </Text>
                <Text style={styles.chipLabel}>Resueltas</Text>
              </View>
              <View style={styles.chip}>
                <Text style={[styles.chipValue, { color: colors.info }]}>
                  {formatNumber(incidentSummary.total ?? incidents.length)}
                </Text>
                <Text style={styles.chipLabel}>Total</Text>
              </View>
            </View>

            {incidents.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" title="Todo en orden" />
            ) : (
              incidents.slice(0, 4).map((incident) => (
                <View key={incident.id} style={styles.supervisionRow}>
                  <View style={styles.supervisionInfo}>
                    <Text style={styles.supervisionTitle}>{incidentLabel(incident)}</Text>
                    <Text style={styles.supervisionMeta} numberOfLines={2}>
                      {incident.description ?? 'Sin detalle'} · Pedido #{incident.order_id ?? '—'}
                    </Text>
                  </View>
                  <StatusPill
                    label={incident.status_label ?? incident.status ?? 'Abierta'}
                    tone={incident.status === 'RESOLVED' ? 'success' : 'danger'}
                  />
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </Screen>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.success}22`,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 150,
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.md,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  fefoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fefoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fefoLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  fefoCount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  chipValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  supervisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  supervisionInfo: {
    flex: 1,
    gap: 2,
  },
  supervisionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  supervisionMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  supervisionCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
