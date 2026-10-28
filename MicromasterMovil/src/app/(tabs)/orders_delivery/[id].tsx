import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SignaturePadModal } from '@/components/SignaturePadModal';
import { StatusPill } from '@/components/StatusPill';
import { colors, radius, spacing } from '@/constants/theme';
import { offlineService } from '@/services/offline.service';
import type { DeliveryOrder, DeliveryOrderItem } from '@/types/models';
import { formatMoney, statusTone, toNumber } from '@/utils/format';

type ActivePayment = 'cash' | 'transfer' | 'credit';
type DeliveryStep = 'unload' | 'payment';

interface PaymentOption {
  key: ActivePayment;
  title: string;
  badge: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    key: 'cash',
    title: 'Pago en Efectivo',
    badge: 'Calculadora',
    description: 'Billetes, cambio en vivo y arqueo de bolsillo',
    icon: 'cash',
    color: '#10B981',
  },
  {
    key: 'transfer',
    title: 'Transferencia (Nequi / Bancos)',
    badge: 'Foto Offline',
    description: 'Foto a pantalla de comprobante (Cero digitación)',
    icon: 'phone-portrait',
    color: '#38BDF8',
  },
  {
    key: 'credit',
    title: 'Crédito Aprobado',
    badge: 'Firma Digital',
    description: 'Firma táctil de deuda y entrega conforme',
    icon: 'card',
    color: '#A855F7',
  },
];

const NOVELTY_REASONS = [
  'Empaque roto / abollado',
  'Avería / Derrame físico',
  'Vencido / Mal estado',
  'No solicitado por cliente',
  'Faltante en camión',
];

