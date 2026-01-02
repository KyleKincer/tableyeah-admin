import { memo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { TimelineReservationBarProps } from './timeline/types'
import {
  STATUS_BAR_COLORS,
  FADED_OPACITY,
  COMPLETED_OPACITY,
  BAR_MIN_HEIGHT,
} from './timeline/constants'

function TimelineReservationBarComponent({
  bar,
  isSelected,
  onPress,
  onLongPress,
}: TimelineReservationBarProps) {
  const [pressed, setPressed] = useState(false)
  const { reservation, isConflict } = bar

  // Determine background color based on status
  const statusColor = STATUS_BAR_COLORS[reservation.status] || Neo.blue

  // Determine opacity for faded states
  const isFaded = reservation.status === 'CANCELLED'
  const isCompleted = reservation.status === 'COMPLETED' || reservation.status === 'NO_SHOW'
  const opacity = isFaded ? FADED_OPACITY : isCompleted ? COMPLETED_OPACITY : 1

  // Text color: dark text for bright backgrounds
  const brightBgs = [Neo.lime, Neo.cyan, Neo.yellow]
  const textColor = brightBgs.includes(statusColor) ? Neo.black : Neo.white

  // Walk-in indicator
  const isWalkIn = reservation.is_walk_in === true

  // Display name (truncated)
  const displayName = reservation.name.length > 12
    ? reservation.name.slice(0, 11) + '…'
    : reservation.name

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const handleLongPress = () => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onLongPress()
    }
  }

  return (
    <Pressable
      style={[
        styles.bar,
        { backgroundColor: statusColor, opacity },
        isConflict && styles.barConflict,
        isSelected && styles.barSelected,
        pressed && styles.barPressed,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      delayLongPress={300}
      accessibilityLabel={`${reservation.name}, ${reservation.covers} guests, ${reservation.status}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: textColor }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {isWalkIn && (
            <View style={styles.walkInBadge}>
              <Text style={styles.walkInText}>W</Text>
            </View>
          )}
        </View>
        <Text style={[styles.covers, { color: textColor }]}>
          {reservation.covers}
        </Text>
      </View>

      {/* Conflict indicator */}
      {isConflict && (
        <View style={styles.conflictBadge}>
          <Text style={styles.conflictText}>!</Text>
        </View>
      )}
    </Pressable>
  )
}

export const TimelineReservationBar = memo(TimelineReservationBarComponent)

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: BAR_MIN_HEIGHT,
    minWidth: 40,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    paddingHorizontal: 6,
    ...NeoShadow.sm,
  },
  barConflict: {
    borderColor: Neo.pink,
    borderWidth: NeoBorder.default,
  },
  barSelected: {
    borderColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    ...NeoShadow.default,
  },
  barPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  name: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  covers: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  walkInBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  walkInText: {
    fontSize: 7,
    fontWeight: '900',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  conflictBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    backgroundColor: Neo.pink,
    borderWidth: 1,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conflictText: {
    fontSize: 9,
    fontWeight: '900',
    color: Neo.black,
  },
})
