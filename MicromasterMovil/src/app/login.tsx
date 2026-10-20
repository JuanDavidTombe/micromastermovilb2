import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';
import { getApiErrorMessage, getApiValidationErrors } from '@/utils/errors';

export default function LoginScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

            <AppButton
              icon="log-in-outline"
              loading={loading}
              title="Entrar"
              onPress={onSubmit}
            />
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
