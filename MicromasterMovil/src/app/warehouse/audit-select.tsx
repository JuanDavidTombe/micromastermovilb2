import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/constants/theme';

export default function WarehouseAuditSelectScreen() {
  const insets = useSafeAreaInsets();

  const handleSelectMission = (nature: 'INSUMO' | 'PRODUCTO_TERMINADO') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    router.push({
      pathname: '/warehouse/audit',
      params: { nature },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* CABECERA */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons color="#FFFFFF" name="arrow-back" size={24} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Auditoría de Inventario</Text>
          <Text style={styles.headerSub}>Selección de Misión de Conteo</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>MISIÓN</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* PREGUNTA ORIENTADORA */}
        <View style={styles.promptCard}>
          <Text style={styles.promptQuestion}>¿Qué vas a auditar hoy?</Text>
          <Text style={styles.promptDesc}>
            Selecciona el tipo de inventario físico para cargar la lista guiada limpia, sin saturación visual.
          </Text>
        </View>

        {/* ==============================================================
            BOTÓN GIGANTE 1: INSUMOS / MATERIA PRIMA (MODO BÁSCULA)
            ============================================================== */}
        <Pressable
          onPress={() => handleSelectMission('INSUMO')}
          style={({ pressed }) => [
            styles.giantMissionBtn,
            styles.missionBtnInsumos,
            pressed && styles.missionBtnPressed,
          ]}
        >
          <View style={styles.btnContentRow}>
            <View style={[styles.iconContainer, { backgroundColor: '#064E3B' }]}>
              <Ionicons color="#34D399" name="scale" size={42} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.missionTitle}>[ 🌾 Insumos / MP ]</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>Modo Báscula</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>
                Carnes (bola negra, pernil), pollo a granel, costales de arroz y canecas.
              </Text>
              <View style={styles.ruleNoticeRow}>
                <Ionicons color="#A7F3D0" name="checkmark-done" size={14} />
                <Text style={styles.ruleNoticeText}>
                  Captura de Peso Neto en Kg / Litros · Cero Unidades
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* ==============================================================
            BOTÓN GIGANTE 2: PRODUCTO TERMINADO / DISTRIBUIDORA (MODO CONTEO)
            ============================================================== */}
        <Pressable
          onPress={() => handleSelectMission('PRODUCTO_TERMINADO')}
          style={({ pressed }) => [
            styles.giantMissionBtn,
            styles.missionBtnPT,
            pressed && styles.missionBtnPressed,
          ]}
        >
          <View style={styles.btnContentRow}>
            <View style={[styles.iconContainer, { backgroundColor: '#0C4A6E' }]}>
              <Ionicons color="#38BDF8" name="cube" size={42} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.missionTitle}>[ 📦 Producto Terminado ]</Text>
                <View style={styles.badgeBlue}>
                  <Text style={styles.badgeBlueText}>Modo Conteo</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>
                Embutidos empacados, pacas de gaseosa, aceites embotellados y snacks.
              </Text>
              <View style={styles.ruleNoticeRow}>
                <Ionicons color="#BAE6FD" name="checkmark-done" size={14} />
                <Text style={styles.ruleNoticeText}>
                  Checklist en Cajas / Pacas Cerradas · Cero Báscula
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerBadge: {
    backgroundColor: '#78350F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  headerBadgeText: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    gap: 20,
  },
  promptCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  promptQuestion: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  promptDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  giantMissionBtn: {
    borderRadius: radius.xl,
    padding: spacing.md,
    minHeight: 140,
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 2,
  },
  missionBtnInsumos: {
    backgroundColor: '#022C22',
    borderColor: '#10B981',
  },
  missionBtnPT: {
    backgroundColor: '#082F49',
    borderColor: '#38BDF8',
  },
  missionBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  missionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  badgeGreen: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  badgeGreenText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeBlue: {
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  badgeBlueText: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800',
  },
  missionDesc: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  ruleNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ruleNoticeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
});
