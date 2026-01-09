import { ScrollView, StyleSheet, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MoreMenuItem } from '@/components/ui/MoreMenuItem'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import { Neo, NeoBorder } from '@/constants/theme'
import { IconSymbolName } from '@/components/ui/icon-symbol'

interface MenuItem {
  label: string
  icon: IconSymbolName
  route: string
}

export default function MoreScreen() {
  const { isTablet } = useDeviceType()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const menuItems: MenuItem[] = [
    // Phone-only: Home (dashboard is a tab on tablet)
    ...(!isTablet ? [{ label: 'Home', icon: 'house.fill' as IconSymbolName, route: '/(tabs)' }] : []),
    // Tablet-only: Waitlist (waitlist is a tab on phone)
    ...(isTablet ? [{ label: 'Waitlist', icon: 'list.clipboard' as IconSymbolName, route: '/(tabs)/waitlist' }] : []),
    // Always shown
    { label: 'Events', icon: 'star.fill' as IconSymbolName, route: '/(tabs)/events' },
    { label: 'Commerce', icon: 'cart.fill' as IconSymbolName, route: '/(tabs)/commerce' },
    { label: 'Settings', icon: 'gearshape.fill' as IconSymbolName, route: '/(tabs)/settings' },
  ]

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <MoreMenuItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  content: {
    paddingTop: 16,
  },
  menuList: {
    gap: 0,
  },
})
