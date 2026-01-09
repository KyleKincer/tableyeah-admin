import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo } from '@/constants/theme'
import { BillingSettings } from '@/components/settings/BillingSettings'

// Exported content component for use in split view
export function BillingSettingsContent() {
  return <BillingSettings />
}

// Screen wrapper for standalone navigation
export default function BillingSettingsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BillingSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
})
