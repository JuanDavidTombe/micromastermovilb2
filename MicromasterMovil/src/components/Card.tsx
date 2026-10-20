import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, softShadow, spacing } from '@/constants/theme';

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  header?: ReactNode;
}

export function Card({ children, onPress, style, accent = false, header }: CardProps) {
  const content = (
    <View style={[styles.card, accent && styles.accent, style]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...softShadow,
  },
  accent: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  header: {
    marginBottom: spacing.sm,
  },
});
