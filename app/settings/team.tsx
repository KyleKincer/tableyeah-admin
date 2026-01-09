import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo } from '@/constants/theme'
import { TeamSettings } from '@/components/settings/TeamSettings'

// Exported content component for use in split view
export function TeamSettingsContent() {
  return <TeamSettings />
}

// Screen wrapper for standalone navigation
export default function TeamSettingsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <TeamSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
})
