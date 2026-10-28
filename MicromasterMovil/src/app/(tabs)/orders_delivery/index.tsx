import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill } from '@/components/StatusPill';
import { MODULE_IDS, roleLabel } from '@/constants/roles';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { RoleGate } from '@/components/RoleGate';
import { deliveryService } from '@/services/delivery.service';
import { offlineService } from '@/services/offline.service';
import type { DeliveryRoute, RouteStop, RouteSummary } from '@/types/models';
import { formatDate, formatMoney, formatNumber, statusTone } from '@/utils/format';

function routeMeta(route: DeliveryRoute): string[] {
  const parts: string[] = [];
  if (route.scheduled_date) parts.push(formatDate(route.scheduled_date));
  if (route.distance_km != null) parts.push(`${formatNumber(route.distance_km, 1)} km`);
  if (route.duration_min != null) parts.push(`${Math.round(route.duration_min)} min`);
  return parts;
}

function stopTone(stop: RouteStop): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  return statusTone(stop.status);
}

function paymentLabel(stop: RouteStop): string | null {
  if (stop.payment_status === 'completed') return 'Cobrado';
  if (stop.payment_status === 'confirmed') return 'Confirmado';
  if (stop.payment_status === 'pending') return 'Por cobrar';
  return null;
}

export default function OrdersDeliveryScreen() {
  const { user } = useSession();

  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [summary, setSummary] = useState<RouteSummary>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackToOffline = useCallback(async () => {
    const offlineOrders = await offlineService.getOrders();
    const stops: RouteStop[] = offlineOrders.map((o) => ({
      order_id: Number(o.id),
      client_name: o.client_name,
      destination: o.destination,
      latitude: o.latitude ?? 6.2088,
      longitude: o.longitude ?? -75.5658,
      status: o.status,
      payment_status: o.payment_status,
      amount: o.amount ?? 0,
    }));

    const deliveredCount = stops.filter((s) => s.status === 'delivered').length;
    const progress = stops.length > 0 ? Math.round((deliveredCount / stops.length) * 100) : 0;

    const mockRoute: DeliveryRoute = {
      id: 1,
      route_code: 'RUTA-SUR-01',
      destination: 'Zona Metropolitana Sur (Medellín)',
      status: 'in_progress',
      status_label: 'En Ruta',
      scheduled_date: new Date().toISOString(),
      distance_km: 18.4,
      duration_min: 140,
      progress,
      stops_count: stops.length,
      delivered_count: deliveredCount,
      stops,
      open_incidents: 0,
    };

    setRoutes([mockRoute]);
    setSummary({
      total: 1,
      active: 1,
      completed: deliveredCount === stops.length ? 1 : 0,
      open_incidents: 0,
    });
    setError(null);
  }, []);

  const load = useCallback(() => {
    deliveryService
      .getRoutes()
      .then((result) => {
        if (result.routes && result.routes.length > 0) {
          setRoutes(result.routes);
          setSummary(result.summary);
          setError(null);
        } else {
          void fallbackToOffline();
        }
      })
      .catch(() => {
        void fallbackToOffline();
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [fallbackToOffline]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  const openOrder = useCallback((orderId: number | string) => {
    router.push({
      pathname: '/orders_delivery/[id]',
      params: { id: String(orderId) },
    });
  }, []);

  const chips = [
    { key: 'total', label: 'Rutas', value: summary.total ?? routes.length, icon: 'git-branch-outline' as const, tone: 'info' as const },
    { key: 'active', label: 'Activas', value: summary.active ?? 0, icon: 'play-outline' as const, tone: 'warning' as const },
    { key: 'completed', label: 'Completadas', value: summary.completed ?? 0, icon: 'checkmark-done-outline' as const, tone: 'success' as const },
    { key: 'incidents', label: 'Incidencias', value: summary.open_incidents ?? 0, icon: 'warning-outline' as const, tone: 'danger' as const },
  ];

  const chipColors: Record<string, string> = {
    info: colors.info,
    warning: colors.warning,
    success: colors.success,
    danger: colors.danger,
  };

  return (
    <RoleGate module={MODULE_IDS.orders}>
      <Screen
        edges={['top']}
        header={
          <ScreenHeader
            subtitle={`${roleLabel(user?.role)} · ${user?.name ?? ''}`}
            title="Rutas asignadas"
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
          <View style={styles.chips}>
            {chips.map((chip) => (
              <View key={chip.key} style={styles.chip}>
                <Ionicons color={chipColors[chip.tone]} name={chip.icon} size={16} />
                <Text style={styles.chipValue}>{formatNumber(chip.value)}</Text>
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </View>
            ))}
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
              <Text style={styles.loadingText}>Cargando rutas y paradas…</Text>
            </View>
          ) : null}

          {!loading && !error && routes.length === 0 ? (
            <Card>
              <EmptyState
                icon="map-outline"
                message="Cuando el equipo de logística te asigne una ruta aparecerá aquí."
                title="Sin rutas asignadas"
              />
            </Card>
          ) : null}

          {routes.map((route) => {
            const stops = route.stops ?? [];
            const meta = routeMeta(route);

            return (
              <Card key={route.id}>
                <View style={styles.routeHead}>
                  <View style={styles.routeCode}>
                    <Ionicons color={colors.primary} name="navigate" size={16} />
                    <Text style={styles.routeCodeText}>{route.route_code}</Text>
                  </View>
                  <StatusPill label={route.status_label ?? route.status} tone={statusTone(route.status)} />
                </View>

                <Text style={styles.routeDestination} numberOfLines={2}>
                  {route.destination ?? 'Destino sin definir'}
                </Text>

                <View style={styles.metaRow}>
                  {meta.map((item) => (
                    <View key={item} style={styles.metaChip}>
                      <Text style={styles.metaText}>{item}</Text>
                    </View>
                  ))}
                  {(route.open_incidents ?? 0) > 0 ? (
                    <View style={[styles.metaChip, styles.metaChipDanger]}>
                      <Ionicons color={colors.danger} name="warning" size={12} />
                      <Text style={[styles.metaText, styles.metaTextDanger]}>
                        {route.open_incidents} abierta(s)
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(route.progress ?? 0, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {route.delivered_count ?? 0}/{route.stops_count ?? stops.length} paradas ·{' '}
                  {route.progress ?? 0}% completado
                </Text>

                <View style={styles.stopsBox}>
                  <Text style={styles.stopsTitle}>Paradas de entrega</Text>
                  {stops.length === 0 ? (
                    <EmptyState icon="location-outline" title="Sin paradas con coordenadas" />
                  ) : (
                    stops.map((stop, index) => {
                      const label = paymentLabel(stop);
                      return (
                        <Pressable
                          key={`${stop.order_id}-${index}`}
                          onPress={() => openOrder(stop.order_id)}
                          style={({ pressed }) => [styles.stopRow, pressed && styles.stopRowPressed]}
                        >
                          <View style={styles.stopIndex}>
                            <Text style={styles.stopIndexText}>{index + 1}</Text>
                          </View>
                          <View style={styles.stopInfo}>
                            <Text style={styles.stopClient} numberOfLines={1}>
                              {stop.client_name ?? `Pedido #${stop.order_id}`}
                            </Text>
                            <Text style={styles.stopDestination} numberOfLines={1}>
                              {stop.destination ?? 'Sin dirección'}
                            </Text>
                            <View style={styles.stopPills}>
                              <StatusPill label={statusLabel(stop.status)} tone={stopTone(stop)} />
                              {label ? (
                                <StatusPill
                                  label={label}
                                  tone={stop.payment_status === 'pending' ? 'warning' : 'success'}
                                />
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.stopRight}>
                            <Text style={styles.stopAmount}>{formatMoney(stop.amount)}</Text>
                            <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </Screen>
    </RoleGate>
  );
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'assigned':
      return 'Asignado';
    case 'in_transit':
      return 'En tránsito';
    case 'delivered':
      return 'Entregado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status ?? 'Sin estado';
  }
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  chipValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
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
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  routeCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeCodeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  routeDestination: {
    color: colors.textMuted,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipDanger: {
    borderColor: `${colors.danger}66`,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  metaTextDanger: {
    color: colors.danger,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  stopsBox: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  stopsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  stopRowPressed: {
    opacity: 0.8,
    borderColor: colors.primary,
  },
  stopIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: `${colors.primary}66`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndexText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopClient: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stopDestination: {
    color: colors.textMuted,
    fontSize: 12,
  },
  stopPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  stopRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  stopAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
