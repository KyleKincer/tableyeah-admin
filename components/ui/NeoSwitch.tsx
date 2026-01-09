import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder } from '@/constants/theme'

interface NeoSwitchProps {
  label: string
  description?: string
  value: boolean
  onToggle: () => void
  disabled?: boolean
}

export function NeoSwitch({
  label,
  description,
  value,
  onToggle,
  disabled,
}: NeoSwitchProps) {
  return (
    <Pressable
      style={styles.switchRow}
      onPress={() => {
        if (!disabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onToggle()
        }
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.switchLabelContainer}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description && <Text style={styles.switchDescription}>{description}</Text>}
      </View>
      <View
        style={[
          styles.switchTrack,
          value ? styles.switchTrackOn : styles.switchTrackOff,
          disabled && styles.switchTrackDisabled,
        ]}
      >
        <View
          style={[
            styles.switchKnob,
            value ? styles.switchKnobOn : styles.switchKnobOff,
          ]}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  switchDescription: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    padding: 3,
  },
  switchTrackOn: {
    backgroundColor: Neo.lime,
  },
  switchTrackOff: {
    backgroundColor: Neo.white,
  },
  switchTrackDisabled: {
    opacity: 0.5,
  },
  switchKnob: {
    width: 24,
    height: 24,
    backgroundColor: Neo.black,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchKnobOff: {
    alignSelf: 'flex-start',
  },
})
