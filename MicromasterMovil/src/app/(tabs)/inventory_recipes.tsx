import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { RoleGate } from '@/components/RoleGate';
import { ScannerModal } from '@/components/ScannerModal';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill, type PillTone } from '@/components/StatusPill';
import { MODULE_IDS, roleLabel } from '@/constants/roles';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { stockService } from '@/services/stock.service';
import type {
  StockBatch,
  StockEntryPayload,
  StockIngredient,
  StockPageMeta,
  StockSummary,
} from '@/types/models';
import { getApiErrorMessage } from '@/utils/errors';
import { daysText, formatDate, formatNumber, statusTone } from '@/utils/format';

type StatusFilter = 'all' | 'optimal' | 'warning' | 'critical';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'optimal', label: 'Óptimos' },
  { value: 'warning', label: 'Por vencer' },
  { value: 'critical', label: 'Críticos' },
];

export default function InventoryRecipesScreen() {
  const { user } = useSession();

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [meta, setMeta] = useState<StockPageMeta>({});
  const [summary, setSummary] = useState<StockSummary>({});
  const [ingredients, setIngredients] = useState<StockIngredient[]>([]);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    (targetPage: number, append: boolean) => {
      stockService
        .getBatches({
          page: targetPage,
          search: submitted.trim() || undefined,
          status: filter === 'all' ? undefined : filter,
        })
        .then((result) => {
          setBatches((prev) => (append ? [...prev, ...result.batches] : result.batches));
          setMeta(result.meta);
          setSummary(result.summary);
          setError(null);
        })
        .catch((err: unknown) => setError(getApiErrorMessage(err)))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        });
    },
    [submitted, filter],
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  useEffect(() => {
    stockService
      .getIngredients()
      .then((result) => setIngredients(result))
      .catch(() => setIngredients([]));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, false);
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    load(1, false);
  }, [load]);

  const applySearch = useCallback(() => {
    const next = query.trim();
    if (next === submitted) return;
    setLoading(true);
    setSubmitted(next);
  }, [query, submitted]);

  const clearSearch = useCallback(() => {
    if (!query && !submitted) return;
    setLoading(true);
    setQuery('');
    setSubmitted('');
  }, [query, submitted]);

  const applyFilter = useCallback(
    (value: StatusFilter) => {
      if (value === filter) return;
      setLoading(true);
      setFilter(value);
    },
    [filter],
  );

  const loadMore = useCallback(() => {
    if (loadingMore) return;
    if ((meta.current_page ?? 1) >= (meta.pages ?? 1)) return;
    setLoadingMore(true);
    load((meta.current_page ?? 1) + 1, true);
  }, [load, loadingMore, meta.current_page, meta.pages]);

  const handleEntry = useCallback(
    (payload: StockEntryPayload) =>
      stockService
        .registerEntry(payload)
        .then(() => {
          setToast(`Entrada registrada: ${payload.batch_code}`);
          load(1, false);
        })
        .catch((err: unknown) => {
          throw new Error(getApiErrorMessage(err));
        }),
    [load],
  );

  const handleExit = useCallback(
    (batchId: number, quantity: number) =>
      stockService
        .registerExit(batchId, quantity)
        .then(() => {
          setToast(`Salida registrada: ${formatNumber(quantity, 2)}`);
          load(1, false);
        })
        .catch((err: unknown) => {
          throw new Error(getApiErrorMessage(err));
        }),
    [load],
  );

  const chips = [
    { key: 'total', label: 'Lotes', value: summary.total ?? batches.length, tone: 'info' as const },
    { key: 'optimal', label: 'Óptimos', value: summary.optimal ?? 0, tone: 'success' as const },
    { key: 'warning', label: 'Por vencer', value: summary.warning ?? 0, tone: 'warning' as const },
    { key: 'critical', label: 'Críticos', value: summary.critical ?? 0, tone: 'danger' as const },
  ];

  const chipColors: Record<PillTone, string> = {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    neutral: colors.textMuted,
  };

  return (
    <RoleGate module={MODULE_IDS.inventory}>
      <Screen
        edges={['top']}
        header={
          <ScreenHeader
            right={
              <Pressable
                accessibilityLabel="Abrir escáner"
                onPress={() => setScannerOpen(true)}
                style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
              >
                <Ionicons color={colors.onPrimary} name="qr-code-outline" size={20} />
              </Pressable>
            }
            subtitle={`${roleLabel(user?.role)} · control FEFO`}
            title="Inventario y lotes"
          />
        }
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
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
          <View style={styles.searchRow}>
            <Ionicons color={colors.textMuted} name="search" size={18} />
            <TextInput
              onChangeText={setQuery}
              onSubmitEditing={applySearch}
              placeholder="Buscar lote, insumo o proveedor"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={clearSearch}>
                <Ionicons color={colors.textMuted} name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.chips}>
            {chips.map((chip) => (
              <View key={chip.key} style={styles.chip}>
                <Text style={[styles.chipValue, { color: chipColors[chip.tone] }]}>
                  {formatNumber(chip.value)}
                </Text>
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.filters}>
            {FILTERS.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => applyFilter(item.value)}
                style={[styles.filter, filter === item.value && styles.filterActive]}
              >
                <Text
                  style={[styles.filterLabel, filter === item.value && styles.filterLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {toast ? (
            <Pressable onPress={() => setToast(null)} style={styles.toast}>
              <Ionicons color={colors.success} name="checkmark-circle-outline" size={16} />
              <Text style={styles.toastText}>{toast}</Text>
            </Pressable>
          ) : null}

          {error ? (
            <Card accent>
              <Text style={styles.errorText}>{error}</Text>
              <AppButton icon="refresh-outline" title="Reintentar" variant="secondary" onPress={retry} />
            </Card>
          ) : null}

          {loading && !error ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Cargando lotes en orden FEFO…</Text>
            </View>
          ) : null}

          {!loading && !error && batches.length === 0 ? (
            <Card>
              <EmptyState
                icon="cube-outline"
                message="Registra una entrada con el escáner para crear el primer lote."
                title="Sin lotes para mostrar"
              />
            </Card>
          ) : null}

          {batches.map((batch) => {
            const tone = statusTone(batch.status);
            const remaining = Math.max(0, Math.min(batch.remaining_percentage ?? 100, 100));

            return (
              <Card key={batch.id}>
                <View style={styles.batchHead}>
                  <View style={styles.batchCode}>
                    <Ionicons color={colors.primary} name="pricetag-outline" size={16} />
                    <Text style={styles.batchCodeText}>{batch.batch_code}</Text>
                  </View>
                  <StatusPill
                    label={
                      tone === 'success'
                        ? 'Óptimo'
                        : tone === 'warning'
                          ? 'Por vencer'
                          : tone === 'danger'
                            ? 'Crítico'
                            : 'Normal'
                    }
                    tone={tone}
                  />
                </View>

                <Text style={styles.batchIngredient} numberOfLines={1}>
                  {batch.ingredient?.name ?? 'Insumo'} ·{' '}
                  <Text style={styles.batchSupplier}>{batch.supplier_name ?? 'Sin proveedor'}</Text>
                </Text>

                <View style={styles.batchRow}>
                  <Text style={styles.batchDate}>Vence {formatDate(batch.expiration_date)}</Text>
                  <Text style={[styles.batchDays, { color: chipColors[tone] }]}>
                    {daysText(batch.days_to_expire)}
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${remaining}%`, backgroundColor: chipColors[tone] },
                    ]}
                  />
                </View>
                <View style={styles.batchRow}>
                  <Text style={styles.batchMeta}>
                    Disponible {formatNumber(batch.quantity, 2)} /{' '}
                    {formatNumber(batch.initial_quantity ?? batch.quantity, 2)}
                  </Text>
                  <Text style={styles.batchMeta}>{Math.round(remaining)}% restante</Text>
                </View>
              </Card>
            );
          })}

          {(meta.current_page ?? 1) < (meta.pages ?? 1) ? (
            <AppButton
              icon="chevron-down-outline"
              loading={loadingMore}
              title="Cargar más lotes"
              variant="secondary"
              onPress={loadMore}
            />
          ) : null}
        </ScrollView>

        <ScannerModal
          batches={batches}
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onEntry={handleEntry}
          onExit={handleExit}
          ingredients={ingredients}
        />
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
  scanButton: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonPressed: {
    opacity: 0.8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.sm,
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
    fontSize: 18,
    fontWeight: '800',
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: colors.primary,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
    backgroundColor: `${colors.success}22`,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  toastText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  batchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  batchCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  batchCodeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  batchIngredient: {
    color: colors.text,
    fontSize: 14,
  },
  batchSupplier: {
    color: colors.textMuted,
    fontSize: 13,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  batchDate: {
    color: colors.textMuted,
    fontSize: 13,
  },
  batchDays: {
    fontSize: 13,
    fontWeight: '700',
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
  },
  batchMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
