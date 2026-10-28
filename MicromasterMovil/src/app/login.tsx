import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import {
  getActiveApiBaseUrl,
  pingBackend,
  resetCustomApiBaseUrl,
  setCustomApiBaseUrl,
} from '@/services/api';
import { getApiErrorMessage, getApiValidationErrors } from '@/utils/errors';

export default function LoginScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [serverUrl, setServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverPingStatus, setServerPingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [serverPingMessage, setServerPingMessage] = useState<string>('');

  useEffect(() => {
    let active = true;
    getActiveApiBaseUrl().then((url) => {
      if (!active) return;
      setServerUrl(url);
      setServerPingStatus('checking');
      pingBackend(url).then((res) => {
        if (!active) return;
        setServerPingStatus(res.ok ? 'ok' : 'error');
        setServerPingMessage(res.message);
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    setServerPingStatus('checking');
    await setCustomApiBaseUrl(serverUrl.trim());
    const res = await pingBackend(serverUrl.trim());
    setServerPingStatus(res.ok ? 'ok' : 'error');
    setServerPingMessage(res.message);
  };

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = 'El correo es obligatorio.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Ingresa un correo válido.';
    if (!password) errors.password = 'La contraseña es obligatoria.';

    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(getApiErrorMessage(err));
      setFieldErrors(getApiValidationErrors(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons color={colors.onPrimary} name="cube" size={34} />
            </View>
            <Text style={styles.title}>MicroMaster</Text>
            <Text style={styles.subtitle}>Accede a tu panel logístico</Text>
          </View>

          <Card>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons color={colors.danger} name="alert-circle" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextField
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
              icon="mail-outline"
              keyboardType="email-address"
              label="Correo electrónico"
              placeholder="operador@micromaster.com"
              value={email}
              onChangeText={setEmail}
            />

            <TextField
              autoCapitalize="none"
              autoComplete="password"
              error={fieldErrors.password}
              icon="lock-closed-outline"
              label="Contraseña"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.quickRoles}>
              <Text style={styles.quickRolesLabel}>Acceso rápido:</Text>
              <View style={styles.quickRolesRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.quickRoleChip}
                  onPress={() => {
                    setEmail('conductor1@micromaster.com');
                    setPassword('conductor123');
                    setFieldErrors({});
                    setError(null);
                  }}
                >
                  <Text style={styles.quickRoleText}>🚛 Conductor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.quickRoleChip}
                  onPress={() => {
                    setEmail('logistica@micromaster.com');
                    setPassword('logistica123');
                    setFieldErrors({});
                    setError(null);
                  }}
                >
                  <Text style={styles.quickRoleText}>📦 Operario</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.quickRoleChip}
                  onPress={() => {
                    setEmail('admin@micromaster.com');
                    setPassword('admin123');
                    setFieldErrors({});
                    setError(null);
                  }}
                >
                  <Text style={styles.quickRoleText}>👔 Admin</Text>
                </TouchableOpacity>
              </View>
            </View>

            <AppButton
              icon="log-in-outline"
              loading={loading}
              title="Entrar"
              onPress={onSubmit}
            />

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.serverInfoBar}
              onPress={() => setShowServerConfig(!showServerConfig)}
            >
              <View
                style={[
                  styles.statusDot,
                  serverPingStatus === 'ok'
                    ? styles.statusDotOk
                    : serverPingStatus === 'checking'
                      ? styles.statusDotChecking
                      : styles.statusDotError,
                ]}
              />
              <Text numberOfLines={1} style={styles.serverInfoText}>
                {serverUrl || 'Detectando servidor...'}
              </Text>
              <Ionicons
                color={colors.textMuted}
                name={showServerConfig ? 'chevron-up' : 'settings-outline'}
                size={16}
              />
            </TouchableOpacity>

            {showServerConfig ? (
              <View style={styles.serverConfigBox}>
                <Text style={styles.serverConfigTitle}>Ajustar IP del Servidor</Text>
                <TextField
                  autoCapitalize="none"
                  label="URL de API Laravel"
                  placeholder="http://192.168.200.103:8080/api"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                />
                {serverPingMessage ? (
                  <Text
                    style={[
                      styles.serverPingText,
                      serverPingStatus === 'ok' ? styles.textSuccess : styles.textDanger,
                    ]}
                  >
                    {serverPingMessage}
                  </Text>
                ) : null}
                <View style={styles.serverActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.serverActionBtn}
                    onPress={handleSaveServerUrl}
                  >
                    <Ionicons color={colors.onPrimary} name="save-outline" size={16} />
                    <Text style={styles.serverActionBtnText}>Guardar y Probar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.serverResetBtn}
                    onPress={async () => {
                      await resetCustomApiBaseUrl();
                      const def = await getActiveApiBaseUrl();
                      setServerUrl(def);
                      const res = await pingBackend(def);
                      setServerPingStatus(res.ok ? 'ok' : 'error');
                      setServerPingMessage(res.message);
                    }}
                  >
                    <Ionicons color={colors.textMuted} name="refresh-outline" size={16} />
                    <Text style={styles.serverResetBtnText}>Restablecer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Aún no tienes cuenta?</Text>
            <Link href="/register" style={styles.link}>
              Regístrate aquí
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  quickRoles: {
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  quickRolesLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  quickRolesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickRoleChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRoleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
  serverInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOk: {
    backgroundColor: colors.primary,
  },
  statusDotChecking: {
    backgroundColor: colors.warning,
  },
  statusDotError: {
    backgroundColor: colors.danger,
  },
  serverInfoText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  serverConfigBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  serverConfigTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  serverPingText: {
    fontSize: 12,
  },
  textSuccess: {
    color: colors.primary,
  },
  textDanger: {
    color: colors.danger,
  },
  serverActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  serverActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  serverActionBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  serverResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.sm,
  },
  serverResetBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
