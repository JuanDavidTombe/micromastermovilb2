import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashScreenController } from '@/components/SplashScreenController';
import { colors } from '@/constants/theme';
import { SessionProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SplashScreenController />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="warehouse/picking" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="warehouse/audit-select" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="warehouse/audit" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
