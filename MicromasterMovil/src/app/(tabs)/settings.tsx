import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { API_BASE_URL, pingBackend } from '@/services/api';

interface SettingRowProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function SettingRow({ icon, title, subtitle, value, onValueChange }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        trackColor={{ false: colors.border, true: colors.primaryPressed }}
        thumbColor={value ? colors.primary : colors.textMuted}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setConnectionMessage(null);
    try {
      const result = await pingBackend();
      setConnectionOk(result.ok);
      setConnectionMessage(result.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configuración de la aplicación</Text>

        <Card
          header={
            <Text style={styles.sectionTitle}>Preferencias</Text>
          }
        >
          <SettingRow
            icon="notifications-outline"
            subtitle="Alertas de envíos y rutas"
            title="Notificaciones"
            value={notifications}
            onValueChange={setNotifications}
          />
          <SettingRow
            icon="sync-outline"
            subtitle="Actualiza datos en segundo plano"
            title="Sincronización automática"
            value={autoSync}
            onValueChange={setAutoSync}
          />
          <SettingRow
            icon="finger-print-outline"
            subtitle="Acceso rápido con biometría"
            title="Bloqueo biométrico"
            value={biometrics}
            onValueChange={setBiometrics}
          />
        </Card>

        <Card
          header={
            <Text style={styles.sectionTitle}>Conexión con MicroMaster Web</Text>
          }
        >
          <View style={styles.endpointBox}>
            <Ionicons color={colors.textMuted} name="server-outline" size={16} />
            <Text selectable style={styles.endpointText}>
              {API_BASE_URL}
            </Text>
          </View>

          <AppButton
            icon="wifi-outline"
            loading={testing}
            title="Probar conexión"
            variant="secondary"
            onPress={testConnection}
          />

          {connectionMessage ? (
            <View
              style={[
                styles.statusBox,
                { borderColor: connectionOk ? colors.primary : colors.danger },
              ]}
            >
              <Ionicons
                color={connectionOk ? colors.primary : colors.danger}
                name={connectionOk ? 'checkmark-circle' : 'close-circle'}
                size={18}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: connectionOk ? colors.primary : colors.danger },
                ]}
              >
                {connectionMessage}
              </Text>
            </View>
          ) : null}

          <Text style={styles.hint}>
            Configura la IP de tu backend Laravel en la variable EXPO_PUBLIC_API_URL (archivo .env).
          </Text>
        </Card>

        <Card
          header={
            <Text style={styles.sectionTitle}>Acerca de</Text>
          }
        >
          <View style={styles.aboutRow}>
            <Text style={styles.rowTitle}>Versión</Text>
            <Text style={styles.rowSubtitle}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.rowTitle}>Plataforma</Text>
            <Text style={styles.rowSubtitle}>Expo Go · React Native</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: -spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  endpointBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  endpointText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
