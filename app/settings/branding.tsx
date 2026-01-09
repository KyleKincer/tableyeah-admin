import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo } from '@/constants/theme'
import { BrandingSettings } from '@/components/settings/BrandingSettings'

// Exported content component for use in split view
export function BrandingSettingsContent() {
  return <BrandingSettings />
}

// Screen wrapper for standalone navigation
export default function BrandingSettingsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BrandingSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
})
