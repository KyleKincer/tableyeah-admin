import { Tabs } from 'expo-router'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Neo, NeoBorder } from '@/constants/theme'
import { useRestaurantStore } from '@/lib/store/restaurant'
import { useRealtimeInvalidation, useRealtimeContext } from '@/lib/realtime'

function ConnectionStatusDot() {
  const { status } = useRealtimeContext()

  // Only show when not connected
  if (status === 'connected') return null

  const color =
    status === 'connecting' || status === 'reconnecting'
      ? Neo.orange
      : status === 'error'
        ? Neo.pink
        : Neo.black + '40'

  return (
    <View
      style={[styles.connectionDot, { backgroundColor: color }]}
      accessibilityLabel={`Connection status: ${status}`}
    />
  )
}

export default function TabLayout() {
  const restaurantName = useRestaurantStore((state) => state.name)
  const insets = useSafeAreaInsets()

  // Subscribe to realtime events and invalidate React Query caches
  useRealtimeInvalidation()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Neo.black,
        tabBarInactiveTintColor: Neo.black + '60',
        headerShown: true,
        headerStyle: {
          backgroundColor: Neo.white,
          borderBottomWidth: NeoBorder.default,
          borderBottomColor: Neo.black,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 16,
          letterSpacing: -0.5,
          textTransform: 'uppercase',
          color: Neo.black,
        },
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Neo.white,
          borderTopWidth: NeoBorder.default,
          borderTopColor: Neo.black,
          height: 56 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: restaurantName || 'Dashboard',
          headerRight: () => <ConnectionStatusDot />,
          tabBarIcon: ({ color }) => (
            <TabIcon name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          title: 'Service',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon name="fork.knife" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Resos',
          tabBarIcon: ({ color }) => (
            <TabIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: 'Waitlist',
          tabBarIcon: ({ color }) => (
            <TabIcon name="list.clipboard" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => (
            <TabIcon name="star.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: 'Guests',
          tabBarIcon: ({ color }) => (
            <TabIcon name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TabIcon name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  )
}

function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <View style={styles.tabIconContainer}>
      <IconSymbol size={24} name={name as any} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 16,
  },
})
