import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/constants/theme';
import type { StockBatch, StockEntryPayload, StockIngredient } from '@/types/models';
import { daysText, formatDate, formatNumber, formatTime, toNumber } from '@/utils/format';

type ScanMode = 'entry' | 'exit';

interface ScannerModalProps {
  visible: boolean;
  onClose: () => void;
  batches: StockBatch[];
  ingredients: StockIngredient[];
  onEntry: (payload: StockEntryPayload) => Promise<void>;
  onExit: (batchId: number, quantity: number) => Promise<void>;
}

interface EntryDraft {
  ingredientId: number | null;
  batchCode: string;
  supplierName: string;
  quantity: string;
  expirationDate: string;
}

const EMPTY_ENTRY: EntryDraft = {
  ingredientId: null,
  batchCode: '',
  supplierName: '',
  quantity: '',
  expirationDate: '',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ScannerModal({
  visible,
  onClose,
  batches,
  ingredients,
  onEntry,
  onExit,
}: ScannerModalProps) {
  const [mode, setMode] = useState<ScanMode>('exit');
  const [phase, setPhase] = useState<'idle' | 'result'>('idle');
  const [scannedBatch, setScannedBatch] = useState<StockBatch | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [entry, setEntry] = useState<EntryDraft>(EMPTY_ENTRY);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scanPosition] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      scanPosition.stopAnimation();
      return undefined;
    }

    scanPosition.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPosition, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanPosition, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [visible, scanPosition]);

  const close = () => {
    setPhase('idle');
    setScannedBatch(null);
    setEntry(EMPTY_ENTRY);
    setQuantity('');
    setManualCode('');
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const switchMode = (next: ScanMode) => {
    setMode(next);
    setPhase('idle');
    setScannedBatch(null);
    setError(null);
  };

  const simulateScan = () => {
    setError(null);

    if (mode === 'exit') {
      const term = manualCode.trim().toLowerCase();
      const matches = batches.filter(
        (batch) =>
          !term ||
          batch.batch_code?.toLowerCase().includes(term) ||
          (batch.qr_code_hash ?? '').toLowerCase().includes(term) ||
          (batch.ingredient?.name ?? '').toLowerCase().includes(term),
      );

      if (matches.length === 0) {
        setError(
          term
            ? `No se encontró ningún lote con "${manualCode.trim()}".`
            : 'No hay lotes cargados para escanear.',
        );
        return;
      }

      setScannedBatch(matches[Math.floor(Math.random() * matches.length)] ?? null);
      setQuantity('');
      setPhase('result');
      return;
    }

    setEntry({
      ...EMPTY_ENTRY,
      batchCode: `SIM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      expirationDate: todayIso(),
    });
    setPhase('result');
  };

  const confirmEntry = async () => {
    if (!entry.ingredientId) {
      setError('Selecciona el insumo del lote.');
      return;
    }
    if (!entry.batchCode.trim()) {
      setError('Ingresa el código de lote.');
      return;
    }
    if (toNumber(entry.quantity) <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expirationDate)) {
      setError('La fecha de vencimiento debe tener formato YYYY-MM-DD.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onEntry({
        ingredient_id: entry.ingredientId,
        batch_code: entry.batchCode.trim(),
        supplier_name: entry.supplierName.trim() || undefined,
        quantity: toNumber(entry.quantity),
        expiration_date: entry.expirationDate,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.');
      setSubmitting(false);
    }
  };

  const confirmExit = async () => {
    if (!scannedBatch) return;

    const amount = toNumber(quantity);
    if (amount <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }
    if (amount > toNumber(scannedBatch.quantity)) {
      setError(`Solo hay ${toNumber(scannedBatch.quantity)} disponibles en este lote.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onExit(scannedBatch.id, amount);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la salida.');
      setSubmitting(false);
    }
  };

  const scanLine = scanPosition.interpolate({ inputRange: [0, 1], outputRange: [8, 148] });

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerTexts}>
              <Text style={styles.title}>Escáner de inventario</Text>
              <Text style={styles.subtitle}>Lectura simulada de QR / barras</Text>
            </View>
            <Pressable accessibilityLabel="Cerrar escáner" hitSlop={10} onPress={close}>
              <Ionicons color={colors.textMuted} name="close" size={24} />
            </Pressable>
          </View>

          <View style={styles.segment}>
            {(['exit', 'entry'] as ScanMode[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => switchMode(item)}
                style={[styles.segmentItem, mode === item && styles.segmentItemActive]}
              >
                <Ionicons
                  color={mode === item ? colors.onPrimary : colors.textMuted}
                  name={item === 'entry' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={16}
                />
                <Text style={[styles.segmentLabel, mode === item && styles.segmentLabelActive]}>
                  {item === 'entry' ? 'Entrada' : 'Salida'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.viewport}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              <Ionicons color={`${colors.primary}AA`} name="qr-code-outline" size={54} />
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLine }] }]}
              />
            </View>
            <Text style={styles.viewportHint}>
              Apunta al código del lote o pulsa “Simular lectura”
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mode === 'exit' && phase === 'idle' ? (
              <View style={styles.manualRow}>
                <TextInput
                  autoCapitalize="characters"
                  onChangeText={setManualCode}
                  placeholder="Código de lote o QR (opcional)"
                  placeholderTextColor={colors.textMuted}
                  style={styles.manualInput}
                  value={manualCode}
                />
              </View>
            ) : null}

            {phase === 'idle' ? (
              <AppButton
                icon="scan-outline"
                title="Simular lectura"
                onPress={simulateScan}
              />
            ) : null}

            {phase === 'result' && mode === 'exit' && scannedBatch ? (
              <View style={styles.formBox}>
                <View style={styles.scannedHead}>
                  <Ionicons color={colors.primary} name="cube-outline" size={20} />
                  <View style={styles.scannedTexts}>
                    <Text style={styles.scannedTitle}>{scannedBatch.batch_code}</Text>
                    <Text style={styles.scannedMeta}>
                      {scannedBatch.ingredient?.name ?? 'Insumo'} ·{' '}
                      {formatDate(scannedBatch.expiration_date)} ·{' '}
                      {daysText(scannedBatch.days_to_expire)}
                    </Text>
                  </View>
                  <Text style={styles.scannedQty}>
                    {formatNumber(scannedBatch.quantity, 2)}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Cantidad a retirar</Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setQuantity}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={quantity}
                  />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <AppButton
                  icon="remove-circle-outline"
                  loading={submitting}
                  title="Registrar salida"
                  variant="danger"
                  onPress={confirmExit}
                />
              </View>
            ) : null}

            {phase === 'result' && mode === 'entry' ? (
              <View style={styles.formBox}>
                <Text style={styles.label}>Insumo</Text>
                <ScrollView
                  contentContainerStyle={styles.chips}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {ingredients.map((ingredient) => {
                    const active = entry.ingredientId === ingredient.id;
                    return (
                      <Pressable
                        key={ingredient.id}
                        onPress={() => setEntry({ ...entry, ingredientId: ingredient.id })}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                          {ingredient.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.field}>
                  <Text style={styles.label}>Código de lote</Text>
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={(text) => setEntry({ ...entry, batchCode: text })}
                    placeholder="LOT-0001"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={entry.batchCode}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Proveedor</Text>
                  <TextInput
                    onChangeText={(text) => setEntry({ ...entry, supplierName: text })}
                    placeholder="Nombre del proveedor"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={entry.supplierName}
                  />
                </View>

                <View style={styles.fieldRow}>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(text) => setEntry({ ...entry, quantity: text })}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      value={entry.quantity}
                    />
                  </View>
                  <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.label}>Vencimiento</Text>
                    <TextInput
                      onChangeText={(text) => setEntry({ ...entry, expirationDate: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      value={entry.expirationDate}
                    />
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <AppButton
                  icon="arrow-down-circle-outline"
                  loading={submitting}
                  title="Registrar entrada"
                  onPress={confirmEntry}
                />
              </View>
            ) : null}

            {phase === 'result' ? (
              <Pressable onPress={() => setPhase('idle')}>
                <Text style={styles.reset}>Escanear otro código</Text>
              </Pressable>
            ) : null}

            {error && phase === 'idle' ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.stamp}>Sesión de escaneo {formatTime()}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 18, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginTop: spacing.md,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentLabelActive: {
    color: colors.onPrimary,
  },
  viewport: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  frame: {
    width: 200,
    height: 170,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.primary,
  },
  cornerTopLeft: {
    top: 8,
    left: 8,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.sm,
  },
  cornerTopRight: {
    top: 8,
    right: 8,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.sm,
  },
  cornerBottomLeft: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.sm,
  },
  cornerBottomRight: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.sm,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  viewportHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  scroll: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  manualRow: {
    gap: spacing.xs,
  },
  manualInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    color: colors.text,
    fontSize: 14,
  },
  formBox: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  scannedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  scannedTexts: {
    flex: 1,
    gap: 1,
  },
  scannedTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  scannedMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  scannedQty: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '800',
  },
  field: {
    gap: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 46,
    color: colors.text,
    fontSize: 15,
  },
  chips: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  reset: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  stamp: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
