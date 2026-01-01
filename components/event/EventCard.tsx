import { format } from 'date-fns'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { PaymentModeBadge } from './PaymentBadge'
import type { EventListItem } from '@/lib/types'

interface EventCardProps {
  event: EventListItem
  onPress: () => void
  isSelected?: boolean
}

export function EventCard({ event, onPress, isSelected }: EventCardProps) {
  const [pressed, setPressed] = useState(false)

  const eventDate = new Date(event.date)
  const dateLabel = format(eventDate, 'EEE, MMM d')
  const timeLabel = format(eventDate, 'h:mm a')

  const capacityPercentage = event.capacity > 0
    ? Math.min((event.totalCovers / event.capacity) * 100, 100)
    : 0

  const capacityColor = capacityPercentage < 75
    ? Neo.lime
    : capacityPercentage < 100
      ? Neo.yellow
      : Neo.pink

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Pressable
      style={[
        styles.card,
        pressed && styles.cardPressed,
        isSelected && styles.cardSelected,
        !event.active && styles.cardInactive,
      ]}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${event.name}, ${dateLabel} at ${timeLabel}, ${event.totalCovers} of ${event.capacity} covers`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.cardInner}>
        <View style={styles.dateSection}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
        <View style={styles.detailsSection}>
          <View style={styles.nameRow}>
            <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
            {!event.active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
              </View>
            )}
            {!event.visible && event.active && (
              <View style={styles.hiddenBadge}>
                <Text style={styles.hiddenBadgeText}>HIDDEN</Text>
              </View>
            )}
          </View>
          <View style={styles.capacityRow}>
            <View style={styles.capacityBar}>
              <View
                style={[
                  styles.capacityFill,
                  { width: `${capacityPercentage}%`, backgroundColor: capacityColor },
                ]}
              />
            </View>
            <Text style={styles.capacityText}>
              {event.totalCovers}/{event.capacity}
            </Text>
          </View>
        </View>
        <View style={styles.metaSection}>
          <PaymentModeBadge
            mode={event.paymentMode}
            pricePerPersonCents={event.pricePerPersonCents}
            currency={event.currency}
          />
          <Text style={styles.reservationCount}>
            {event.reservationCount} {event.reservationCount === 1 ? 'res' : 'res'}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  cardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  cardSelected: {
    borderColor: Neo.cyan,
    borderWidth: NeoBorder.thick || 4,
    backgroundColor: Neo.cyan + '20',
  },
  cardInactive: {
    opacity: 0.6,
  },
  cardInner: {
    flexDirection: 'row',
  },
  dateSection: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
    backgroundColor: Neo.yellow,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  detailsSection: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  inactiveBadge: {
    backgroundColor: Neo.black + '40',
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inactiveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hiddenBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hiddenBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  capacityBar: {
    flex: 1,
    height: 8,
    backgroundColor: Neo.black + '20',
    borderWidth: 1,
    borderColor: Neo.black,
  },
  capacityFill: {
    height: '100%',
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaSection: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 14,
    gap: 6,
  },
  reservationCount: {
    fontSize: 10,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
