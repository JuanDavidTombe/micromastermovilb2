import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  background: '#0B1220',
  surface: '#121C2E',
  surfaceAlt: '#182540',
  border: '#22314C',
  primary: '#10B981',
  primaryPressed: '#059669',
  primarySoft: 'rgba(16, 185, 129, 0.16)',
  text: '#E8EEF9',
  textMuted: '#8FA1BC',
  onPrimary: '#04150F',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  warning: '#FBBF24',
  info: '#60A5FA',
  success: '#34D399',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const softShadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: Platform.OS === 'android' ? 6 : 0,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '500' as const, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
} as const;
