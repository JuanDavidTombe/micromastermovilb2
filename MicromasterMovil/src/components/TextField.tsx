import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { AppIconName } from '@/components/AppButton';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: AppIconName;
  error?: string | null;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

export function TextField({ label, icon, error, secure = false, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {icon ? (
          <Ionicons
            color={focused ? colors.primary : colors.textMuted}
            name={icon}
            size={18}
          />
        ) : null}
        <TextInput
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          style={styles.input}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
          >
            <Ionicons color={colors.textMuted} name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs + 2,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 54,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.sm + 2,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginLeft: spacing.xs,
  },
});
