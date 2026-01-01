import { useAuth, useUser } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useRestaurantStore } from '@/lib/store/restaurant'
import { useDeviceType } from '@/lib/hooks/useDeviceType'

type SettingScreen = 'general' | 'reservations' | 'hours' | 'notifications' | 'tables' | 'servers' | 'table-assignments' | 'guest-tags' | null

function SettingsRow({
  label,
  value,
  onPress,
  destructive,
  selected,
}: {
  label: string
  value?: string | null
  onPress?: () => void
  destructive?: boolean
  selected?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.settingsRow,
        onPress && pressed && styles.settingsRowPressed,
        selected && styles.settingsRowSelected,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={!onPress}
    >
      <Text style={[styles.settingsLabel, destructive && styles.destructiveText]}>
        {label}
      </Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {onPress && !value && <Text style={styles.chevron}>→</Text>}
    </Pressable>
  )
}

function DetailPane({ screen }: { screen: SettingScreen }) {
  if (!screen) {
    return (
      <View style={styles.emptyDetail}>
        <Text style={styles.emptyDetailText}>SELECT A SETTING</Text>
      </View>
    )
  }

  return (
    <View style={styles.detailContent}>
      <Text style={styles.detailPlaceholder}>
        {screen.toUpperCase()} SETTINGS
      </Text>
      <Text style={styles.detailSubtext}>
        Detail view for {screen} will be implemented here
      </Text>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
  const { user } = useUser()
  const restaurant = useRestaurantStore()
  const clearRestaurant = useRestaurantStore((state) => state.clearRestaurant)
  const { isTablet, isLandscape } = useDeviceType()
  const [selectedSetting, setSelectedSetting] = useState<SettingScreen>(null)

  const useSplitView = isTablet && isLandscape

  const handleSwitchRestaurant = () => {
    clearRestaurant()
    router.replace('/(auth)/restaurant-select')
  }

  const handleSignOut = () => {
    Alert.alert('SIGN OUT', 'Are you sure you want to sign out?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'SIGN OUT',
        style: 'destructive',
        onPress: async () => {
          clearRestaurant()
          await signOut()
          router.replace('/(auth)/sign-in')
        },
      },
    ])
  }

  const handleSettingPress = (screen: SettingScreen) => {
    if (useSplitView) {
      setSelectedSetting(screen)
    } else {
      router.push(`/settings/${screen}` as any)
    }
  }

  const menuContent = (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>RESTAURANT</Text>
        <View style={styles.sectionContent}>
          <SettingsRow label="NAME" value={restaurant.name || '—'} />
          <SettingsRow label="ROLE" value={restaurant.role || '—'} />
          <SettingsRow label="ORG" value={restaurant.organizationName || '—'} />
          <SettingsRow label="SWITCH RESTAURANT" onPress={handleSwitchRestaurant} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SETTINGS</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            label="GENERAL"
            onPress={() => handleSettingPress('general')}
            selected={useSplitView && selectedSetting === 'general'}
          />
          <SettingsRow
            label="RESERVATIONS"
            onPress={() => handleSettingPress('reservations')}
            selected={useSplitView && selectedSetting === 'reservations'}
          />
          <SettingsRow
            label="HOURS"
            onPress={() => handleSettingPress('hours')}
            selected={useSplitView && selectedSetting === 'hours'}
          />
          <SettingsRow
            label="NOTIFICATIONS"
            onPress={() => handleSettingPress('notifications')}
            selected={useSplitView && selectedSetting === 'notifications'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MANAGE</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            label="TABLES"
            onPress={() => handleSettingPress('tables')}
            selected={useSplitView && selectedSetting === 'tables'}
          />
          <SettingsRow
            label="SERVERS"
            onPress={() => handleSettingPress('servers')}
            selected={useSplitView && selectedSetting === 'servers'}
          />
          <SettingsRow
            label="TABLE ASSIGNMENTS"
            onPress={() => handleSettingPress('table-assignments')}
            selected={useSplitView && selectedSetting === 'table-assignments'}
          />
          <SettingsRow
            label="GUEST TAGS"
            onPress={() => handleSettingPress('guest-tags')}
            selected={useSplitView && selectedSetting === 'guest-tags'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            label="EMAIL"
            value={user?.primaryEmailAddress?.emailAddress || '—'}
          />
          <SettingsRow label="SIGN OUT" onPress={handleSignOut} destructive />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLogo}>
          <Text style={styles.footerLogoText}>TY</Text>
        </View>
        <Text style={styles.footerText}>TABLEYEAH ADMIN</Text>
        <Text style={styles.footerVersion}>VERSION 1.0.0</Text>
      </View>
    </>
  )

  if (useSplitView) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.splitContainer}>
          <View style={styles.menuPane}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {menuContent}
            </ScrollView>
          </View>
          <View style={styles.detailPane}>
            <DetailPane screen={selectedSetting} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {menuContent}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  menuPane: {
    width: '40%',
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
  },
  detailPane: {
    flex: 1,
    backgroundColor: Neo.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionContent: {
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderBottomWidth: NeoBorder.default,
    borderColor: Neo.black,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.white,
  },
  settingsRowPressed: {
    backgroundColor: Neo.yellow,
  },
  settingsRowSelected: {
    backgroundColor: Neo.lime,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  settingsValue: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  chevron: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
  },
  destructiveText: {
    color: Neo.pink,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    paddingBottom: 16,
  },
  footerLogo: {
    width: 48,
    height: 48,
    backgroundColor: Neo.black,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerLogoText: {
    color: Neo.lime,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -1,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerVersion: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.5,
  },
  emptyDetail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyDetailText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.3,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailContent: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailPlaceholder: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 8,
    letterSpacing: 1,
  },
  detailSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
