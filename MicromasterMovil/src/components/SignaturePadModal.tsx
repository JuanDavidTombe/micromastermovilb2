import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, spacing } from '@/constants/theme';

interface SignaturePadModalProps {
  visible: boolean;
  clientName?: string | null;
  onClose: () => void;
  onSave: (signatureData: string) => void;
}

export function SignaturePadModal({
  visible,
  clientName,
  onClose,
  onSave,
}: SignaturePadModalProps) {
  const [paths, setPaths] = useState<string[]>([]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const startPt = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setPaths((prev) => [...prev, startPt]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const movePt = ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setPaths((prev) => {
            if (prev.length === 0) return [`M${locationX.toFixed(1)},${locationY.toFixed(1)}`];
            const next = [...prev];
            next[next.length - 1] = next[next.length - 1] + movePt;
            return next;
          });
        },
      }),
    [],
  );

  const handleClear = () => {
    setPaths([]);
  };

  const handleConfirm = () => {
    if (paths.length === 0) return;
    const fullSvgString = paths.join(' ');
    onSave(fullSvgString);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* CABECERA */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Firma Digital del Cliente</Text>
              <Text style={styles.subtitle}>
                {clientName ? `Receptor: ${clientName}` : 'Firma con el dedo en el recuadro'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons color={colors.textMuted} name="close" size={24} />
            </Pressable>
          </View>

          {/* LIENZO DE FIRMA */}
          <View style={styles.canvasContainer} {...panResponder.panHandlers}>
            <Svg style={StyleSheet.absoluteFill}>
              {paths.map((d, index) => (
                <Path
                  key={index}
                  d={d}
                  fill="none"
                  stroke="#10B981"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3.5}
                />
              ))}
            </Svg>

            {paths.length === 0 ? (
              <View pointerEvents="none" style={styles.placeholderBox}>
                <Ionicons color="#475569" name="pencil-outline" size={32} />
                <Text style={styles.placeholderText}>
                  El cliente debe firmar aquí con el dedo
                </Text>
                <View style={styles.signatureLine} />
              </View>
            ) : (
              <View pointerEvents="none" style={styles.signatureWatermark}>
                <View style={styles.signatureLineActive} />
                <Text style={styles.signatureLineLabel}>Firma Digital MicroMaster</Text>
              </View>
            )}
          </View>

          {/* ACCIONES */}
          <View style={styles.actionsRow}>
            <Pressable
              disabled={paths.length === 0}
              onPress={handleClear}
              style={[
                styles.clearButton,
                paths.length === 0 && styles.buttonDisabled,
              ]}
            >
              <Ionicons
                color={paths.length === 0 ? colors.textMuted : colors.danger}
                name="trash-outline"
                size={18}
              />
              <Text
                style={[
                  styles.clearButtonText,
                  paths.length === 0 && styles.textDisabled,
                ]}
              >
                Limpiar
              </Text>
            </Pressable>

            <Pressable
              disabled={paths.length === 0}
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                paths.length === 0 && styles.buttonDisabled,
              ]}
            >
              <Ionicons
                color={paths.length === 0 ? colors.textMuted : colors.onPrimary}
                name="checkmark-circle"
                size={20}
              />
              <Text
                style={[
                  styles.confirmButtonText,
                  paths.length === 0 && styles.textDisabled,
                ]}
              >
                Guardar Firma
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  canvasContainer: {
    height: 220,
    backgroundColor: '#070C15',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderBox: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureLine: {
    width: 220,
    height: 1,
    backgroundColor: '#334155',
    marginTop: spacing.md,
  },
  signatureWatermark: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
  },
  signatureLineActive: {
    height: 1,
    backgroundColor: '#1E293B',
    marginBottom: 4,
  },
  signatureLineLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  confirmButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  textDisabled: {
    color: '#64748B',
  },
});
