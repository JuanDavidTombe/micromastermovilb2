import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, spacing } from '@/constants/theme';
import { adminService, type CriticalAlertItem } from '@/services/admin.service';

export default function CriticalAlertsScreen() {
  const [alerts, setAlerts] = useState<CriticalAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    adminService
      .getCriticalAlerts()
      .then((data) => {
        if (active) setAlerts(data.alerts);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    adminService
      .getCriticalAlerts()
      .then((data) => setAlerts(data.alerts))
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);

  const handleDismiss = async (alertItem: CriticalAlertItem) => {
    Alert.alert(
      '¿Marcar como Atendida?',
      `Confirmas que la situación de "${alertItem.title}" ya fue gestionada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar Atendida',
          onPress: async () => {
            await adminService.dismissCriticalAlert(alertItem.id);
            setAlerts((prev) =>
              prev.map((a) => (a.id === alertItem.id ? { ...a, dismissed: true } : a)),
            );
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        subtitle="Monitoreo Macro de Riesgos Operativos"
        title="Alertas Críticas"
      />

      {/* BANNER DE FILTRADO EXCLUSIVO (NO MICROGESTIÓN) */}
      <View style={styles.bannerInfo}>
        <Ionicons color="#38BDF8" name="filter" size={16} />
        <Text style={styles.bannerText}>
          Filtro Macro Activo: Se excluyen pinchazos y microincidencias. Solo se notifican quiebres de stock, rutas en riesgo &gt;40% o cuarentenas sanitarias.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Analizando alertas críticas del sistema…</Text>
          </View>
        ) : alerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons color="#10B981" name="shield-checkmark" size={54} />
            <Text style={styles.emptyTitle}>Operación en Estado Óptimo</Text>
            <Text style={styles.emptySubtitle}>
              No hay alertas macro activas. Rutas a tiempo, stock de materias primas asegurado y cero lotes en cuarentena.
            </Text>
          </Card>
        ) : (
          alerts.map((item) => {
            const isDismissed = item.dismissed;
            const isEmergency = item.severity === 'EMERGENCY';

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  isEmergency && styles.cardEmergency,
                  isDismissed && styles.cardDismissed,
                ]}
              >
                {/* CABECERA */}
                <View style={styles.cardHeader}>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        item.category.includes('SANITARIA') && { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
                        item.category.includes('PRODUCCIÓN') && { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
                      ]}
                    >
                      <Ionicons
                        color={
                          item.category.includes('SANITARIA')
                            ? '#EF4444'
                            : item.category.includes('PRODUCCIÓN')
                              ? '#F59E0B'
                              : '#38BDF8'
                        }
                        name={
                          item.category.includes('SANITARIA')
                            ? 'warning'
                            : item.category.includes('PRODUCCIÓN')
                              ? 'cube'
                              : 'git-branch'
                        }
                        size={14}
                      />
                      <Text style={styles.categoryText}>{item.category}</Text>
                    </View>

                    <View
                      style={[
                        styles.severityBadge,
                        isEmergency && styles.severityEmergency,
                        isDismissed && styles.severityDismissed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          isEmergency && { color: '#FFFFFF' },
                          isDismissed && { color: colors.textMuted },
                        ]}
                      >
                        {isDismissed ? 'ATENDIDA' : item.severity}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.title}>{item.title}</Text>
                </View>

                {/* MENSAJE DEL IMPACTO */}
                <Text style={styles.message}>{item.message}</Text>

                {/* DETALLE ENTIDAD AFECTADA Y CAUSA DISPARADORA */}
                <View style={styles.impactBox}>
                  <View style={styles.impactRow}>
                    <Text style={styles.impactLabel}>AFECTADO:</Text>
                    <Text style={styles.impactValue}>{item.affected_entity}</Text>
                  </View>
                  <View style={styles.impactRow}>
                    <Text style={styles.impactLabel}>DETONANTE:</Text>
                    <Text style={styles.impactValue}>{item.trigger_reason}</Text>
                  </View>
                </View>

                {/* ACCIÓN: MARCAR COMO ATENDIDA */}
                {!isDismissed ? (
                  <Pressable
                    onPress={() => handleDismiss(item)}
                    style={({ pressed }) => [
                      styles.btnDismiss,
                      pressed && styles.btnDismissPressed,
                    ]}
                  >
                    <Ionicons color="#FFFFFF" name="checkmark-done" size={18} />
                    <Text style={styles.btnDismissText}>Marcar como Atendida</Text>
                  </Pressable>
                ) : (
                  <View style={styles.dismissedRow}>
                    <Ionicons color={colors.textMuted} name="checkmark-circle-outline" size={16} />
                    <Text style={styles.dismissedText}>Alerta atendida por supervisión</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerText: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl + 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl + 10,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  cardEmergency: {
    borderColor: '#EF4444',
    backgroundColor: '#1C1014',
    shadowColor: '#EF4444',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardDismissed: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  cardHeader: {
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  severityBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  severityEmergency: {
    backgroundColor: '#DC2626',
  },
  severityDismissed: {
    backgroundColor: colors.surfaceAlt,
  },
  severityText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '900',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  impactBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
  },
  impactLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    minWidth: 80,
  },
  impactValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  btnDismiss: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.lg,
  },
  btnDismissPressed: {
    backgroundColor: colors.primary,
  },
  btnDismissText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dismissedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  dismissedText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
