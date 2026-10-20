import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneColors: Record<PillTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.textMuted,
};

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}

export function StatusPill({ label, tone = 'neutral', icon, style }: StatusPillProps) {
  const color = toneColors[tone];

  return (
    <View style={[styles.pill, { backgroundColor: `${color}22`, borderColor: `${color}55` }, style]}>
      {icon ? <Ionicons color={color} name={icon} size={12} /> : null}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
