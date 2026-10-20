import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { MODULE_IDS, canReadModule } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/AuthContext';

export default function TabLayout() {
  const { user } = useSession();

  const showDashboard = canReadModule(user, MODULE_IDS.dashboard);
  const showOrders = canReadModule(user, MODULE_IDS.orders);
  const showInventory = canReadModule(user, MODULE_IDS.inventory);

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
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Panel',
          href: showDashboard ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'grid' : 'grid-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders_delivery"
        options={{
          title: 'Entregas',
          href: showOrders ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'navigate' : 'navigate-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory_recipes"
        options={{
          title: 'Inventario',
          href: showInventory ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'cube' : 'cube-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'settings' : 'settings-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'person' : 'person-outline'} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
