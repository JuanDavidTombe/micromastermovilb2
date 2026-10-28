import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomNumpad } from '@/components/CustomNumpad';
import { radius, spacing } from '@/constants/theme';
import {
  warehouseService,
  type AuditBatch,
  type AuditNature,
  type AuditPlan,
  type AuditProductGroup,
  type AuditZone,
  type UnlistedItem,
} from '@/services/warehouse.service';

export default function WarehouseAuditScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const params = useLocalSearchParams<{ nature?: string }>();

  // Naturaleza fija de esta misión (seleccionada en la pantalla previa)
  const activeNature: AuditNature =
    params.nature === 'PRODUCTO_TERMINADO' ? 'PRODUCTO_TERMINADO' : 'INSUMO';

  const [zones, setZones] = useState<AuditZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('cava-carnes');
  const [auditPlan, setAuditPlan] = useState<AuditPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // -------------------------------------------------------------
  // ESTADOS MODO BÁSCULA (INSUMOS): Pesaje, Tara y Peso Neto
  // -------------------------------------------------------------
  const [weighTarget, setWeighTarget] = useState<{
    productId: string;
    productName: string;
    unit: string;
    tareApplicable: boolean;
    defaultTarePerCrate: number;
    batch: AuditBatch;
  } | null>(null);
  const [weighActiveField, setWeighActiveField] = useState<'gross' | 'crates'>('gross');
  const [grossInput, setGrossInput] = useState('');
  const [cratesInput, setCratesInput] = useState('0');
  const [showWeighModal, setShowWeighModal] = useState(false);

  // -------------------------------------------------------------
  // ESTADOS MODO CONTEO (PRODUCTO TERMINADO): Cajas/Pacas
  // -------------------------------------------------------------
  const [countTarget, setCountTarget] = useState<{
    productId: string;
    productName: string;
    unit: string;
    batch: AuditBatch;
  } | null>(null);
  const [countInput, setCountInput] = useState('');
  const [showCountModal, setShowCountModal] = useState(false);

  // -------------------------------------------------------------
  // MODAL DE JUSTIFICACIÓN DE DESCUADRE
  // -------------------------------------------------------------
  const [pendingDiscrepancy, setPendingDiscrepancy] = useState<{
    productId: string;
    productName: string;
    batchId: string;
    batchCode: string;
    unit: string;
    expectedQty: number;
    physicalQty: number;
    difference: number;
  } | null>(null);
  const [showJustificationModal, setShowJustificationModal] = useState(false);

  // -------------------------------------------------------------
  // REGISTRAR PRODUCTO NO LISTADO (SOBRANTE EXCLUSIVO)
  // -------------------------------------------------------------
  const [showUnlistedModal, setShowUnlistedModal] = useState(false);
  const [unlistedName, setUnlistedName] = useState('');
  const [unlistedBatch, setUnlistedBatch] = useState('');
  const [unlistedQty, setUnlistedQty] = useState('');
  const [unlistedUnit, setUnlistedUnit] = useState('kg');
  const [unlistedActiveField, setUnlistedActiveField] = useState<'qty' | null>(null);

  // Carga manual al cambiar de zona dentro de la misma naturaleza
  const handleSelectZone = useCallback((zoneId: string) => {
    setSelectedZoneId(zoneId);
    setLoading(true);
    warehouseService
      .getAuditPlan(zoneId, activeNature)
      .then((res) => {
        setAuditPlan(res);
        if (res.products.length > 0) {
          const initialExpanded: Record<string, boolean> = {};
          res.products.forEach((p, idx) => {
            initialExpanded[p.id] = idx === 0;
          });
          setExpandedProductIds(initialExpanded);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [activeNature]);

  useEffect(() => {
    let active = true;
    warehouseService
      .getAuditZones(activeNature)
      .then((z) => {
        if (!active) return;
        setZones(z);
        if (z.length > 0) {
          const defaultZoneId = z[0].id;
          setSelectedZoneId(defaultZoneId);
          return warehouseService.getAuditPlan(defaultZoneId, activeNature);
        }
      })
      .then((plan) => {
        if (!active || !plan) return;
        setAuditPlan(plan);
        if (plan.products.length > 0) {
          const initialExpanded: Record<string, boolean> = {};
          plan.products.forEach((p, idx) => {
            initialExpanded[p.id] = idx === 0;
          });
          setExpandedProductIds(initialExpanded);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeNature]);

  const toggleExpand = (productId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore
    }
    setExpandedProductIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // ------------------------------------------------------------------
  // ACCIÓN RÁPIDA: CONFIRMAR LOTE (CERO DIGITACIÓN)
  // ------------------------------------------------------------------
  const handleConfirmBatch = async (product: AuditProductGroup, batch: AuditBatch) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }

    await warehouseService.confirmBatch(selectedZoneId, product.id, batch.id);

    setAuditPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.map((p) => {
          if (p.id !== product.id) return p;
          return {
            ...p,
            batches: p.batches.map((b) => {
              if (b.id !== batch.id) return b;
              return {
                ...b,
                status: 'CONFIRMED',
                physical_quantity: b.expected_quantity,
                discrepancy_reason: null,
              };
            }),
          };
        }),
      };
    });
  };

  // ------------------------------------------------------------------
  // INTERFAZ 1: MANEJO DEL PESAJE Y TARA (MODO BÁSCULA - INSUMOS)
  // ------------------------------------------------------------------
  const handleOpenWeighModal = (product: AuditProductGroup, batch: AuditBatch) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    setWeighTarget({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      tareApplicable: product.tare_applicable ?? true,
      defaultTarePerCrate: product.default_tare_per_crate ?? 1.8,
      batch,
    });
    setGrossInput(String(batch.gross_weight || batch.expected_quantity));
    setCratesInput(String(batch.tare_crates || 0));
    setWeighActiveField('gross');
    setShowWeighModal(true);
  };

  const handleConfirmWeighing = () => {
    if (!weighTarget) return;
    setShowWeighModal(false);

    const gross = parseFloat(grossInput) || 0;
    const crates = parseInt(cratesInput, 10) || 0;
    const tarePerCrate = weighTarget.tareApplicable ? weighTarget.defaultTarePerCrate : 0;
    const totalTare = Math.round(crates * tarePerCrate * 10) / 10;
    const calculatedNet = Math.max(0, Math.round((gross - totalTare) * 10) / 10);
    const expected = weighTarget.batch.expected_quantity;

    if (calculatedNet === expected) {
      handleConfirmBatch(
        {
          id: weighTarget.productId,
          name: weighTarget.productName,
          unit: weighTarget.unit,
        } as AuditProductGroup,
        weighTarget.batch
      );
      setWeighTarget(null);
      return;
    }

    // Hay descuadre en peso neto: abre el modal de justificación
    setPendingDiscrepancy({
      productId: weighTarget.productId,
      productName: weighTarget.productName,
      batchId: weighTarget.batch.id,
      batchCode: weighTarget.batch.batch_code,
      unit: weighTarget.unit,
      expectedQty: expected,
      physicalQty: calculatedNet,
      difference: Math.round((calculatedNet - expected) * 10) / 10,
    });
    setShowJustificationModal(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // ignore
    }
  };

  // ------------------------------------------------------------------
  // INTERFAZ 2: MANEJO DE CONTEO CERRADO (MODO CONTEO - PRODUCTO TERMINADO)
  // ------------------------------------------------------------------
  const handleOpenCountModal = (product: AuditProductGroup, batch: AuditBatch) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    setCountTarget({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      batch,
    });
    setCountInput(String(batch.physical_quantity || batch.expected_quantity));
    setShowCountModal(true);
  };

  const handleConfirmCounting = (val: string) => {
    if (!countTarget) return;
    setShowCountModal(false);

    const physical = parseInt(val, 10) || 0;
    const expected = countTarget.batch.expected_quantity;

    if (physical === expected) {
      handleConfirmBatch(
        {
          id: countTarget.productId,
          name: countTarget.productName,
          unit: countTarget.unit,
        } as AuditProductGroup,
        countTarget.batch
      );
      setCountTarget(null);
      return;
    }

    // Hay descuadre en unidades/cajas
    setPendingDiscrepancy({
      productId: countTarget.productId,
      productName: countTarget.productName,
      batchId: countTarget.batch.id,
      batchCode: countTarget.batch.batch_code,
      unit: countTarget.unit,
      expectedQty: expected,
      physicalQty: physical,
      difference: physical - expected,
    });
    setShowJustificationModal(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // ignore
    }
  };

  // ------------------------------------------------------------------
  // JUSTIFICACIÓN RÁPIDA DE DESCUADRE
  // ------------------------------------------------------------------
  const handleSaveDiscrepancyReason = async (reason: 'FALTANTE' | 'AVERIA' | 'VENCIDO') => {
    if (!pendingDiscrepancy) return;
    const { productId, batchId, physicalQty } = pendingDiscrepancy;

    setShowJustificationModal(false);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }

    await warehouseService.adjustBatch({
      zoneId: selectedZoneId,
      productId,
      batchId,
      physicalQuantity: physicalQty,
      reason,
      notes: `Auditoría en modo ${activeNature === 'INSUMO' ? 'Báscula' : 'Conteo'}`,
    });

    setAuditPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            batches: p.batches.map((b) => {
              if (b.id !== batchId) return b;
              return {
                ...b,
                status: 'DISCREPANCY',
                physical_quantity: physicalQty,
                discrepancy_reason: reason,
              };
            }),
          };
        }),
      };
    });

    setPendingDiscrepancy(null);
    setWeighTarget(null);
    setCountTarget(null);
  };

  // ------------------------------------------------------------------
  // SOBRANTES (PRODUCTO NO LISTADO)
  // ------------------------------------------------------------------
  const handleSaveUnlisted = async () => {
    const qty = parseFloat(unlistedQty);
    if (!unlistedName.trim() || !unlistedBatch.trim() || isNaN(qty) || qty <= 0) {
      Alert.alert('Atención', 'Ingresa el nombre, lote y cantidad física encontrada.');
      return;
    }

    const res = await warehouseService.registerUnlisted({
      zoneId: selectedZoneId,
      productName: unlistedName.trim(),
      batchCode: unlistedBatch.trim(),
      physicalQuantity: qty,
      unit: unlistedUnit,
      locationHint: `Sobrante en ${auditPlan?.zone_name ?? ''}`,
    });

    setAuditPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unlisted_items: [...prev.unlisted_items, res.item],
      };
    });

    setShowUnlistedModal(false);
    setUnlistedName('');
    setUnlistedBatch('');
    setUnlistedQty('');

    Alert.alert('Sobrante Registrado', res.message);
  };

  const handleFinalizeZone = () => {
    Alert.alert(
      'Finalizar Auditoría de Zona',
      `¿Deseas consolidar el inventario de ${auditPlan?.zone_name}? Las diferencias serán enviadas al supervisor para aprobación contable.`,
      [
        { text: 'Seguir auditando', style: 'cancel' },
        {
          text: 'Finalizar y Consolidar',
          style: 'destructive',
          onPress: async () => {
            const res = await warehouseService.finalizeZone(selectedZoneId);
            Alert.alert('Zona Finalizada', res.message, [
              { text: 'Volver al Hub', onPress: () => router.back() },
            ]);
          },
        },
      ]
    );
  };

  const allBatches = auditPlan?.products.flatMap((p) => p.batches) ?? [];
  const totalBatches = allBatches.length;
  const confirmedBatches = allBatches.filter((b) => b.status === 'CONFIRMED').length;
  const discrepancyBatches = allBatches.filter((b) => b.status === 'DISCREPANCY').length;
  const auditedCount = confirmedBatches + discrepancyBatches;
  const progressPercent = totalBatches > 0 ? Math.round((auditedCount / totalBatches) * 100) : 0;

  const isScaleMode = activeNature === 'INSUMO';

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={isScaleMode ? '#10B981' : '#38BDF8'} size="large" />
        <Text style={styles.loadingText}>
          {isScaleMode ? 'Cargando Libreta de Báscula (Insumos)...' : 'Cargando Checklist de Almacén (PT)...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* CABECERA PRINCIPAL DEDICADA */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons color="#FFFFFF" name="arrow-back" size={24} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isScaleMode ? '🌾 Auditoría: Insumos / MP' : '📦 Auditoría: Producto Terminado'}
          </Text>
          <Text style={styles.headerSub}>
            {isScaleMode ? '⚖️ Modo Báscula & Tara' : '📋 Modo Conteo Cerrado'} · {auditPlan?.zone_name}
          </Text>
        </View>
        <View
          style={[
            styles.natureModeBadge,
            isScaleMode ? styles.natureBadgeScale : styles.natureBadgeCount,
          ]}
        >
          <Text
            style={[
              styles.natureModeBadgeText,
              isScaleMode ? styles.natureBadgeScaleText : styles.natureBadgeCountText,
            ]}
          >
            {isScaleMode ? 'BÁSCULA' : 'CONTEO'}
          </Text>
        </View>
      </View>

      {/* SELECTOR DE ZONAS PERTENECIENTES A ESTA CATEGORÍA */}
      <View style={styles.zoneSelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {zones.map((z) => {
            const isSelected = z.id === selectedZoneId;
            return (
              <Pressable
                key={z.id}
                onPress={() => {
                  handleSelectZone(z.id);
                }}
                style={[
                  styles.zonePill,
                  isSelected && (isScaleMode ? styles.zonePillActiveScale : styles.zonePillActiveCount),
                ]}
              >
                <Text style={[styles.zonePillText, isSelected && styles.zonePillTextActive]}>
                  {z.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* BARRA DE PROGRESO */}
      <View style={styles.statusBar}>
        <View style={styles.statusBarRow}>
          <Text style={styles.statusProgressText}>
            Lotes conciliados: {auditedCount} / {totalBatches} ({progressPercent}%)
          </Text>
          <View style={styles.countersRow}>
            <View style={styles.counterChipGreen}>
              <Text style={styles.counterChipGreenText}>✔️ {confirmedBatches} Conformes</Text>
            </View>
            {discrepancyBatches > 0 && (
              <View style={styles.counterChipRed}>
                <Text style={styles.counterChipRedText}>⚠️ {discrepancyBatches} Descuadres</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: isScaleMode ? '#10B981' : '#38BDF8',
              },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* BANNER INFORMATIVO DE LA MODALIDAD ACTIVA */}
        <View
          style={[
            styles.modeNoticeBanner,
            isScaleMode ? styles.modeNoticeScale : styles.modeNoticeCount,
          ]}
        >
          <Ionicons
            color={isScaleMode ? '#34D399' : '#38BDF8'}
            name={isScaleMode ? 'scale' : 'cube'}
            size={22}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.modeNoticeTitle, { color: isScaleMode ? '#A7F3D0' : '#BAE6FD' }]}>
              {isScaleMode
                ? 'INTERFAZ DE INSUMOS: MODO BÁSCULA ACTIVO'
                : 'INTERFAZ DE PRODUCTO TERMINADO: MODO CONTEO ACTIVO'}
            </Text>
            <Text style={styles.modeNoticeDesc}>
              {isScaleMode
                ? 'Todo se rige por Peso Neto (Kg/Litros). Cero paquetes o unidades sueltas.'
                : 'Checklist de almacén en cantidades cerradas (Cajas, Pacas). Cero báscula o tara.'}
            </Text>
          </View>
        </View>

        {/* LISTADO MAESTRO-DETALLE SEGREGADO */}
        {auditPlan?.products.map((product) => {
          const isExpanded = !!expandedProductIds[product.id];
          const totalExpected = product.batches.reduce((sum, b) => sum + b.expected_quantity, 0);
          const totalPhysical = product.batches.reduce(
            (sum, b) => sum + (b.status === 'PENDING' ? b.expected_quantity : b.physical_quantity),
            0
          );
          const hasDiscrepancy = product.batches.some((b) => b.status === 'DISCREPANCY');
          const allConfirmed = product.batches.every((b) => b.status === 'CONFIRMED');

          return (
            <View key={product.id} style={styles.productMasterCard}>
              {/* CABECERA MAESTRA */}
              <Pressable onPress={() => toggleExpand(product.id)} style={styles.productMasterHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.productTitleRow}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={styles.skuBadge}>
                      <Text style={styles.skuBadgeText}>{product.sku}</Text>
                    </View>
                  </View>

                  <Text style={styles.locationLabel}>{product.location_label}</Text>

                  <View style={styles.masterStockRow}>
                    <Text style={styles.masterExpectedText}>
                      Sistema:{' '}
                      <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>
                        {totalExpected} {product.unit}
                      </Text>
                    </Text>

                    {allConfirmed && (
                      <View style={styles.badgeSuccess}>
                        <Text style={styles.badgeSuccessText}>✔️ CONCILIADO</Text>
                      </View>
                    )}
                    {hasDiscrepancy && (
                      <View style={styles.badgeWarning}>
                        <Text style={styles.badgeWarningText}>
                          ⚠️ DIFERENCIA ({totalPhysical - totalExpected} {product.unit})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.expandChevronBox}>
                  <Ionicons
                    color="#94A3B8"
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                  />
                </View>
              </Pressable>

              {/* DETALLE DE LOTES ESPECÍFICOS */}
              {isExpanded && (
                <View style={styles.batchesDetailContainer}>
                  <Text style={styles.batchesDetailTitle}>
                    {isScaleMode
                      ? `LOTES CÁRNICOS / INSUMOS A PESAR (${product.batches.length})`
                      : `LOTES CERRADOS A CONTAR (${product.batches.length})`}
                  </Text>

                  {product.batches.map((batch) => {
                    const isConfirmed = batch.status === 'CONFIRMED';
                    const isDiscrepant = batch.status === 'DISCREPANCY';
                    const diff = Math.round((batch.physical_quantity - batch.expected_quantity) * 10) / 10;

                    return (
                      <View
                        key={batch.id}
                        style={[
                          styles.batchRowCard,
                          isConfirmed && styles.batchRowConfirmed,
                          isDiscrepant && styles.batchRowDiscrepant,
                        ]}
                      >
                        <View style={styles.batchInfoCol}>
                          <View style={styles.batchCodeRow}>
                            <Text style={styles.batchCodeText}>{batch.batch_code}</Text>
                            <Text style={styles.batchExpiryText}>
                              Vence: {batch.expiration_date}
                            </Text>
                          </View>

                          <View style={styles.quantitiesRow}>
                            <Text style={styles.batchExpectedQty}>
                              Esperado:{' '}
                              <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>
                                {batch.expected_quantity} {product.unit}
                              </Text>
                            </Text>

                            {isDiscrepant ? (
                              <Text style={styles.batchPhysicalDiff}>
                                Físico: {batch.physical_quantity} {product.unit} ({diff > 0 ? `+${diff}` : diff})
                              </Text>
                            ) : null}
                          </View>

                          {isDiscrepant && batch.discrepancy_reason ? (
                            <View style={styles.discrepancyReasonBadge}>
                              <Text style={styles.discrepancyReasonText}>
                                Motivo: {batch.discrepancy_reason}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* ACCIONES BIFURCADAS */}
                        <View style={styles.batchActionsRow}>
                          {/* BOTÓN RÁPIDO DE CONFIRMACIÓN */}
                          <Pressable
                            onPress={() => handleConfirmBatch(product, batch)}
                            style={({ pressed }) => [
                              styles.confirmBatchBtn,
                              isConfirmed && styles.confirmBatchBtnActive,
                              pressed && { transform: [{ scale: 0.96 }] },
                            ]}
                          >
                            <Ionicons
                              color={isConfirmed ? '#04150F' : '#34D399'}
                              name="checkmark-circle"
                              size={20}
                            />
                            <Text
                              style={[
                                styles.confirmBatchBtnText,
                                isConfirmed && styles.confirmBatchBtnTextActive,
                              ]}
                            >
                              {isConfirmed
                                ? 'Confirmado'
                                : isScaleMode
                                ? `[ ⚖️ Peso Coincide ]`
                                : `[ ✔️ Conteo Coincide ]`}
                            </Text>
                          </Pressable>

                          {/* BOTÓN DE DESCUADRE SEGÚN LA NATURALEZA */}
                          {isScaleMode ? (
                            // MODO BÁSCULA: BOTÓN DE PESAR CON TARA
                            <Pressable
                              onPress={() => handleOpenWeighModal(product, batch)}
                              style={({ pressed }) => [
                                styles.discrepancyBtnScale,
                                isDiscrepant && styles.discrepancyBtnActive,
                                pressed && { transform: [{ scale: 0.96 }] },
                              ]}
                            >
                              <Ionicons
                                color={isDiscrepant ? '#F87171' : '#FBBF24'}
                                name="scale-outline"
                                size={18}
                              />
                              <Text
                                style={[
                                  styles.discrepancyBtnText,
                                  isDiscrepant && styles.discrepancyBtnTextActive,
                                ]}
                              >
                                {isDiscrepant ? 'Re-pesaje' : 'Pesar Báscula'}
                              </Text>
                            </Pressable>
                          ) : (
                            // MODO CONTEO: BOTÓN DE DIGITAR CAJAS/PACAS
                            <Pressable
                              onPress={() => handleOpenCountModal(product, batch)}
                              style={({ pressed }) => [
                                styles.discrepancyBtnCount,
                                isDiscrepant && styles.discrepancyBtnActive,
                                pressed && { transform: [{ scale: 0.96 }] },
                              ]}
                            >
                              <Ionicons
                                color={isDiscrepant ? '#F87171' : '#38BDF8'}
                                name="keypad-outline"
                                size={18}
                              />
                              <Text
                                style={[
                                  styles.discrepancyBtnText,
                                  isDiscrepant && styles.discrepancyBtnTextActive,
                                ]}
                              >
                                {isDiscrepant ? 'Corregir' : 'Digitar Cajas'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* PRODUCTOS NO LISTADOS / SOBRANTES */}
        {auditPlan?.unlisted_items && auditPlan.unlisted_items.length > 0 && (
          <View style={styles.unlistedSection}>
            <View style={styles.unlistedSectionHeader}>
              <Ionicons color="#38BDF8" name="cube-outline" size={20} />
              <Text style={styles.unlistedSectionTitle}>
                Productos Sobrantes en Pasillo ({auditPlan.unlisted_items.length})
              </Text>
            </View>

            {auditPlan.unlisted_items.map((item: UnlistedItem) => (
              <View key={item.id} style={styles.unlistedItemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlistedItemName}>{item.product_name}</Text>
                  <Text style={styles.unlistedItemSub}>
                    Lote: {item.batch_code} · {item.physical_quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.unlistedFoundBadge}>
                  <Text style={styles.unlistedFoundText}>SOBRANTE</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* BOTÓN SECUNDARIO: REGISTRAR PRODUCTO NO LISTADO */}
        <Pressable
          onPress={() => {
            setUnlistedUnit(isScaleMode ? 'kg' : 'Cajas');
            setShowUnlistedModal(true);
          }}
          style={styles.unlistedTriggerBtn}
        >
          <Ionicons color="#38BDF8" name="add-circle-outline" size={22} />
          <Text style={styles.unlistedTriggerBtnText}>
            [ + Registrar Producto No Listado / Sobrante ]
          </Text>
        </Pressable>

        {/* BOTÓN FINALIZAR AUDITORÍA */}
        <Pressable onPress={handleFinalizeZone} style={styles.finalizeZoneBtn}>
          <Ionicons color="#04150F" name="shield-checkmark" size={24} />
          <Text style={styles.finalizeZoneBtnText}>
            Finalizar y Consolidar Auditoría de Zona
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ==============================================================
          MODAL 1: LIBRETA DE PESAJE EN BÁSCULA CON TARA (MODO INSUMOS)
          ============================================================== */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowWeighModal(false)}
        transparent
        visible={showWeighModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.weighModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.weighModalTitle}>Libreta de Báscula (Pesaje)</Text>
                <Text style={styles.weighModalSub}>
                  {weighTarget?.productName} ({weighTarget?.batch.batch_code})
                </Text>
              </View>
              <Pressable onPress={() => setShowWeighModal(false)} style={styles.closeModalCircle}>
                <Ionicons color="#CBD5E1" name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.weighInputsRow}>
              {/* CAMPO 1: PESO BÁSCULA */}
              <Pressable
                onPress={() => setWeighActiveField('gross')}
                style={[
                  styles.weighBoxInput,
                  weighActiveField === 'gross' && styles.weighBoxInputActive,
                ]}
              >
                <Text style={styles.weighBoxLabel}>[ ⚖️ Peso Báscula (Bruto) ]</Text>
                <Text style={styles.weighBoxValue}>
                  {grossInput ? `${grossInput} ${weighTarget?.unit}` : '0.0'}
                </Text>
              </Pressable>

              {/* CAMPO 2: CANASTILLAS / TARA */}
              {weighTarget?.tareApplicable && (
                <Pressable
                  onPress={() => setWeighActiveField('crates')}
                  style={[
                    styles.weighBoxInput,
                    weighActiveField === 'crates' && styles.weighBoxInputActive,
                  ]}
                >
                  <Text style={styles.weighBoxLabel}>[ Canastillas Plásticas ]</Text>
                  <Text style={styles.weighBoxValue}>{cratesInput} can.</Text>
                </Pressable>
              )}
            </View>

            {/* CÁLCULO DE PESO NETO EN VIVO */}
            {(() => {
              const gross = parseFloat(grossInput) || 0;
              const crates = parseInt(cratesInput, 10) || 0;
              const tarePerCrate = weighTarget?.tareApplicable ? (weighTarget?.defaultTarePerCrate ?? 1.8) : 0;
              const totalTare = Math.round(crates * tarePerCrate * 10) / 10;
              const net = Math.max(0, Math.round((gross - totalTare) * 10) / 10);

              return (
                <View style={styles.netLiveBox}>
                  <View>
                    <Text style={styles.netLiveLabel}>PESO NETO CALCULADO</Text>
                    <Text style={styles.netLiveVal}>
                      {net.toFixed(1)} {weighTarget?.unit}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tareDeductionLive}>
                      Tara: -{totalTare.toFixed(1)} {weighTarget?.unit}
                    </Text>
                    <Text style={styles.expectedLive}>
                      Sistema: {weighTarget?.batch.expected_quantity} {weighTarget?.unit}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* TECLADO NUMÉRICO GIGANTE PARA EL CAMPO SELECCIONADO */}
            <CustomNumpad
              allowDecimal={weighActiveField === 'gross'}
              confirmColor="#10B981"
              confirmLabel="Confirmar Pesaje Neto"
              onCancel={() => setShowWeighModal(false)}
              onChange={(val) => {
                if (weighActiveField === 'gross') {
                  setGrossInput(val);
                } else {
                  setCratesInput(val);
                }
              }}
              onConfirm={handleConfirmWeighing}
              subtitle={
                weighActiveField === 'gross'
                  ? 'Captura el peso registrado en la báscula de piso'
                  : `Tara de ${weighTarget?.defaultTarePerCrate} kg por canastilla plástica`
              }
              title={
                weighActiveField === 'gross'
                  ? 'Peso Bruto en Báscula'
                  : 'Canastillas de Tara'
              }
              unit={weighActiveField === 'gross' ? weighTarget?.unit : 'canastillas'}
              value={weighActiveField === 'gross' ? grossInput : cratesInput}
            />
          </View>
        </View>
      </Modal>

      {/* ==============================================================
          MODAL 2: CHECKLIST DE CONTEO CERRADO (MODO PRODUCTO TERMINADO)
          ============================================================== */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowCountModal(false)}
        transparent
        visible={showCountModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <CustomNumpad
              allowDecimal={false}
              confirmColor="#38BDF8"
              confirmLabel="Confirmar Conteo de Cajas"
              onCancel={() => setShowCountModal(false)}
              onChange={(val) => setCountInput(val)}
              onConfirm={handleConfirmCounting}
              subtitle={`Sistema espera: ${countTarget?.batch.expected_quantity} ${countTarget?.unit}`}
              title={`Conteo: ${countTarget?.productName ?? ''}`}
              unit={countTarget?.unit ?? 'Cajas'}
              value={countInput}
            />
          </View>
        </View>
      </Modal>

      {/* ==============================================================
          MODAL 3: JUSTIFICACIONES RÁPIDAS DE DESCUADRE
          ============================================================== */}
      <Modal
        animationType="fade"
        onRequestClose={() => setShowJustificationModal(false)}
        transparent
        visible={showJustificationModal}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.justificationCard}>
            <View style={styles.justificationHeader}>
              <Ionicons color="#F87171" name="alert-circle" size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.justificationTitle}>Descuadre en Lote</Text>
                <Text style={styles.justificationSub}>
                  {pendingDiscrepancy?.productName} ({pendingDiscrepancy?.batchCode})
                </Text>
              </View>
            </View>

            <View style={styles.diffAlertBox}>
              <Text style={styles.diffAlertText}>
                Esperado: {pendingDiscrepancy?.expectedQty} {pendingDiscrepancy?.unit} → Físico: {pendingDiscrepancy?.physicalQty} {pendingDiscrepancy?.unit}
              </Text>
              <Text style={styles.diffAlertNumber}>
                Diferencia: {pendingDiscrepancy?.difference} {pendingDiscrepancy?.unit}
              </Text>
            </View>

            <Text style={styles.justificationPrompt}>
              Selecciona el motivo del descuadre para aprobación del supervisor:
            </Text>

            <View style={styles.justificationButtonsList}>
              <Pressable
                onPress={() => handleSaveDiscrepancyReason('FALTANTE')}
                style={({ pressed }) => [styles.justChoiceBtn, styles.justChoiceFaltante, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.justChoiceEmoji}>❓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.justChoiceTitle}>[ ❓ Faltante Inexplicable ]</Text>
                  <Text style={styles.justChoiceDesc}>Mercancía no encontrada en el inventario</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSaveDiscrepancyReason('AVERIA')}
                style={({ pressed }) => [styles.justChoiceBtn, styles.justChoiceAveria, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.justChoiceEmoji}>💥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.justChoiceTitle}>
                    {isScaleMode ? '[ 💥 Avería / Deshuese / Merma ]' : '[ 💥 Avería Física / Roto ]'}
                  </Text>
                  <Text style={styles.justChoiceDesc}>
                    {isScaleMode
                      ? 'Deshuese, merma por descongelación o daño en pieza'
                      : 'Caja rota, daño en empaque o latas abolladas'}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSaveDiscrepancyReason('VENCIDO')}
                style={({ pressed }) => [styles.justChoiceBtn, styles.justChoiceVencido, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.justChoiceEmoji}>🤢</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.justChoiceTitle}>
                    {isScaleMode ? '[ 🤢 Descomposición / Vencido ]' : '[ 🤢 Vencido / Mal Estado ]'}
                  </Text>
                  <Text style={styles.justChoiceDesc}>Fecha expirada o alteración organoléptica</Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setShowJustificationModal(false)}
              style={styles.closeJustModalBtn}
            >
              <Text style={styles.closeJustModalBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ==============================================================
          MODAL 4: REGISTRAR PRODUCTO NO LISTADO (SOBRANTE EXCLUSIVO)
          ============================================================== */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowUnlistedModal(false)}
        transparent
        visible={showUnlistedModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.unlistedModalSheet}>
            <View style={styles.unlistedModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unlistedModalTitle}>Registrar Producto No Listado</Text>
                <Text style={styles.unlistedModalSub}>
                  Sobrante en {auditPlan?.zone_name} ({isScaleMode ? 'Insumos' : 'Prod. Terminado'})
                </Text>
              </View>
              <Pressable onPress={() => setShowUnlistedModal(false)} style={styles.closeModalCircle}>
                <Ionicons color="#CBD5E1" name="close" size={20} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View style={styles.unlistedCameraBox}>
                {permission?.granted ? (
                  <CameraView
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr', 'ean13', 'code128', 'code39'],
                    }}
                    facing="back"
                    onBarcodeScanned={(res) => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {
                        // ignore
                      }
                      setUnlistedName('Producto Sobrante Escaneado');
                      setUnlistedBatch(res.data.slice(-8));
                    }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <View style={styles.unlistedCamFallback}>
                    <Ionicons color="#64748B" name="barcode-outline" size={36} />
                    <Text style={styles.unlistedCamFallbackText}>Lector de Sobrante</Text>
                    <Pressable onPress={requestPermission} style={styles.enableCamBtn}>
                      <Text style={styles.enableCamBtnText}>Activar Cámara</Text>
                    </Pressable>
                  </View>
                )}
                <Pressable
                  onPress={() => {
                    if (isScaleMode) {
                      setUnlistedName('Pechuga a Granel (Canastilla Extraviada)');
                      setUnlistedBatch('LOT-SOBR-01');
                      setUnlistedQty('24.5');
                    } else {
                      setUnlistedName('Salchichón Cervecero (Caja Suelta)');
                      setUnlistedBatch('LOT-SOBR-02');
                      setUnlistedQty('5');
                    }
                  }}
                  style={styles.unlistedSimBtn}
                >
                  <Text style={styles.unlistedSimBtnText}>Autollenar de Prueba</Text>
                </Pressable>
              </View>

              <View style={styles.unlistedFieldsBox}>
                <View style={styles.unlistedInputRow}>
                  <Text style={styles.unlistedInputLabel}>Nombre del Producto:</Text>
                  <Pressable
                    onPress={() => {
                      if (typeof Alert.prompt === 'function') {
                        Alert.prompt('Nombre del Producto', 'Ej. Pernil de Cerdo', (val) =>
                          setUnlistedName(val)
                        );
                      } else {
                        setUnlistedName(isScaleMode ? 'Pechuga a Granel' : 'Salchichón Caja');
                      }
                    }}
                    style={styles.unlistedInputPressable}
                  >
                    <Text style={styles.unlistedInputText}>
                      {unlistedName || 'Toca para ingresar nombre'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.unlistedInputRow}>
                  <Text style={styles.unlistedInputLabel}>Lote en la Caja/Canastilla:</Text>
                  <Pressable
                    onPress={() => {
                      if (typeof Alert.prompt === 'function') {
                        Alert.prompt('Número de Lote', 'Ej. LOTE-2026-99', (val) =>
                          setUnlistedBatch(val)
                        );
                      } else {
                        setUnlistedBatch('LOTE-SOBR-01');
                      }
                    }}
                    style={styles.unlistedInputPressable}
                  >
                    <Text style={styles.unlistedInputText}>
                      {unlistedBatch || 'Toca para ingresar lote'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.unlistedInputRow}>
                  <Text style={styles.unlistedInputLabel}>
                    {isScaleMode ? 'Peso Neto en Báscula (kg):' : 'Cantidad Cerrada (Cajas/Pacas):'}
                  </Text>
                  <Pressable
                    onPress={() => setUnlistedActiveField('qty')}
                    style={[styles.unlistedInputPressable, { borderColor: '#38BDF8' }]}
                  >
                    <Text style={[styles.unlistedInputText, { color: '#38BDF8', fontWeight: '800' }]}>
                      {unlistedQty ? `${unlistedQty} ${unlistedUnit}` : 'Tocar para abrir Teclado'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {unlistedActiveField === 'qty' && (
                <CustomNumpad
                  allowDecimal={isScaleMode}
                  confirmColor="#38BDF8"
                  confirmLabel="Fijar Cantidad"
                  onCancel={() => setUnlistedActiveField(null)}
                  onChange={(val) => setUnlistedQty(val)}
                  onConfirm={() => setUnlistedActiveField(null)}
                  title={isScaleMode ? 'Peso Neto del Sobrante' : 'Cajas / Pacas del Sobrante'}
                  unit={unlistedUnit}
                  value={unlistedQty}
                />
              )}

              <Pressable onPress={handleSaveUnlisted} style={styles.saveUnlistedBtn}>
                <Ionicons color="#04150F" name="save" size={20} />
                <Text style={styles.saveUnlistedBtnText}>Registrar como Sobrante en Pasillo</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  center: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  natureModeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  natureBadgeScale: {
    backgroundColor: '#064E3B',
  },
  natureBadgeCount: {
    backgroundColor: '#0C4A6E',
  },
  natureModeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  natureBadgeScaleText: {
    color: '#A7F3D0',
  },
  natureBadgeCountText: {
    color: '#BAE6FD',
  },
  zoneSelectorContainer: {
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  zonePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  zonePillActiveScale: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  zonePillActiveCount: {
    backgroundColor: '#0C4A6E',
    borderColor: '#38BDF8',
  },
  zonePillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  zonePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  statusBar: {
    backgroundColor: '#111827',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 6,
  },
  statusBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusProgressText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  countersRow: {
    flexDirection: 'row',
    gap: 6,
  },
  counterChipGreen: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  counterChipGreenText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  counterChipRed: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  counterChipRedText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  scroll: {
    padding: spacing.md,
    gap: 14,
  },
  modeNoticeBanner: {
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  modeNoticeScale: {
    backgroundColor: '#022C22',
    borderColor: '#059669',
  },
  modeNoticeCount: {
    backgroundColor: '#082F49',
    borderColor: '#0284C7',
  },
  modeNoticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modeNoticeDesc: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  productMasterCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  productMasterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#0F172A',
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
  },
  skuBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  skuBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  locationLabel: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  masterStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  masterExpectedText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  badgeSuccess: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeSuccessText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeWarning: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeWarningText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
  },
  expandChevronBox: {
    paddingLeft: 8,
  },
  batchesDetailContainer: {
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: spacing.md,
    gap: 10,
  },
  batchesDetailTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  batchRowCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  batchRowConfirmed: {
    borderColor: '#059669',
    backgroundColor: '#022C22',
  },
  batchRowDiscrepant: {
    borderColor: '#DC2626',
    backgroundColor: '#2A0808',
  },
  batchInfoCol: {
    gap: 4,
  },
  batchCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchCodeText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  batchExpiryText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  quantitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchExpectedQty: {
    color: '#94A3B8',
    fontSize: 13,
  },
  batchPhysicalDiff: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '800',
  },
  discrepancyReasonBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  discrepancyReasonText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  batchActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  confirmBatchBtn: {
    flex: 2,
    height: 48,
    backgroundColor: '#064E3B',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#059669',
  },
  confirmBatchBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
  },
  confirmBatchBtnText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmBatchBtnTextActive: {
    color: '#04150F',
    fontWeight: '900',
  },
  discrepancyBtnScale: {
    flex: 1.5,
    height: 48,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  discrepancyBtnCount: {
    flex: 1.5,
    height: 48,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  discrepancyBtnActive: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  discrepancyBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  discrepancyBtnTextActive: {
    color: '#F87171',
  },
  unlistedSection: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  unlistedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 6,
  },
  unlistedSectionTitle: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
  unlistedItemCard: {
    backgroundColor: '#020617',
    borderRadius: radius.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlistedItemName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  unlistedItemSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  unlistedFoundBadge: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  unlistedFoundText: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '800',
  },
  unlistedTriggerBtn: {
    height: 52,
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlistedTriggerBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
  finalizeZoneBtn: {
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    elevation: 4,
  },
  finalizeZoneBtnText: {
    color: '#04150F',
    fontSize: 16,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: spacing.md,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  weighModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weighModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  weighModalSub: {
    color: '#94A3B8',
    fontSize: 13,
  },
  weighInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  weighBoxInput: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  weighBoxInputActive: {
    borderColor: '#10B981',
    backgroundColor: '#062018',
  },
  weighBoxLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  weighBoxValue: {
    color: '#34D399',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  netLiveBox: {
    backgroundColor: '#022C22',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  netLiveLabel: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '900',
  },
  netLiveVal: {
    color: '#34D399',
    fontSize: 24,
    fontWeight: '900',
  },
  tareDeductionLive: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
  },
  expectedLive: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  justificationCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  justificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  justificationTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  justificationSub: {
    color: '#94A3B8',
    fontSize: 13,
  },
  diffAlertBox: {
    backgroundColor: '#450A0A',
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  diffAlertText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  diffAlertNumber: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '900',
  },
  justificationPrompt: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  justificationButtonsList: {
    gap: 10,
  },
  justChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: 10,
  },
  justChoiceFaltante: {
    backgroundColor: '#431407',
    borderColor: '#EA580C',
  },
  justChoiceAveria: {
    backgroundColor: '#1E1B4B',
    borderColor: '#6366F1',
  },
  justChoiceVencido: {
    backgroundColor: '#14532D',
    borderColor: '#22C55E',
  },
  justChoiceEmoji: {
    fontSize: 24,
  },
  justChoiceTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  justChoiceDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  closeJustModalBtn: {
    height: 48,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  closeJustModalBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  unlistedModalSheet: {
    maxHeight: '85%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
  },
  unlistedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  unlistedModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  unlistedModalSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeModalCircle: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: radius.pill,
  },
  unlistedCameraBox: {
    height: 140,
    backgroundColor: '#020617',
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  unlistedCamFallback: {
    alignItems: 'center',
  },
  unlistedCamFallbackText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  enableCamBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  enableCamBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  unlistedSimBtn: {
    position: 'absolute',
    bottom: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  unlistedSimBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  unlistedFieldsBox: {
    backgroundColor: '#020617',
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  unlistedInputRow: {
    gap: 4,
  },
  unlistedInputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  unlistedInputPressable: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radius.sm,
    padding: 10,
  },
  unlistedInputText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  saveUnlistedBtn: {
    height: 52,
    backgroundColor: '#38BDF8',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  saveUnlistedBtnText: {
    color: '#04150F',
    fontSize: 15,
    fontWeight: '900',
  },
});
