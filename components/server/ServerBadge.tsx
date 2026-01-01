import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, getContrastText } from '@/constants/theme'
import type { ServerInfo } from '@/lib/types'

interface ServerBadgeProps {
  server: ServerInfo
  onPress?: () => void
  size?: 'small' | 'default'
}

export function ServerBadge({ server, onPress, size = 'default' }: ServerBadgeProps) {
  const textColor = getContrastText(server.color)
  const isSmall = size === 'small'

  const content = (
    <View style={[styles.badge, isSmall && styles.badgeSmall, { backgroundColor: server.color }]}>
      <Text
        style={[
          styles.badgeText,
          isSmall && styles.badgeTextSmall,
          { color: textColor },
        ]}
      >
        {server.name}
      </Text>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onPress()
        }}
        accessibilityLabel={`Server ${server.name}. Tap to change.`}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    )
  }

  return content
}

interface ServerDotProps {
  color: string
  size?: number
}

export function ServerDot({ color, size = 12 }: ServerDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  )
}

interface AssignServerButtonProps {
  onPress: () => void
}

export function AssignServerButton({ onPress }: AssignServerButtonProps) {
  return (
    <Pressable
      style={styles.assignButton}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      accessibilityLabel="Assign server"
      accessibilityRole="button"
    >
      <Text style={styles.assignButtonText}>+ ASSIGN</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgeTextSmall: {
    fontSize: 9,
  },
  dot: {
    borderWidth: 1,
    borderColor: Neo.black,
  },
  assignButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  assignButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
