import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { OtpInput } from '@/components/OtpInput';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill } from '@/components/StatusPill';
import { colors, radius, spacing } from '@/constants/theme';
import { deliveryService } from '@/services/delivery.service';
import type { DeliveryOrder, IncidentType, PaymentMethod } from '@/types/models';
import { getApiErrorMessage } from '@/utils/errors';
import { formatMoney, statusTone, toNumber } from '@/utils/format';

interface Feedback {
  tone: 'success' | 'warning' | 'danger';
  text: string;
}

const INCIDENT_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: 'CLIENT_NOT_FOUND', label: 'Cliente no encontrado' },
  { value: 'WRONG_ADDRESS', label: 'Dirección incorrecta' },
  { value: 'VEHICLE_BREAKDOWN', label: 'Falla del vehículo' },
  { value: 'OTHER', label: 'Otra / merma' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [changeDue, setChangeDue] = useState<number | null>(null);
  const [incidentType, setIncidentType] = useState<IncidentType>('CLIENT_NOT_FOUND');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [action, setAction] = useState<
    'verify' | 'pay' | 'complete' | 'deliver' | 'incident' | null
  >(null);

  const load = useCallback(() => {
    if (!id) return;
    deliveryService
      .getOrder(id)
      .then((result) => {
        setOrder(result);
        setError(null);
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = (name: NonNullable<typeof action>, task: Promise<unknown>, done?: () => void) => {
    setAction(name);
    task
      .then(() => {
        done?.();
        setAction(null);
        load();
      })
      .catch((err: unknown) => {
        setFeedback({ tone: 'danger', text: getApiErrorMessage(err) });
        setAction(null);
      });
  };

  const verifyOtp = () => {
    if (otp.length < 4) {
      setFeedback({ tone: 'warning', text: 'El código debe tener al menos 4 dígitos.' });
      return;
    }
    run(
      'verify',
      deliveryService.verifyOtp(otp),
      () => {
        setOtpVerified(true);
        setFeedback({ tone: 'success', text: 'Código OTP verificado correctamente.' });
      },
    );
  };

  const registerPayment = () => {
    if (!order) return;
    const amount =
      payMethod === 'qr' ? toNumber(order.amount) : toNumber(received || '0');
    if (payMethod === 'cash' && amount <= 0) {
      setFeedback({ tone: 'warning', text: 'Ingresa el dinero recibido.' });
      return;
    }
    if (amount < toNumber(order.amount)) {
      setFeedback({ tone: 'warning', text: 'El recibido es menor al total a cobrar.' });
      return;
    }

    setAction('pay');
    deliveryService
      .updatePayment({
        orderId: order.id,
        paymentMethod: payMethod,
        receivedAmount: amount,
      })
      .then((result) => {
        setChangeDue(result.changeDue);
        setReceived('');
        setFeedback({ tone: 'success', text: 'Pago registrado.' });
        load();
      })
      .catch((err: unknown) => {
        setFeedback({ tone: 'danger', text: getApiErrorMessage(err) });
      })
      .finally(() => setAction(null));
  };

  const completeOrder = () => {
    if (!order) return;
    if (otp.length < 4) {
      setFeedback({ tone: 'warning', text: 'Ingresa el código OTP del cliente.' });
      return;
    }
    run(
      'complete',
      deliveryService.completePayment(order.id, otp),
      () => {
        setFeedback({ tone: 'success', text: 'Entrega completada.' });
      },
    );
  };

  const markDelivered = () => {
    if (!order) return;
    run(
      'deliver',
      deliveryService.setOrderStatus(order.id, 'delivered'),
      () => setFeedback({ tone: 'success', text: 'Pedido marcado como entregado.' }),
    );
  };

  const reportIncident = () => {
    if (!order) return;
    if (!incidentDesc.trim()) {
      setFeedback({ tone: 'warning', text: 'Describe el incidente.' });
      return;
    }
    run(
      'incident',
      deliveryService.reportIncident({
        orderId: order.id,
        type: incidentType,
        description: photo
          ? `${incidentDesc.trim()} [foto: ${photo}]`
          : incidentDesc.trim(),
        routeId: order.route_id,
      }),
      () => {
        setIncidentDesc('');
        setPhoto(null);
        setFeedback({ tone: 'success', text: 'Incidencia reportada.' });
      },
    );
  };

  if (loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader back subtitle="Cargando pedido" title="Detalle de entrega" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Consultando la orden…</Text>
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader back title="Detalle de entrega" />
        <Card accent>
          <Text style={styles.errorText}>{error ?? 'Pedido no disponible.'}</Text>
          <AppButton icon="arrow-back-outline" title="Volver" variant="secondary" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const amount = toNumber(order.amount);
  const paymentDone = order.payment_status === 'completed' || order.payment_status === 'confirmed';
  const delivered = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <Screen edges={['top']}>
      <ScreenHeader back subtitle={order.route?.route_code} title="Detalle de entrega" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{order.client_name ?? `Pedido #${order.id}`}</Text>
            <StatusPill
              icon="cube-outline"
              label={order.status_label ?? order.status ?? 'Sin estado'}
              tone={statusTone(order.status)}
            />
          </View>
          <Row label="Destino" value={order.destination ?? 'Sin dirección'} />
          <Row label="Monto" value={formatMoney(amount)} />
          <Row
            label="Pago"
            value={
              paymentDone
                ? `Cobrado · ${order.payment_status_label ?? order.payment_status ?? ''}`
                : (order.payment_status_label ?? order.payment_status ?? 'Pendiente')
            }
          />
          {order.payment_method ? (
            <Row label="Método" value={order.payment_method === 'qr' ? 'QR' : 'Efectivo'} />
          ) : null}
          {toNumber(order.received_amount) > 0 ? (
            <Row label="Recibido" value={formatMoney(toNumber(order.received_amount))} />
          ) : null}
          {toNumber(order.change_due) > 0 ? (
            <Row label="Cambio" value={formatMoney(toNumber(order.change_due))} />
          ) : null}
          <View style={styles.pillRow}>
            <StatusPill
              icon={paymentDone ? 'checkmark-circle-outline' : 'time-outline'}
              label={paymentDone ? 'Cobrado' : 'Por cobrar'}
              tone={paymentDone ? 'success' : 'warning'}
            />
            <StatusPill icon="navigate-outline" label="Ubicación de la parada" tone="info" />
          </View>
        </Card>

        {!delivered ? (
          <Card>
            <Text style={styles.sectionTitle}>Código OTP del cliente</Text>
            <OtpInput disabled={action === 'verify'} onChange={setOtp} value={otp} />
            <AppButton
              disabled={otpVerified}
              icon="shield-checkmark-outline"
              loading={action === 'verify'}
              title={otpVerified ? 'Código verificado' : 'Verificar código'}
              onPress={verifyOtp}
            />
            {otpVerified ? (
              <View style={styles.okRow}>
                <Ionicons color={colors.success} name="checkmark-circle" size={16} />
                <Text style={styles.okText}>Identidad del cliente confirmada.</Text>
              </View>
            ) : (
              <Text style={styles.hint}>
                El backend valida códigos de 4 dígitos (otros largos muestran error).
              </Text>
            )}
          </Card>
        ) : null}

        {!paymentDone && !delivered ? (
          <Card>
            <Text style={styles.sectionTitle}>Cobro de la entrega</Text>
            <View style={styles.methodRow}>
              {(['cash', 'qr'] as PaymentMethod[]).map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPayMethod(method)}
                  style={[styles.method, payMethod === method && styles.methodActive]}
                >
                  <Ionicons
                    color={payMethod === method ? colors.primary : colors.textMuted}
                    name={method === 'cash' ? 'cash-outline' : 'qr-code-outline'}
                    size={18}
                  />
                  <Text
                    style={[styles.methodLabel, payMethod === method && styles.methodLabelActive]}
                  >
                    {method === 'cash' ? 'Efectivo' : 'QR'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {payMethod === 'cash' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Dinero recibido</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setReceived}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={received}
                />
                {toNumber(received) >= amount ? (
                  <Text style={styles.change}>
                    Cambio: {formatMoney(toNumber(received) - amount)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.hint}>Se confirma el pago con el QR mostrado por el cliente.</Text>
            )}

            <AppButton
              icon="wallet-outline"
              loading={action === 'pay'}
              title="Registrar pago"
              onPress={registerPayment}
            />
            {changeDue != null ? (
              <Text style={styles.change}>Cambio entregado: {formatMoney(changeDue)}</Text>
            ) : null}
          </Card>
        ) : null}

        {!delivered ? (
          <Card>
            <Text style={styles.sectionTitle}>Completar entrega</Text>
            <AppButton
              icon="checkmark-done-outline"
              loading={action === 'complete'}
              title="Completar con OTP"
              onPress={completeOrder}
            />
            <AppButton
              icon="flag-outline"
              loading={action === 'deliver'}
              title="Marcar como entregado"
              variant="secondary"
              onPress={markDelivered}
            />
          </Card>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Reportar incidencia / merma</Text>
          <View style={styles.chips}>
            {INCIDENT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setIncidentType(option.value)}
                style={[styles.chip, incidentType === option.value && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    incidentType === option.value && styles.chipLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            multiline
            onChangeText={setIncidentDesc}
            placeholder="Describe lo ocurrido…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea]}
            value={incidentDesc}
          />

          <View style={styles.photoRow}>
            <AppButton
              fullWidth={false}
              icon="camera-outline"
              title={photo ? 'Foto adjunta' : 'Adjuntar foto (simulada)'}
              variant="secondary"
              onPress={() => setPhoto(photo ? null : `merma_${Date.now()}.jpg`)}
            />
            {photo ? (
              <Pressable hitSlop={8} onPress={() => setPhoto(null)}>
                <Ionicons color={colors.danger} name="trash-outline" size={20} />
              </Pressable>
            ) : null}
          </View>
          {photo ? <Text style={styles.hint}>{photo}</Text> : null}

          <AppButton
            icon="warning-outline"
            loading={action === 'incident'}
            title="Enviar reporte"
            variant="danger"
            onPress={reportIncident}
          />
        </Card>

        {feedback ? (
          <View
            style={[
              styles.feedback,
              {
                borderColor: colors[feedback.tone],
                backgroundColor: `${colors[feedback.tone]}22`,
              },
            ]}
          >
            <Text style={[styles.feedbackText, { color: colors[feedback.tone] }]}>
              {feedback.text}
            </Text>
          </View>
        ) : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  method: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    minHeight: 48,
  },
  methodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  methodLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  methodLabelActive: {
    color: colors.primary,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    color: colors.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  change: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  okRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  okText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
  },
  feedback: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
