import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { MODULE_IDS, canReadModule, isAdmin, isWarehouseOperator } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';

export default function TabLayout() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const isAdministrator = isAdmin(user);
  const isWarehouse = isWarehouseOperator(user);
  const showDashboard = !isAdministrator && !isWarehouse && canReadModule(user, MODULE_IDS.dashboard);
  const showOrders = !isAdministrator && !isWarehouse && canReadModule(user, MODULE_IDS.orders);
  const showInventory = !isAdministrator && !isWarehouse && canReadModule(user, MODULE_IDS.inventory);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isAdministrator ? 'Finanzas' : isWarehouse ? 'Bodega' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={String(color)}
              name={
                isAdministrator
                  ? focused
                    ? 'cash'
                    : 'cash-outline'
                  : isWarehouse
                    ? focused
                      ? 'cube'
                      : 'cube-outline'
                    : focused
                      ? 'home'
                      : 'home-outline'
              }
              size={22}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Aprobaciones',
          href: isAdministrator ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={String(color)}
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={22}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="critical_alerts"
        options={{
          title: 'Alertas',
          href: isAdministrator ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={String(color)}
              name={focused ? 'warning' : 'warning-outline'}
              size={22}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Panel',
          href: showDashboard ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={String(color)} name={focused ? 'grid' : 'grid-outline'} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders_delivery"
        options={{
          title: 'Entregas',
          href: showOrders ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={String(color)} name={focused ? 'navigate' : 'navigate-outline'} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="inventory_recipes"
        options={{
          title: 'Inventario',
          href: showInventory ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={String(color)} name={focused ? 'cube' : 'cube-outline'} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={String(color)} name={focused ? 'settings' : 'settings-outline'} size={22} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={String(color)} name={focused ? 'person' : 'person-outline'} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
