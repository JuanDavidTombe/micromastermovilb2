import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { offlineService } from '@/services/offline.service';

interface SosModalProps {
  visible: boolean;
  onClose: () => void;
}

type EmergencyType = 'Falla Mecánica' | 'Accidente' | 'Vía Bloqueada';

const EMERGENCIES: { type: EmergencyType; label: string; icon: 'build' | 'warning' | 'car'; desc: string }[] = [
  {
    type: 'Falla Mecánica',
    label: 'Falla Mecánica',
    icon: 'build',
    desc: 'Motor, llanta pinchada o avería eléctrica',
  },
  {
    type: 'Accidente',
    label: 'Accidente',
    icon: 'car',
    desc: 'Colisión o emergencia en la vía',
  },
  {
    type: 'Vía Bloqueada',
    label: 'Vía Bloqueada',
    icon: 'warning',
    desc: 'Derrumbe, manifestación o paso cerrado',
  },
];

export function SosModal({ visible, onClose }: SosModalProps) {
  const [sending, setSending] = useState(false);
  const [sentType, setSentType] = useState<EmergencyType | null>(null);

  const handleSelect = async (emergency: EmergencyType) => {
    setSending(true);
    setSentType(emergency);

    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }
    } catch {
      // Offline o sin GPS: se envía sin coordenadas exactas
    }

    try {
      await offlineService.sendSos(emergency, coords);
    } catch {
      // Guardado localmente garantizado
    } finally {
      setSending(false);
    }
  };

  const handleDone = () => {
    setSentType(null);
    onClose();
  };

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons color="#FFFFFF" name="alert" size={28} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>S.O.S. Pánico Logístico</Text>
              <Text style={styles.subtitle}>
                Dispara alerta con tu posición GPS al supervisor
              </Text>
            </View>
          </View>

          {sentType ? (
            <View style={styles.sentBox}>
              <View style={styles.checkCircle}>
                <Ionicons color={colors.success} name="checkmark" size={36} />
              </View>
              <Text style={styles.sentTitle}>¡Alerta Registrada!</Text>
              <Text style={styles.sentText}>
                Se ha enviado reporte por: <Text style={styles.bold}>{sentType}</Text>
              </Text>
              <Text style={styles.offlineNote}>
                📡 Si estás en un sótano o sin señal, la alerta está guardada en tu teléfono y se transmitirá automáticamente apenas detecte red.
              </Text>
              <Pressable onPress={handleDone} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Entendido</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.prompt}>
                Selecciona la situación para alertar a la base:
              </Text>

              <View style={styles.optionsList}>
                {EMERGENCIES.map((item) => (
                  <Pressable
                    key={item.type}
                    disabled={sending}
                    onPress={() => handleSelect(item.type)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionIconBox}>
                      <Ionicons color="#EF4444" name={item.icon} size={26} />
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>{item.label}</Text>
                      <Text style={styles.optionDesc}>{item.desc}</Text>
                    </View>
                    <Ionicons color={colors.textMuted} name="chevron-forward" size={22} />
                  </Pressable>
                ))}
              </View>

              {sending ? (
                <View style={styles.sendingRow}>
                  <ActivityIndicator color="#EF4444" size="small" />
                  <Text style={styles.sendingText}>Obteniendo GPS y transmitiendo…</Text>
                </View>
              ) : null}

              <Pressable
                disabled={sending}
                onPress={onClose}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar / Falsa alarma</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 10,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  prompt: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  optionPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    transform: [{ scale: 0.98 }],
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  optionDesc: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sendingText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  sentBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  sentTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  sentText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  bold: {
    color: colors.primary,
    fontWeight: '800',
  },
  offlineNote: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginVertical: spacing.sm,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