const REJECTION_REASONS = [
  'Cliente canceló el pedido',
  'No tiene dinero para pagar',
  'Negocio cerrado',
  'Rechazo total por calidad',
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [items, setItems] = useState<DeliveryOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fases del flujo: 1. Manifiesto de descargue | 2. Cobro & POD
  const [currentStep, setCurrentStep] = useState<DeliveryStep>('unload');

  // Método de Pago y Menú Desplegable
  const [paymentMethod, setPaymentMethod] = useState<ActivePayment>('cash');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [receivedString, setReceivedString] = useState<string>('');

  // Evidencias Offline: Foto Comprobante de Transferencia, Foto Mercancía y Firma Digital
  const [transferReceiptUri, setTransferReceiptUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);

  // Modal de Devolución Parcial por Ítem
  const [itemNoveltyVisible, setItemNoveltyVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DeliveryOrderItem | null>(null);
  const [rejectedQuantity, setRejectedQuantity] = useState(1);
  const [selectedReason, setSelectedReason] = useState(NOVELTY_REASONS[0]);

  // Modal de Rechazo Total del Pedido
  const [rejectionVisible, setRejectionVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);

  const [processing, setProcessing] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const found = await offlineService.getOrderById(id);
      if (found) {
        setOrder(found);
        const orderItems = found.items ?? [];
        setItems(orderItems);

        // Si ya fue entregado, ir directo a vista de cobro/remisión
        if (found.status === 'delivered') {
          setCurrentStep('payment');
        }

        // Cargar método de pago guardado
        if (found.payment_method === 'qr') {
          setPaymentMethod('transfer');
        } else if (found.payment_method === 'cash') {
          setPaymentMethod('cash');
        }

        // Calcular total a cobrar inicial
        const initialTotal = calculateRecalculatedTotal(found, orderItems);
        setReceivedString(String(initialTotal));
        if (found.pod_photo_uri) setPhotoUri(found.pod_photo_uri);
        if (found.transfer_receipt_uri) setTransferReceiptUri(found.transfer_receipt_uri);
        if (found.signature_captured) setSignatureData('firmado');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // CÁLCULO DE TOTALES RECALCULADOS POR NOVEDADES EN SITIO
  const calculateRecalculatedTotal = (ord: DeliveryOrder | null, itemList: DeliveryOrderItem[]): number => {
    const orig = toNumber(ord?.original_amount ?? ord?.amount ?? 0);
    if (!itemList || itemList.length === 0) return orig;

    const discount = itemList.reduce((sum, it) => {
      const rejected = it.rejected_quantity || 0;
      const unitPr = it.unit_price || 0;
      return sum + rejected * unitPr;
    }, 0);

    return Math.max(0, orig - discount);
  };

  const originalTotal = toNumber(order?.original_amount ?? order?.amount ?? 0);
  const recalculatedTotal = calculateRecalculatedTotal(order, items);
  const totalDiscount = Math.max(0, originalTotal - recalculatedTotal);
  const receivedAmount = Number(receivedString || 0);
  const changeDue = receivedAmount - recalculatedTotal;

  // Actualizar el valor inicial del teclado cuando cambia el total recalculado
  const handleUpdateItems = (nextItems: DeliveryOrderItem[]) => {
    setItems(nextItems);
    const newTotal = calculateRecalculatedTotal(order, nextItems);
    setReceivedString(String(newTotal));
  };

  // CHECKLIST: CONFIRMAR ÍTEM CONFORME
  const handleConfirmItem = (itemId: number | string) => {
    const next = items.map((it) => {
      if (String(it.id) === String(itemId)) {
        return {
          ...it,
          confirmed: true,
          rejected_quantity: 0,
          rejection_reason: undefined,
        };
      }
      return it;
    });
    handleUpdateItems(next);
  };

  // CHECKLIST: MARCAR TODO EL CAMIÓN CONFORME (ATAJO RÁPIDO)
  const handleConfirmAll = () => {
    const next = items.map((it) => ({
      ...it,
      confirmed: true,
      rejected_quantity: 0,
      rejection_reason: undefined,
    }));
    handleUpdateItems(next);
  };

  // CHECKLIST: ABRIR MODAL DE DEVOLUCIÓN PARCIAL
  const handleOpenNoveltyModal = (item: DeliveryOrderItem) => {
    setSelectedItem(item);
    setRejectedQuantity(item.rejected_quantity && item.rejected_quantity > 0 ? item.rejected_quantity : 1);
    setSelectedReason(item.rejection_reason ?? NOVELTY_REASONS[0]);
    setItemNoveltyVisible(true);
  };

  // GUARDAR DEVOLUCIÓN PARCIAL
  const handleSaveItemNovelty = () => {
    if (!selectedItem) return;
    const maxQty = selectedItem.quantity || 1;
    const qty = Math.min(Math.max(1, rejectedQuantity), maxQty);

    const next = items.map((it) => {
      if (String(it.id) === String(selectedItem.id)) {
        return {
          ...it,
          confirmed: true,
          rejected_quantity: qty,
          rejection_reason: selectedReason,
        };
      }
      return it;
    });

    handleUpdateItems(next);
    setItemNoveltyVisible(false);
    setSelectedItem(null);
  };

  // QUITAR NOVEDAD / DEVOLUCIÓN
  const handleRemoveNovelty = (itemId: number | string) => {
    const next = items.map((it) => {
      if (String(it.id) === String(itemId)) {
        return {
          ...it,
          confirmed: true,
          rejected_quantity: 0,
          rejection_reason: undefined,
        };
      }
      return it;
    });
    handleUpdateItems(next);
  };

  // TECLADO NUMÉRICO TÁCTIL (EFECTIVO)
  const handleKeypadPress = (key: string) => {
    if (key === 'C') {
      setReceivedString('');
      return;
    }
    if (key === 'DEL') {
      setReceivedString((prev) => prev.slice(0, -1));
      return;
    }
    if (receivedString.length >= 10) return;
    setReceivedString((prev) => (prev === '0' ? key : prev + key));
  };

  const addQuickAmount = (val: number) => {
    const current = Number(receivedString || 0);
    setReceivedString(String(current + val));
  };

  const setExactAmount = () => {
    setReceivedString(String(recalculatedTotal));
  };

  // NAVEGACIÓN EXTERNA (WAZE / GOOGLE MAPS)
  const openNavigationApp = () => {
    const lat = order?.latitude ?? 6.2088;
    const lng = order?.longitude ?? -75.5658;
    const query = encodeURIComponent(order?.destination ?? order?.client_name ?? '');

    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const mapsUrl =
      Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${query})`;

    Linking.canOpenURL(wazeUrl)
      .then((supported) => {
        if (supported) return Linking.openURL(wazeUrl);
        return Linking.openURL(mapsUrl);
      })
      .catch(() => {
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        ).catch(() => undefined);
      });
  };

  // FOTO AL COMPROBANTE DE TRANSFERENCIA (PANTALLA DEL CLIENTE / RECIBO FÍSICO)
  const takeTransferReceiptPhoto = async () => {
    setTakingPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso de cámara necesario',
          'Se requiere acceso a la cámara para fotografiar la pantalla del comprobante de transferencia.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.3,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setTransferReceiptUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    } finally {
      setTakingPhoto(false);
    }
  };

  // FOTO DE MERCANCÍA / FACHADA (COMPRIMIDA < 500 KB)
  const takePodPhoto = async () => {
    setTakingPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso de cámara necesario',
          'Se requiere acceso a la cámara para fotografiar las cajas en el local o fachada.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.3,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    } finally {
      setTakingPhoto(false);
    }
  };

  // CONFIRMAR ENTREGA FINAL (ENTREGADO COMPLETO O PARCIAL)
  const handleDeliveredComplete = async () => {
    if (!order) return;

    // Validación Transferencia: Foto de comprobante obligatoria
    if (paymentMethod === 'transfer' && !transferReceiptUri) {
      Alert.alert(
        'Foto del Comprobante Requerida',
        'Pídele al cliente que muestre la transferencia exitosa en su celular y toma la foto antes de cerrar la entrega.',
        [
          { text: 'Tomar Foto Ahora', onPress: takeTransferReceiptPhoto },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
      return;
    }

    // Validación Crédito: Firma digital obligatoria
    if (paymentMethod === 'credit' && !signatureData) {
      Alert.alert(
        'Firma Digital Requerida',
        'El cliente debe firmar digitalmente en la pantalla aceptando la entrega a crédito.',
        [
          { text: 'Firmar Ahora', onPress: () => setSignatureModalVisible(true) },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
      return;
    }

    setProcessing(true);
    const hasAnyReturns = items.some((it) => (it.rejected_quantity ?? 0) > 0);

    try {
      // 1. Si el pago es en efectivo, sumar al Arqueo de Bolsillo el total recalculado
      if (paymentMethod === 'cash') {
        await offlineService.addCash(
          receivedAmount > 0 ? recalculatedTotal : 0,
          order.id,
          order.client_name ?? `Pedido #${order.id}`,
        );
      }

      // 2. Actualizar estado local inmediatamente (Offline-First en AsyncStorage)
      await offlineService.updateLocalOrder(order.id, {
        status: 'delivered',
        status_label: hasAnyReturns ? 'Entrega Parcial' : 'Entregado',
        payment_method: paymentMethod === 'transfer' ? 'qr' : 'cash',
        payment_status: 'completed',
        payment_status_label:
          paymentMethod === 'cash'
            ? 'Cobrado en Efectivo'
            : paymentMethod === 'transfer'
              ? 'Transferencia (Por Conciliar)'
              : 'Crédito Autorizado',
        amount: recalculatedTotal,
        original_amount: originalTotal,
        adjusted_amount: recalculatedTotal,
        received_amount: paymentMethod === 'cash' ? receivedAmount : recalculatedTotal,
        change_due: paymentMethod === 'cash' && changeDue > 0 ? changeDue : 0,
        pod_photo_uri: photoUri,
        transfer_receipt_uri: transferReceiptUri,
        signature_captured: !!signatureData,
        items,
      });

      // 3. Encolar acción en Outbox para sincronización silenciosa con la oficina
      await offlineService.enqueueAction(
        'COMPLETE_DELIVERY',
        {
          orderId: order.id,
          paymentMethod,
          originalAmount: originalTotal,
          recalculatedAmount: recalculatedTotal,
          hasReturns: hasAnyReturns,
          receivedAmount: paymentMethod === 'cash' ? receivedAmount : recalculatedTotal,
          changeDue: paymentMethod === 'cash' && changeDue > 0 ? changeDue : 0,
          photoUri,
          transferReceiptUri,
          hasSignature: !!signatureData,
          items,
          deliveredAt: new Date().toISOString(),
        },
        order.id,
      );

      const summaryText =
        paymentMethod === 'cash'
          ? `Pedido registrado exitosamente.\nEfectivo sumado al Arqueo: ${formatMoney(recalculatedTotal)}${
              changeDue > 0 ? `\nCambio entregado: ${formatMoney(changeDue)}` : ''
            }`
          : paymentMethod === 'transfer'
            ? `Transferencia registrada por ${formatMoney(recalculatedTotal)}.\nComprobante guardado offline para conciliación en la web.`
            : `Despacho a crédito registrado por ${formatMoney(recalculatedTotal)} con firma digital aceptada.`;

      Alert.alert(
        '¡Entrega Registrada!',
        summaryText,
        [{ text: 'Continuar a Ruta', onPress: () => router.back() }],
      );
    } finally {
      setProcessing(false);
    }
  };

  // CONFIRMAR RECHAZO TOTAL DEL PEDIDO
  const handleConfirmRejection = async () => {
    if (!order) return;
    setRejectionVisible(false);
    setProcessing(true);

    try {
      await offlineService.updateLocalOrder(order.id, {
        status: 'cancelled',
        status_label: 'Rechazo Total',
        pod_photo_uri: photoUri,
      });

      await offlineService.enqueueAction(
        'REJECT_DELIVERY',
        {
          orderId: order.id,
          reason: rejectionReason,
          photoUri,
        },
        order.id,
      );

      Alert.alert(
        'Pedido Rechazado Totalmente',
        `El pedido #${order.id} fue marcado como no entregado por: ${rejectionReason}. Mercancía retornará al camión.`,
        [{ text: 'Volver a Ruta', onPress: () => router.back() }],
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader back title="Detalle de Entrega" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Cargando pedido…</Text>
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader back title="Detalle de Entrega" />
        <Card>
          <Text style={styles.errorText}>Pedido no encontrado.</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Volver a la Ruta</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  const isAlreadyDelivered = order.status === 'delivered';
  const allItemsChecked = items.length > 0 && items.every((it) => it.confirmed);
  const selectedOption = PAYMENT_OPTIONS.find((p) => p.key === paymentMethod) ?? PAYMENT_OPTIONS[0];

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        back
        subtitle={order.route?.route_code ?? 'Ruta del Día'}
        title="Entrega al Cliente"
      />

      {/* BARRA DE PROGRESO DE FASES (PASO 1: DESCARGUE ➔ PASO 2: COBRO & POD) */}
      <View style={styles.stepsHeader}>
        <Pressable
          onPress={() => setCurrentStep('unload')}
          style={[styles.stepTab, currentStep === 'unload' && styles.stepTabActive]}
        >
          <View style={[styles.stepBadge, currentStep === 'unload' && styles.stepBadgeActive]}>
            <Text style={styles.stepBadgeText}>1</Text>
          </View>
          <Text style={[styles.stepLabel, currentStep === 'unload' && styles.stepLabelActive]}>
            Descargue Físico
          </Text>
        </Pressable>

        <View style={styles.stepArrow}>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
        </View>

        <Pressable
          onPress={() => setCurrentStep('payment')}
          style={[styles.stepTab, currentStep === 'payment' && styles.stepTabActive]}
        >
          <View style={[styles.stepBadge, currentStep === 'payment' && styles.stepBadgeActive]}>
            <Text style={styles.stepBadgeText}>2</Text>
          </View>
          <Text style={[styles.stepLabel, currentStep === 'payment' && styles.stepLabelActive]}>
            Cobro & Cierre
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* CABECERA DEL CLIENTE (DIRECCIÓN + WAZE) */}
        <View style={styles.clientCard}>
          <View style={styles.clientTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientTitle}>
                {order.client_name ?? `Pedido #${order.id}`}
              </Text>
              <Text style={styles.orderNumber}>Orden #{order.id}</Text>
            </View>
            <StatusPill
              label={order.status_label ?? order.status ?? 'Pendiente'}
              tone={statusTone(order.status)}
            />
          </View>

          <View style={styles.addressBox}>
            <View style={styles.addressTextCol}>
              <Text style={styles.addressLabel}>DIRECCIÓN DE ENTREGA</Text>
              <Text style={styles.addressText}>
                {order.destination ?? 'Dirección sin especificar'}
              </Text>
            </View>
            <Pressable onPress={openNavigationApp} style={styles.wazeButton}>
              <Ionicons color="#FFFFFF" name="navigate" size={18} />
              <Text style={styles.wazeButtonText}>Waze</Text>
            </Pressable>
          </View>

          {/* MONTO A COBRAR EN TIEMPO REAL */}
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>
                {totalDiscount > 0 ? 'MONTO CON DEVOLUCIÓN:' : 'TOTAL A COBRAR:'}
              </Text>
              {totalDiscount > 0 ? (
                <Text style={styles.originalAmountCrossed}>
                  Original: {formatMoney(originalTotal)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.totalAmount}>{formatMoney(recalculatedTotal)}</Text>
          </View>
        </View>

        {/* ===================================================================
            PASO 1: MANIFIESTO DE DESCARGUE (CHECKLIST VISUAL)
            =================================================================== */}
        {currentStep === 'unload' ? (
          <View style={styles.section}>
            <View style={styles.manifestHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.manifestTitle}>📦 MANIFIESTO DE DESCARGUE</Text>
                <Text style={styles.manifestSubtitle}>
                  Baja y cuenta la mercancía física junto al cliente:
                </Text>
              </View>
              <Pressable onPress={handleConfirmAll} style={styles.checkAllButton}>
                <Ionicons color="#10B981" name="checkmark-done" size={16} />
                <Text style={styles.checkAllText}>Todo Conforme</Text>
              </Pressable>
            </View>

            {/* LISTA DE ÍTEMS DEL PEDIDO */}
            <View style={styles.itemsList}>
              {items.map((item, index) => {
                const hasReturn = (item.rejected_quantity ?? 0) > 0;
                const deliveredQty = (item.quantity || 1) - (item.rejected_quantity || 0);

                return (
                  <View
                    key={String(item.id ?? index)}
                    style={[
                      styles.itemCard,
                      item.confirmed && !hasReturn && styles.itemCardConfirmed,
                      hasReturn && styles.itemCardHasReturn,
                    ]}
                  >
                    <View style={styles.itemTopRow}>
                      {/* CANTIDAD GIGANTE */}
                      <View
                        style={[
                          styles.qtyBox,
                          hasReturn ? styles.qtyBoxReturn : item.confirmed ? styles.qtyBoxConfirmed : null,
                        ]}
                      >
                        <Text style={styles.qtyNumber}>{item.quantity}</Text>
                        <Text style={styles.qtyUnit}>{item.unit}</Text>
                      </View>

                      {/* DETALLE DEL PRODUCTO */}
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPriceSub}>
                          {formatMoney(item.unit_price)} c/u • Subtotal: {formatMoney(item.total_price)}
                        </Text>
                      </View>
                    </View>

                    {/* ESTADO DEL ÍTEM */}
                    {hasReturn ? (
                      <View style={styles.noveltyAlertBanner}>
                        <Ionicons color="#F59E0B" name="alert-circle" size={16} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.noveltyAlertTitle}>
                            Devolución parcial: {item.rejected_quantity} {item.unit} rechazada(s)
                          </Text>
                          <Text style={styles.noveltyAlertReason}>
                            Motivo: {item.rejection_reason} • Descuento: -{formatMoney((item.rejected_quantity || 0) * (item.unit_price || 0))}
                          </Text>
                          <Text style={styles.noveltyAlertDelivered}>
                            Se entregan al cliente: {deliveredQty} {item.unit}
                          </Text>
                        </View>
                      </View>
                    ) : item.confirmed ? (
                      <View style={styles.confirmedBanner}>
                        <Ionicons color="#10B981" name="checkmark-circle" size={16} />
                        <Text style={styles.confirmedBannerText}>
                          {item.quantity} {item.unit} verificadas y descargadas conformes
                        </Text>
                      </View>
                    ) : null}

                    {/* BOTONES DE ACCIÓN POR ÍTEM */}
                    <View style={styles.itemActionsRow}>
                      <Pressable
                        onPress={() => handleConfirmItem(item.id)}
                        style={[
                          styles.btnItemConfirm,
                          item.confirmed && !hasReturn && styles.btnItemConfirmActive,
                        ]}
                      >
                        <Ionicons
                          color={item.confirmed && !hasReturn ? '#FFFFFF' : '#10B981'}
                          name="checkmark"
                          size={18}
                        />
                        <Text
                          style={[
                            styles.btnItemConfirmText,
                            item.confirmed && !hasReturn && styles.btnItemConfirmTextActive,
                          ]}
                        >
                          Conforme
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleOpenNoveltyModal(item)}
                        style={[
                          styles.btnItemNovelty,
                          hasReturn && styles.btnItemNoveltyActive,
                        ]}
                      >
                        <Ionicons
                          color={hasReturn ? '#FFFFFF' : '#F59E0B'}
                          name="alert-circle-outline"
                          size={18}
                        />
                        <Text
                          style={[
                            styles.btnItemNoveltyText,
                            hasReturn && styles.btnItemNoveltyTextActive,
                          ]}
                        >
                          {hasReturn ? 'Editar Devolución' : 'Novedad / Devolución'}
                        </Text>
                      </Pressable>

                      {hasReturn ? (
                        <Pressable
                          onPress={() => handleRemoveNovelty(item.id)}
                          style={styles.btnItemUndo}
                        >
                          <Ionicons color={colors.textMuted} name="close" size={18} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* RESUMEN FINANCIERO DEL DESCARGUE */}
            <View style={styles.manifestSummaryBox}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Total original del pedido:</Text>
                <Text style={styles.summaryValue}>{formatMoney(originalTotal)}</Text>
              </View>
              {totalDiscount > 0 ? (
                <View style={styles.summaryLine}>
                  <Text style={[styles.summaryLabel, { color: colors.warning }]}>
                    Descuento por devoluciones en sitio:
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.warning }]}>
                    - {formatMoney(totalDiscount)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.summaryLine, styles.summaryTotalLine]}>
                <Text style={styles.summaryTotalLabel}>TOTAL A COBRAR AJUSTADO:</Text>
                <Text style={styles.summaryTotalValue}>{formatMoney(recalculatedTotal)}</Text>
              </View>
            </View>

            {/* BOTÓN GIGANTE PARA AVANZAR AL COBRO */}
            <Pressable
              onPress={() => setCurrentStep('payment')}
              style={styles.proceedToPaymentBtn}
            >
              <Text style={styles.proceedToPaymentBtnText}>
                {allItemsChecked ? 'Continuar al Cobro' : 'Confirmar Descargue y Cobrar'} ({formatMoney(recalculatedTotal)}) ➔
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ===================================================================
            PASO 2: COBRO & ADAPTACIÓN OFFLINE SEGÚN MÉTODO DE PAGO
            =================================================================== */}
        {currentStep === 'payment' ? (
          <View style={styles.section}>
            {/* BOTÓN VOLVER AL MANIFIESTO */}
            <Pressable
              onPress={() => setCurrentStep('unload')}
              style={styles.backToManifestBtn}
            >
              <Ionicons color={colors.primary} name="arrow-back" size={16} />
              <Text style={styles.backToManifestText}>
                Volver a Lista de Descargue (Revisar productos)
              </Text>
            </Pressable>

            {/* 1. SELECTOR DESPLEGABLE LIMPIO (EVITA TEXTO CORTADO) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MÉTODO DE PAGO</Text>
              <Pressable
                onPress={() => setDropdownOpen((prev) => !prev)}
                style={[
                  styles.dropdownButton,
                  dropdownOpen && styles.dropdownButtonActive,
                ]}
              >
                <View style={styles.dropdownSelectedLeft}>
                  <View
                    style={[
                      styles.dropdownIconCircle,
                      { backgroundColor: selectedOption.color },
                    ]}
                  >
                    <Ionicons color="#FFFFFF" name={selectedOption.icon} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.dropdownTitleRow}>
                      <Text style={styles.dropdownSelectedTitle}>
                        {selectedOption.title}
                      </Text>
                      <View style={[styles.badgeTag, { borderColor: selectedOption.color }]}>
                        <Text style={[styles.badgeTagText, { color: selectedOption.color }]}>
                          {selectedOption.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dropdownSelectedDesc} numberOfLines={1}>
                      {selectedOption.description}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  color={colors.textMuted}
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>

              {/* LISTA DESPLEGABLE */}
              {dropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  {PAYMENT_OPTIONS.map((opt) => {
                    const isSelected = paymentMethod === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => {
                          setPaymentMethod(opt.key);
                          setDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.dropdownItemIcon,
                            { backgroundColor: opt.color },
                          ]}
                        >
                          <Ionicons color="#FFFFFF" name={opt.icon} size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.dropdownItemTitle,
                              isSelected && { color: opt.color },
                            ]}
                          >
                            {opt.title}
                          </Text>
                          <Text style={styles.dropdownItemDesc}>
                            {opt.description}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Ionicons color="#10B981" name="checkmark-circle" size={20} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* ===============================================================
                VISTA DINÁMICA A: EFECTIVO -> CALCULADORA DE BILLETES Y DEVUELTA
                =============================================================== */}
            {paymentMethod === 'cash' ? (
              <View style={styles.keypadSection}>
                <View style={styles.receivedDisplayBox}>
                  <Text style={styles.receivedDisplayLabel}>DINERO RECIBIDO EN EFECTIVO:</Text>
                  <Text style={styles.receivedDisplayText}>
                    {receivedString ? formatMoney(receivedAmount) : '$ 0'}
                  </Text>

                  {/* Cálculo en vivo de cambio / devuelta */}
                  <View
                    style={[
                      styles.changeBadge,
                      changeDue >= 0 ? styles.changeBadgeOk : styles.changeBadgeMissing,
                    ]}
                  >
                    <Ionicons
                      color={changeDue >= 0 ? '#10B981' : '#F59E0B'}
                      name={changeDue >= 0 ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                    />
                    <Text style={styles.changeBadgeText}>
                      {changeDue >= 0
                        ? `Cambio a devolver: ${formatMoney(changeDue)}`
                        : `Faltan: ${formatMoney(Math.abs(changeDue))}`}
                    </Text>
                  </View>
                </View>

                {/* Atajos Rápidos de Billetes */}
                <View style={styles.quickShortcutsRow}>
                  <Pressable onPress={setExactAmount} style={styles.shortcutBtnPrimary}>
                    <Text style={styles.shortcutBtnTextPrimary}>⚡ Pago Exacto</Text>
                  </Pressable>
                  <Pressable onPress={() => addQuickAmount(10000)} style={styles.shortcutBtn}>
                    <Text style={styles.shortcutBtnText}>+$10k</Text>
                  </Pressable>
                  <Pressable onPress={() => addQuickAmount(20000)} style={styles.shortcutBtn}>
                    <Text style={styles.shortcutBtnText}>+$20k</Text>
                  </Pressable>
                  <Pressable onPress={() => addQuickAmount(50000)} style={styles.shortcutBtn}>
                    <Text style={styles.shortcutBtnText}>+$50k</Text>
                  </Pressable>
                  <Pressable onPress={() => addQuickAmount(100000)} style={styles.shortcutBtn}>
                    <Text style={styles.shortcutBtnText}>+$100k</Text>
                  </Pressable>
                </View>

                {/* Teclado numérico táctil grande */}
                <View style={styles.keypadGrid}>
                  {[
                    ['1', '2', '3'],
                    ['4', '5', '6'],
                    ['7', '8', '9'],
                    ['C', '0', 'DEL'],
                  ].map((row, rIndex) => (
                    <View key={`row-${rIndex}`} style={styles.keypadRow}>
                      {row.map((k) => (
                        <Pressable
                          key={k}
                          onPress={() => handleKeypadPress(k)}
                          style={({ pressed }) => [
                            styles.keypadKey,
                            (k === 'C' || k === 'DEL') && styles.keypadKeySpecial,
                            pressed && styles.keypadKeyPressed,
                          ]}
                        >
                          {k === 'DEL' ? (
                            <Ionicons color="#FFFFFF" name="backspace-outline" size={24} />
                          ) : (
                            <Text
                              style={[
                                styles.keypadKeyText,
                                k === 'C' && { color: '#EF4444' },
                              ]}
                            >
                              {k}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ===============================================================
                VISTA DINÁMICA B: TRANSFERENCIA (PANTALLA LIMPIA - CERO DIGITACIÓN)
                =============================================================== */}
            {paymentMethod === 'transfer' ? (
              <View style={styles.transferSectionCard}>
                <View style={styles.transferCardHeader}>
                  <View style={styles.transferIconBox}>
                    <Ionicons color="#38BDF8" name="phone-portrait" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transferCardTitle}>Comprobante de Transferencia</Text>
                    <Text style={styles.transferCardSub}>
                      Pídele al cliente que muestre la pantalla con la transacción exitosa
                    </Text>
                  </View>
                </View>

                {transferReceiptUri ? (
                  <View style={styles.transferAttachedBox}>
                    <Image
                      source={{ uri: transferReceiptUri }}
                      style={styles.transferPreviewImg}
                    />
                    <View style={styles.transferAttachedDetails}>
                      <View style={styles.transferSuccessTag}>
                        <Ionicons color="#10B981" name="checkmark-circle" size={16} />
                        <Text style={styles.transferSuccessTagText}>Comprobante Guardado</Text>
                      </View>
                      <Text style={styles.transferHintText}>
                        Evidencia offline lista. Se conciliará en la oficina web al sincronizar.
                      </Text>
                      <Pressable
                        onPress={takeTransferReceiptPhoto}
                        style={styles.retakePhotoButton}
                      >
                        <Ionicons color="#38BDF8" name="camera" size={14} />
                        <Text style={styles.retakePhotoButtonText}>Tomar otra foto</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.soberButtonContainer}>
                    <Pressable
                      disabled={takingPhoto}
                      onPress={takeTransferReceiptPhoto}
                      style={({ pressed }) => [
                        styles.btnSoberTransfer,
                        pressed && styles.btnSoberTransferPressed,
                      ]}
                    >
                      {takingPhoto ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons color="#FFFFFF" name="camera" size={24} />
                          <Text style={styles.btnSoberTransferText}>
                            📷 Tomar Foto al Comprobante
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Text style={styles.soberPolicyHint}>
                      Política MicroMaster: Cero digitación en calle. Solo foto de evidencia.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* ===============================================================
                VISTA DINÁMICA C: CRÉDITO -> SOLO PANEL DE FIRMA DIGITAL DE DEUDA
                =============================================================== */}
            {paymentMethod === 'credit' ? (
              <View style={styles.creditSectionCard}>
                <View style={styles.creditCardHeader}>
                  <View style={styles.creditIconBox}>
                    <Ionicons color="#A855F7" name="document-text" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.creditCardTitle}>Aceptación de Deuda a Crédito</Text>
                    <Text style={styles.creditCardSub}>
                      El cliente acepta formalmente el despacho y la cuenta por cobrar
                    </Text>
                  </View>
                </View>

                {signatureData ? (
                  <View style={styles.creditAttachedBox}>
                    <View style={styles.creditSignatureIconBox}>
                      <Ionicons color="#10B981" name="checkmark-circle" size={32} />
                    </View>
                    <View style={styles.creditAttachedDetails}>
                      <View style={styles.creditSuccessTag}>
                        <Ionicons color="#10B981" name="shield-checkmark" size={16} />
                        <Text style={styles.creditSuccessTagText}>Firma Digital Aceptada</Text>
                      </View>
                      <Text style={styles.creditHintText}>
                        Deuda registrada por {formatMoney(recalculatedTotal)} para {order.client_name ?? 'el cliente'}.
                      </Text>
                      <Pressable
                        onPress={() => setSignatureModalVisible(true)}
                        style={styles.retakeSignatureButton}
                      >
                        <Ionicons color="#A855F7" name="pencil" size={14} />
                        <Text style={styles.retakeSignatureButtonText}>Rehacer firma del cliente</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.soberButtonContainer}>
                    <Pressable
                      onPress={() => setSignatureModalVisible(true)}
                      style={({ pressed }) => [
                        styles.btnSoberCredit,
                        pressed && styles.btnSoberCreditPressed,
                      ]}
                    >
                      <Ionicons color="#FFFFFF" name="pencil" size={24} />
                      <Text style={styles.btnSoberCreditText}>
                        ✍️ Solicitar Firma Digital al Cliente
                      </Text>
                    </Pressable>
                    <Text style={styles.soberPolicyHint}>
                      El tendero firmará con su dedo en la pantalla para validar la entrega.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* PRUEBA DE ENTREGA (POD) FOTOGRÁFICA OPCIONAL EN CASO DE EFECTIVO */}
            {paymentMethod === 'cash' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PRUEBA DE ENTREGA (POD) OPCIONAL</Text>
                <View style={styles.podOptionsRow}>
                  {/* FOTO DE MERCANCÍA / FACHADA */}
                  <Pressable
                    disabled={takingPhoto}
                    onPress={takePodPhoto}
                    style={[
                      styles.podOptionCard,
                      photoUri ? styles.podOptionCardActive : null,
                    ]}
                  >
                    {takingPhoto ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : photoUri ? (
                      <View style={styles.podAttachedBox}>
                        <Image source={{ uri: photoUri }} style={styles.podPhotoThumb} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.podAttachedBadge}>
                            <Ionicons color="#10B981" name="checkmark-circle" size={14} />
                            <Text style={styles.podAttachedBadgeText}>Foto Capturada</Text>
                          </View>
                          <Text style={styles.podRetakeText}>Toca para cambiar</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.podInner}>
                        <Ionicons color="#38BDF8" name="camera" size={24} />
                        <Text style={styles.podButtonTitle}>Foto Mercancía</Text>
                        <Text style={styles.podButtonSub}>Cajas en local / fachada</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* FIRMA DIGITAL DEL CLIENTE */}
                  <Pressable
                    onPress={() => setSignatureModalVisible(true)}
                    style={[
                      styles.podOptionCard,
                      signatureData ? styles.podOptionCardActive : null,
                    ]}
                  >
                    {signatureData ? (
                      <View style={styles.podAttachedBox}>
                        <View style={styles.signatureThumbPlaceholder}>
                          <Ionicons color="#10B981" name="pencil" size={22} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.podAttachedBadge}>
                            <Ionicons color="#10B981" name="checkmark-circle" size={14} />
                            <Text style={styles.podAttachedBadgeText}>Firma Registrada</Text>
                          </View>
                          <Text style={styles.podRetakeText}>Toca para rehacer</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.podInner}>
                        <Ionicons color="#A855F7" name="pencil" size={24} />
                        <Text style={styles.podButtonTitle}>Firma Digital</Text>
                        <Text style={styles.podButtonSub}>Firmar con el dedo</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* ACCIONES DE CIERRE FINAL ADAPTADAS AL MÉTODO */}
            <View style={styles.closeActionsSection}>
              <Text style={styles.sectionTitle}>ACCIÓN DE CIERRE</Text>

              <View style={styles.closeButtonsRow}>
                {/* 1. BOTÓN PRINCIPAL ADAPTADO AL MÉTODO */}
                <Pressable
                  disabled={processing || isAlreadyDelivered}
                  onPress={handleDeliveredComplete}
                  style={({ pressed }) => [
                    styles.btnDeliverComplete,
                    paymentMethod === 'transfer' && styles.btnDeliverCompleteBlue,
                    paymentMethod === 'credit' && styles.btnDeliverCompletePurple,
                    isAlreadyDelivered && styles.btnDisabled,
                    pressed && styles.btnDeliverPressed,
                  ]}
                >
                  {processing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        color="#04150F"
                        name={
                          paymentMethod === 'cash'
                            ? 'checkmark-done-circle'
                            : paymentMethod === 'transfer'
                              ? 'cloud-upload'
                              : 'shield-checkmark'
                        }
                        size={26}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.btnDeliverText} numberOfLines={1}>
                          {isAlreadyDelivered
                            ? 'Ya Entregado'
                            : paymentMethod === 'cash'
                              ? `CONFIRMAR EFECTIVO (${formatMoney(recalculatedTotal)})`
                              : paymentMethod === 'transfer'
                                ? `REGISTRAR TRANSFERENCIA (${formatMoney(recalculatedTotal)})`
                                : `CONFIRMAR CRÉDITO (${formatMoney(recalculatedTotal)})`}
                        </Text>
                        <Text style={styles.btnDeliverSub} numberOfLines={1}>
                          {paymentMethod === 'cash'
                            ? 'Sumar al Arqueo de Bolsillo'
                            : paymentMethod === 'transfer'
                              ? 'Guardar offline para conciliar en web'
                              : 'Guardar deuda con firma digital'}
                        </Text>
                      </View>
                    </>
                  )}
                </Pressable>

                {/* 2. BOTÓN LATERAL RECHAZO TOTAL */}
                <Pressable
                  disabled={processing || isAlreadyDelivered}
                  onPress={() => setRejectionVisible(true)}
                  style={({ pressed }) => [
                    styles.btnRejectSide,
                    pressed && styles.btnRejectPressed,
                  ]}
                >
                  <Ionicons color="#FFFFFF" name="close-circle" size={20} />
                  <Text style={styles.btnRejectSideText}>Rechazo Total</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL DE DEVOLUCIÓN PARCIAL DE UN ÍTEM */}
      <Modal animationType="slide" transparent visible={itemNoveltyVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Ionicons color="#F59E0B" name="alert-circle" size={26} />
              <Text style={styles.modalTitle}>Devolución Parcial en Sitio</Text>
            </View>

            {selectedItem ? (
              <View style={styles.modalItemInfo}>
                <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                <Text style={styles.modalItemSub}>
                  Total pedido: {selectedItem.quantity} {selectedItem.unit} • {formatMoney(selectedItem.unit_price)} c/u
                </Text>
              </View>
            ) : null}

            {/* STEPPER DE CANTIDAD DEVUELTA */}
            <Text style={styles.modalLabel}>¿Cuántas unidades devuelve el cliente?</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => setRejectedQuantity((prev) => Math.max(1, prev - 1))}
                style={styles.stepperBtn}
              >
                <Ionicons color="#FFFFFF" name="remove" size={24} />
              </Pressable>
              <View style={styles.stepperDisplay}>
                <Text style={styles.stepperDisplayText}>
                  {rejectedQuantity} {selectedItem?.unit ?? 'Unidades'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  setRejectedQuantity((prev) =>
                    Math.min(selectedItem?.quantity || 10, prev + 1),
                  )
                }
                style={styles.stepperBtn}
              >
                <Ionicons color="#FFFFFF" name="add" size={24} />
              </Pressable>
            </View>

            {/* IMPACTO EN LA FACTURA */}
            <View style={styles.discountImpactBox}>
              <Text style={styles.discountImpactText}>
                Impacto en factura: -
                {formatMoney(
                  rejectedQuantity * (selectedItem?.unit_price || 0),
                )}
              </Text>
            </View>

            {/* MOTIVOS DE DEVOLUCIÓN */}
            <Text style={styles.modalLabel}>Motivo de la devolución:</Text>
            <View style={styles.reasonsGrid}>
              {NOVELTY_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setSelectedReason(r)}
                  style={[
                    styles.reasonChip,
                    selectedReason === r && styles.reasonChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonChipText,
                      selectedReason === r && styles.reasonChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* BOTONES MODAL */}
            <Pressable onPress={handleSaveItemNovelty} style={styles.confirmNoveltyBtn}>
              <Text style={styles.confirmBtnText}>Aplicar Devolución Parcial</Text>
            </Pressable>
            <Pressable
              onPress={() => setItemNoveltyVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL DE RECHAZO TOTAL DEL PEDIDO */}
      <Modal animationType="slide" transparent visible={rejectionVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Ionicons color="#EF4444" name="close-circle" size={26} />
              <Text style={styles.modalTitle}>Rechazar Todo el Pedido</Text>
            </View>

            <Text style={styles.modalLabel}>Motivo del rechazo completo:</Text>
            <View style={styles.reasonsList}>
              {REJECTION_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRejectionReason(r)}
                  style={[
                    styles.rejectionCard,
                    rejectionReason === r && styles.rejectionCardActive,
                  ]}
                >
                  <Ionicons
                    color={rejectionReason === r ? '#EF4444' : colors.textMuted}
                    name={
                      rejectionReason === r
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                  />
                  <Text style={styles.rejectionCardText}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleConfirmRejection} style={styles.confirmRejectBtn}>
              <Text style={styles.confirmBtnText}>Confirmar Rechazo Total</Text>
            </Pressable>
            <Pressable
              onPress={() => setRejectionVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL DE FIRMA DIGITAL CON EL DEDO */}
      <SignaturePadModal
        clientName={order.client_name}
        onClose={() => setSignatureModalVisible(false)}
        onSave={(data) => {
          setSignatureData(data);
          Alert.alert(
            'Firma Registrada',
            paymentMethod === 'credit'
              ? 'La firma digital de aceptación de crédito quedó guardada exitosamente.'
              : 'La firma digital del receptor quedó validada y asociada al pedido.',
          );
        }}
        visible={signatureModalVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // PASOS SUPERIORES
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  stepTabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeActive: {
    backgroundColor: colors.primary,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  stepArrow: {
    paddingHorizontal: 4,
  },

  // CLIENT CARD
  clientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clientTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  clientTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  orderNumber: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressTextCol: {
    flex: 1,
    gap: 2,
  },
  addressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  wazeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
  },
  wazeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  originalAmountCrossed: {
    color: colors.textMuted,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  totalAmount: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: '900',
  },

  // MANIFIESTO DE DESCARGUE (CHECKLIST)
  section: {
    gap: spacing.sm,
  },
  manifestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  manifestTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  manifestSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  checkAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  checkAllText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  itemCardConfirmed: {
    borderColor: '#10B981',
    backgroundColor: '#0C1C17',
  },
  itemCardHasReturn: {
    borderColor: '#F59E0B',
    backgroundColor: '#1E190E',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qtyBox: {
    width: 68,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBoxConfirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  qtyBoxReturn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  qtyNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  qtyUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  itemPriceSub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  confirmedBannerText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  noveltyAlertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  noveltyAlertTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  noveltyAlertReason: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  noveltyAlertDelivered: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  btnItemConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 9,
  },
  btnItemConfirmActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  btnItemConfirmText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  btnItemConfirmTextActive: {
    color: '#FFFFFF',
  },
  btnItemNovelty: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 9,
  },
  btnItemNoveltyActive: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  btnItemNoveltyText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  btnItemNoveltyTextActive: {
    color: '#FFFFFF',
  },
  btnItemUndo: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // RESUMEN FINANCIERO DEL DESCARGUE
  manifestSummaryBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    marginTop: spacing.xs,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryTotalLine: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 2,
  },
  summaryTotalLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  summaryTotalValue: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '900',
  },
  proceedToPaymentBtn: {
    backgroundColor: '#10B981',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginTop: spacing.xs,
  },
  proceedToPaymentBtnText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // PASO 2: COBRO & ADAPTACIÓN OFFLINE
  backToManifestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  backToManifestText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // MENÚ DESPLEGABLE (DROPDOWN LIMPIO)
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  dropdownButtonActive: {
    borderColor: colors.primary,
  },
  dropdownSelectedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dropdownIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dropdownSelectedTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  badgeTag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dropdownSelectedDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.surfaceAlt,
  },
  dropdownItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownItemDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },

  // KEYPAD GIGANTE (EFECTIVO)
  keypadSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receivedDisplayBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  receivedDisplayLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  receivedDisplayText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  changeBadgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  changeBadgeMissing: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  changeBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  shortcutBtnPrimary: {
    flex: 1.4,
    backgroundColor: '#10B981',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutBtnTextPrimary: {
    color: '#04150F',
    fontSize: 12,
    fontWeight: '900',
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  keypadGrid: {
    gap: spacing.xs + 2,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  keypadKey: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keypadKeySpecial: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  keypadKeyPressed: {
    backgroundColor: colors.primary,
  },
  keypadKeyText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  // TRANSFERENCIA: DISEÑO LIMPIO Y SOBRIO (CERO DIGITACIÓN)
  transferSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  transferCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  transferIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  transferCardSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  soberButtonContainer: {
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  btnSoberTransfer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#0284C7',
    paddingVertical: spacing.md + 4,
    borderRadius: radius.xl,
    shadowColor: '#0284C7',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSoberTransferPressed: {
    backgroundColor: '#0369A1',
    transform: [{ scale: 0.98 }],
  },
  btnSoberTransferText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  soberPolicyHint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  transferAttachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#0C1A24',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  transferPreviewImg: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: '#000000',
  },
  transferAttachedDetails: {
    flex: 1,
    gap: 4,
  },
  transferSuccessTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transferSuccessTagText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '800',
  },
  transferHintText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  retakePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  retakePhotoButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },

  // CRÉDITO: DISEÑO LIMPIO CON FIRMA DIGITAL
  creditSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  creditCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  creditIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  creditCardSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  btnSoberCredit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#9333EA',
    paddingVertical: spacing.md + 4,
    borderRadius: radius.xl,
    shadowColor: '#9333EA',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSoberCreditPressed: {
    backgroundColor: '#7E22CE',
    transform: [{ scale: 0.98 }],
  },
  btnSoberCreditText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  creditAttachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#1E1428',
    borderColor: '#A855F7',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  creditSignatureIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  creditAttachedDetails: {
    flex: 1,
    gap: 4,
  },
  creditSuccessTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditSuccessTagText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '800',
  },
  creditHintText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  retakeSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  retakeSignatureButtonText: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '700',
  },

  // POD (FOTO/FIRMA EN CASO DE EFECTIVO)
  podOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  podOptionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 90,
    justifyContent: 'center',
  },
  podOptionCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#0F1E19',
  },
  podInner: {
    alignItems: 'center',
    gap: 4,
  },
  podButtonTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  podButtonSub: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  podAttachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  podPhotoThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: '#000000',
  },
  signatureThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: '#0C1C17',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  podAttachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  podAttachedBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  podRetakeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // ACCIONES DE CIERRE FINAL
  closeActionsSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  closeButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnDeliverComplete: {
    flex: 2.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#10B981',
    borderRadius: radius.xl,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.md,
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDeliverCompleteBlue: {
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
  },
  btnDeliverCompletePurple: {
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
  },
  btnDeliverPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  btnDeliverText: {
    color: '#04150F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnDeliverSub: {
    color: '#04150F',
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.85,
  },
  btnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  btnRejectSide: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  btnRejectSideText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  btnRejectPressed: {
    backgroundColor: '#B91C1C',
  },

  // MODALES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl + 20 : spacing.xl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  modalItemInfo: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  modalItemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalItemSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperDisplay: {
    minWidth: 140,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperDisplayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  discountImpactBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  discountImpactText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '800',
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  reasonChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  reasonChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  confirmNoveltyBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmRejectBtn: {
    backgroundColor: '#EF4444',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  modalCancelBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonsList: {
    gap: spacing.xs + 2,
  },
  rejectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rejectionCardActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  rejectionCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
});
