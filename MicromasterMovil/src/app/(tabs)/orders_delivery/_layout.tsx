import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function OrdersDeliveryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
