import { Ionicons } from '@expo/vector-icons';
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
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboard.service';
import type { Kpis, Order } from '@/types/models';
import { getApiErrorMessage } from '@/utils/errors';
import { pickCollection, pickObject } from '@/utils/payload';

interface KpiTile {
  key: string;
  label: string;
  icon: AppIconName;
  color: string;
}

const KPI_TILES: KpiTile[] = [
  { key: 'pending_orders', label: 'Pedidos pendientes', icon: 'time-outline', color: colors.warning },
  { key: 'completed_orders', label: 'Pedidos completados', icon: 'checkmark-circle-outline', color: colors.success },
  { key: 'critical_batches', label: 'Lotes críticos', icon: 'alert-circle-outline', color: colors.danger },
  { key: 'total_batches', label: 'Lotes totales', icon: 'layers-outline', color: colors.info },
  { key: 'total_ingredients', label: 'Insumos', icon: 'flask-outline', color: colors.primary },
  { key: 'total_inventory_kg', label: 'Inventario (kg)', icon: 'cube-outline', color: colors.info },
];

function kpiValue(kpis: Kpis | null, key: string): string {
  const value = kpis ? (kpis as unknown as Record<string, unknown>)[key] : undefined;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'string') return value;
  return '0';
}

function orderTitle(order: Order, index: number): string {
  return order.client_name ?? order.destination ?? `Pedido #${order.id ?? index + 1}`;
}

function orderBadge(order: Order): string | null {
  return order.status_label ?? order.payment_status_label ?? order.status ?? null;
}

export default function HomeScreen() {
  const { user } = useSession();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    const response = await dashboardService.getSummary();
    return (pickObject(response.data, 'kpis', 'summary') ?? {}) as Kpis;
  }, []);

  const fetchOrders = useCallback(async () => {
    const response = await dashboardService.getDeliveryOrders();
    return pickCollection(response.data, 'orders') as Order[];
  }, []);

  const load = useCallback(async () => {
    const [dashboardResult, ordersResult] = await Promise.allSettled([
      fetchKpis(),
      fetchOrders(),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setKpis(dashboardResult.value);
      setDashboardError(null);
    } else {
      setDashboardError(getApiErrorMessage(dashboardResult.reason));
    }

    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value);
      setOrdersError(null);
    } else {
      setOrdersError(getApiErrorMessage(ordersResult.reason));
    }

    setLoading(false);
    setRefreshing(false);
  }, [fetchKpis, fetchOrders]);

  useEffect(() => {
    let active = true;

    fetchKpis()
      .then((value) => {
        if (active) {
          setKpis(value);
          setDashboardError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setDashboardError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchOrders()
      .then((value) => {
        if (active) {
          setOrders(value);
          setOrdersError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setOrdersError(getApiErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, [fetchKpis, fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const firstName = user?.name?.split(' ')[0] ?? 'operador';

  return (
    <Screen edges={['top']}>
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
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hola, {firstName}</Text>
            <Text style={styles.headerSubtitle}>Resumen operativo de MicroMaster</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'M')
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </Text>
          </View>
        </View>

        {dashboardError ? (
          <Card accent>
            <View style={styles.errorRow}>
              <Ionicons color={colors.danger} name="cloud-offline-outline" size={20} />
              <Text style={styles.errorText}>{dashboardError}</Text>
            </View>
            <AppButton
              icon="refresh-outline"
              title="Reintentar"
              variant="secondary"
              onPress={() => {
                setLoading(true);
                void load();
              }}
            />
          </Card>
        ) : null}

        {loading && !dashboardError ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Sincronizando con MicroMaster…</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {KPI_TILES.map((tile) => (
            <Card key={tile.key} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: `${tile.color}26` }]}>
                <Ionicons color={tile.color} name={tile.icon} size={20} />
              </View>
              <Text style={styles.tileValue}>{kpiValue(kpis, tile.key)}</Text>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pedidos recientes</Text>
          <Ionicons color={colors.textMuted} name="arrow-forward" size={16} />
        </View>

        <Card>
          {ordersError ? (
            <View style={styles.emptyBox}>
              <Ionicons color={colors.textMuted} name="lock-closed-outline" size={24} />
              <Text style={styles.emptyText}>{ordersError}</Text>
            </View>
          ) : orders.length === 0 && !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons color={colors.textMuted} name="file-tray-outline" size={28} />
              <Text style={styles.emptyText}>Sin pedidos registrados por ahora.</Text>
            </View>
          ) : (
            orders.map((order, index) => (
              <View
                key={String(order.id ?? index)}
                style={[styles.orderRow, index === orders.length - 1 && styles.orderRowLast]}
              >
                <View style={styles.orderIcon}>
                  <Ionicons color={colors.primary} name="cube-outline" size={18} />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{orderTitle(order, index)}</Text>
                  <Text style={styles.orderMeta} numberOfLines={1}>
                    {order.destination ?? 'Sin destino asignado'}
                  </Text>
                </View>
                {orderBadge(order) ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{orderBadge(order)}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
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
    flexBasis: '30%',
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
    fontSize: 24,
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
  emptyBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  orderIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfo: {
    flex: 1,
    gap: 2,
  },
  orderTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  orderMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
