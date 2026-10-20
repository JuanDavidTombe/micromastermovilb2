import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const digits = value.split('');
  const activeIndex = Math.min(digits.length, length - 1);

  const handleChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, length);
    onChange(digitsOnly);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.boxes}>
        {Array.from({ length }).map((_, index) => {
          const digit = digits[index];
          const isActive = index === activeIndex && !disabled;
          return (
            <View
              key={index}
              style={[styles.box, isActive && styles.boxActive, digit ? styles.boxFilled : null]}
            >
              <Text style={styles.digit}>{digit ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={length}
          onChangeText={handleChange}
          selectionColor="transparent"
          style={styles.hiddenInput}
          value={value}
        />
      </View>
      <Text style={styles.hint}>Acepta códigos de 4 o 6 dígitos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  boxes: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.primary,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  digit: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  hiddenInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    color: 'transparent',
    fontSize: 16,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
