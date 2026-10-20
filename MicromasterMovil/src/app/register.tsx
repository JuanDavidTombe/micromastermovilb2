import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import type { RegistrableRole } from '@/types/models';
import { getApiErrorMessage, getApiValidationErrors } from '@/utils/errors';

const ROLE_OPTIONS: { value: RegistrableRole; label: string }[] = [
  { value: 'OPERARIO_LOGISTICO', label: 'Operario logístico' },
  { value: 'SUPERVISOR_PRODUCCION', label: 'Supervisor de producción' },
  { value: 'TRANSPORTISTA', label: 'Transportista' },
  { value: 'CONTADOR', label: 'Contador' },
];

export default function RegisterScreen() {
  const { signUp } = useSession();

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<RegistrableRole>('OPERARIO_LOGISTICO');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!document.trim()) errors.identity_document = 'El documento es obligatorio.';
    if (!email.trim()) errors.email = 'El correo es obligatorio.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Ingresa un correo válido.';
    if (!phone.trim()) errors.phone = 'El teléfono es obligatorio.';
    if (password.length < 6) errors.password = 'Mínimo 6 caracteres.';
    if (password !== confirmation) errors.password_confirmation = 'Las contraseñas no coinciden.';

    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const result = await signUp({
        name: name.trim(),
        identity_document: document.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        password_confirmation: confirmation,
        role,
      });

      if (!result.user) {
        Alert.alert(
          'Registro enviado',
          result.message ??
            'Tu cuenta quedó pendiente de aprobación por el Administrador.',
        );
        router.replace('/login');
      }
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
              <Ionicons color={colors.onPrimary} name="person-add" size={30} />
            </View>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Sujeta a aprobación del Administrador</Text>
          </View>

          <Card>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons color={colors.danger} name="alert-circle" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextField
              autoCapitalize="words"
              autoComplete="name"
              error={fieldErrors.name}
              icon="person-outline"
              label="Nombre completo"
              placeholder="Juan Pérez"
              value={name}
              onChangeText={setName}
            />

            <TextField
              autoCapitalize="characters"
              error={fieldErrors.identity_document}
              icon="card-outline"
              label="Documento de identidad"
              placeholder="V-12345678"
              value={document}
              onChangeText={setDocument}
            />

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
              error={fieldErrors.phone}
              icon="call-outline"
              keyboardType="phone-pad"
              label="Teléfono"
              placeholder="+58 412 000 0000"
              value={phone}
              onChangeText={setPhone}
            />

            <View style={styles.roleWrapper}>
              <Text style={styles.roleLabel}>Rol solicitado</Text>
              <View style={styles.roleGrid}>
                {ROLE_OPTIONS.map((option) => {
                  const selected = option.value === role;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.roleChip, selected && styles.roleChipSelected]}
                      onPress={() => setRole(option.value)}
                    >
                      <Text style={[styles.roleChipText, selected && styles.roleChipTextSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {fieldErrors.role ? <Text style={styles.error}>{fieldErrors.role}</Text> : null}
            </View>

            <TextField
              autoCapitalize="none"
              error={fieldErrors.password}
              icon="lock-closed-outline"
              label="Contraseña"
              placeholder="Mínimo 6 caracteres"
              secure
              value={password}
              onChangeText={setPassword}
            />

            <TextField
              autoCapitalize="none"
              error={fieldErrors.password_confirmation}
              icon="shield-checkmark-outline"
              label="Confirmar contraseña"
              placeholder="Repite tu contraseña"
              secure
              value={confirmation}
              onChangeText={setConfirmation}
            />

            <AppButton
              icon="person-add-outline"
              loading={loading}
              title="Solicitar registro"
              onPress={onSubmit}
            />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
            <Link href="/login" style={styles.link}>
              Inicia sesión
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
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
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
  roleWrapper: {
    gap: spacing.xs + 2,
  },
  roleLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  roleChipTextSelected: {
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginLeft: spacing.xs,
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
