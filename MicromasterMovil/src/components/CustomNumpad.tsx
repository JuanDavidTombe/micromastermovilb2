import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface CustomNumpadProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm?: (val: string) => void;
  onCancel?: () => void;
  allowDecimal?: boolean;
  confirmLabel?: string;
  confirmColor?: string;
  title?: string;
  subtitle?: string;
  unit?: string;
  maxDigits?: number;
}

export function CustomNumpad({
  value,
  onChange,
  onConfirm,
  onCancel,
  allowDecimal = true,
  confirmLabel = 'Confirmar',
  confirmColor = colors.primary,
  title,
  subtitle,
  unit,
  maxDigits = 8,
}: CustomNumpadProps) {
  const handleDigit = (digit: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore
    }

    if (value.length >= maxDigits) return;

    if (digit === '.') {
      if (!allowDecimal) return;
      if (value.includes('.')) return;
      onChange(value ? `${value}.` : '0.');
      return;
    }

    if (value === '0') {
      onChange(digit);
    } else {
      onChange(`${value}${digit}`);
    }
  };

  const handleBackspace = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }

    if (!value || value.length <= 1) {
      onChange('');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // ignore
    }
    onChange('');
  };

  const handleConfirmPress = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }
    if (onConfirm) {
      onConfirm(value || '0');
    }
  };

  const renderKey = (label: string, onPress: () => void, isSpecial = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.keyButton,
        isSpecial && styles.specialKey,
        pressed && styles.keyPressed,
      ]}
    >
      <Text style={[styles.keyText, isSpecial && styles.specialKeyText]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* CABECERA / DISPLAY */}
      {(title || subtitle) && (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      )}

      {/* DISPLAY NUMÉRICO GIGANTE (SIN INPUT DEL SISTEMA OPERATIVO) */}
      <View style={styles.displayContainer}>
        <View style={styles.displayRow}>
          <Text style={styles.displayText}>{value || '0'}</Text>
          {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
        </View>
        {value.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBadge}>
            <Text style={styles.clearBadgeText}>Limpiar</Text>
          </Pressable>
        )}
      </View>

      {/* GRID DE BOTONES GIGANTES */}
      <View style={styles.grid}>
        <View style={styles.row}>
          {renderKey('1', () => handleDigit('1'))}
          {renderKey('2', () => handleDigit('2'))}
          {renderKey('3', () => handleDigit('3'))}
        </View>
        <View style={styles.row}>
          {renderKey('4', () => handleDigit('4'))}
          {renderKey('5', () => handleDigit('5'))}
          {renderKey('6', () => handleDigit('6'))}
        </View>
        <View style={styles.row}>
          {renderKey('7', () => handleDigit('7'))}
          {renderKey('8', () => handleDigit('8'))}
          {renderKey('9', () => handleDigit('9'))}
        </View>
        <View style={styles.row}>
          {allowDecimal ? (
            renderKey('.', () => handleDigit('.'), true)
          ) : (
            renderKey('C', handleClear, true)
          )}
          {renderKey('0', () => handleDigit('0'))}
          <Pressable
            onPress={handleBackspace}
            style={({ pressed }) => [styles.keyButton, styles.specialKey, pressed && styles.keyPressed]}
          >
            <Ionicons color="#CBD5E1" name="backspace-outline" size={28} />
          </Pressable>
        </View>
      </View>

      {/* BOTONES DE ACCIÓN DE CIERRE */}
      {(onConfirm || onCancel) && (
        <View style={styles.actionRow}>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          ) : null}

          {onConfirm ? (
            <Pressable
              onPress={handleConfirmPress}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: confirmColor },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons color="#04150F" name="checkmark-circle" size={26} />
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '100%',
  },
  header: {
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  displayContainer: {
    backgroundColor: '#020617',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  displayText: {
    color: '#38BDF8',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  unitText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  clearBadge: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  clearBadgeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    gap: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  keyButton: {
    flex: 1,
    height: 60,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 2,
  },
  specialKey: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  keyPressed: {
    backgroundColor: '#38BDF8',
    transform: [{ scale: 0.96 }],
  },
  keyText: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
  },
  specialKeyText: {
    color: '#94A3B8',
    fontSize: 24,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cancelPressed: {
    opacity: 0.7,
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#04150F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
