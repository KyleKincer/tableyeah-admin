import { useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor, getWaitlistStatusColor } from '@/constants/theme'
import type { Reservation, ReservationStatus, WaitlistEntry, WaitlistStatus } from '@/lib/types'

type ActionType =
  | 'confirm'
  | 'seat'
  | 'complete'
  | 'cancel'
  | 'noShow'
  | 'unseat'
  | 'notify'
  | 'remove'

interface ActionConfig {
  label: string
  type: ActionType
  variant: 'primary' | 'secondary' | 'destructive'
}

function getReservationActions(status: ReservationStatus): ActionConfig[] {
  switch (status) {
    case 'BOOKED':
      return [
        { label: 'CANCEL', type: 'cancel', variant: 'destructive' },
        { label: 'CONFIRM', type: 'confirm', variant: 'primary' },
      ]
    case 'CONFIRMED':
      return [
        { label: 'CANCEL', type: 'cancel', variant: 'destructive' },
        { label: 'NO-SHOW', type: 'noShow', variant: 'secondary' },
        { label: 'SEAT', type: 'seat', variant: 'primary' },
      ]
    case 'SEATED':
      return [
        { label: 'UNSEAT', type: 'unseat', variant: 'secondary' },
        { label: 'NO-SHOW', type: 'noShow', variant: 'destructive' },
        { label: 'COMPLETE', type: 'complete', variant: 'primary' },
      ]
    default:
      return []
  }
}

function getWaitlistActions(status: WaitlistStatus, hasPhone: boolean): ActionConfig[] {
  switch (status) {
    case 'WAITING':
      const actions: ActionConfig[] = [
        { label: 'REMOVE', type: 'remove', variant: 'destructive' },
      ]
      if (hasPhone) {
        actions.push({ label: 'NOTIFY', type: 'notify', variant: 'secondary' })
      }
      actions.push({ label: 'SEAT', type: 'seat', variant: 'primary' })
      return actions
    case 'NOTIFIED':
      return [
        { label: 'REMOVE', type: 'remove', variant: 'destructive' },
        { label: 'SEAT', type: 'seat', variant: 'primary' },
      ]
    default:
      return []
  }
}

interface SelectionActionBarProps {
  // Reservation selection
  selectedReservation?: Reservation | null
  onConfirmReservation?: () => void
  onSeatReservation?: () => void
  onCompleteReservation?: () => void
  onCancelReservation?: () => void
  onNoShowReservation?: () => void
  onUnseatReservation?: () => void
  onViewReservationDetails?: () => void

  // Waitlist selection
  selectedWaitlist?: WaitlistEntry | null
  onSeatWaitlist?: () => void
  onNotifyWaitlist?: () => void
  onRemoveWaitlist?: () => void

  // Common
  onClose: () => void
  isLoading?: boolean
}

export function SelectionActionBar({
  selectedReservation,
  onConfirmReservation,
  onSeatReservation,
  onCompleteReservation,
  onCancelReservation,
  onNoShowReservation,
  onUnseatReservation,
  onViewReservationDetails,
  selectedWaitlist,
  onSeatWaitlist,
  onNotifyWaitlist,
  onRemoveWaitlist,
  onClose,
  isLoading = false,
}: SelectionActionBarProps) {
  const insets = useSafeAreaInsets()
  const [pressedAction, setPressedAction] = useState<ActionType | null>(null)

  const isVisible = !!selectedReservation || !!selectedWaitlist

  // Animated styles for the bar
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(isVisible ? 0 : 150, {
          damping: 30,
          stiffness: 800,
        }),
      },
    ],
    opacity: withTiming(isVisible ? 1 : 0, { duration: 50 }),
  }))

  if (!isVisible) return null

  // Determine context info and actions
  let name = ''
  let covers = 0
  let time = ''
  let statusColor = Neo.blue
  let actions: ActionConfig[] = []

  if (selectedReservation) {
    name = selectedReservation.name
    covers = selectedReservation.covers
    time = selectedReservation.time
    statusColor = getStatusColor(selectedReservation.status)
    actions = getReservationActions(selectedReservation.status)
  } else if (selectedWaitlist) {
    name = selectedWaitlist.name
    covers = selectedWaitlist.covers
    time = selectedWaitlist.time || 'ANY'
    statusColor = getWaitlistStatusColor(selectedWaitlist.status)
    actions = getWaitlistActions(selectedWaitlist.status, !!selectedWaitlist.phone)
  }

  const handleAction = (action: ActionConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (selectedReservation) {
      switch (action.type) {
        case 'confirm':
          onConfirmReservation?.()
          break
        case 'seat':
          onSeatReservation?.()
          break
        case 'complete':
          onCompleteReservation?.()
          break
        case 'cancel':
          onCancelReservation?.()
          break
        case 'noShow':
          onNoShowReservation?.()
          break
        case 'unseat':
          onUnseatReservation?.()
          break
      }
    } else if (selectedWaitlist) {
      switch (action.type) {
        case 'seat':
          onSeatWaitlist?.()
          break
        case 'notify':
          onNotifyWaitlist?.()
          break
        case 'remove':
          onRemoveWaitlist?.()
          break
      }
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const getButtonStyle = (action: ActionConfig) => {
    const isPressed = pressedAction === action.type

    const variantStyle = action.variant === 'primary'
      ? styles.actionButtonPrimary
      : action.variant === 'destructive'
        ? styles.actionButtonDestructive
        : styles.actionButtonSecondary

    return [
      styles.actionButton,
      variantStyle,
      isPressed && styles.actionButtonPressed,
    ]
  }

  // Format time for display
  const formatTime = (timeStr: string) => {
    if (timeStr === 'ANY') return 'ANY TIME'
    try {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    } catch {
      return timeStr
    }
  }

  // Get contact info
  const phone = selectedReservation?.phone || selectedWaitlist?.phone
  const email = selectedReservation?.email || selectedWaitlist?.email

  const handleCall = () => {
    if (!phone) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Linking.openURL(`tel:${phone}`)
  }

  const handleEmail = () => {
    if (!email) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Linking.openURL(`mailto:${email}`)
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 16) },
        animatedStyle,
      ]}
    >
      {/* Close button */}
      <Pressable
        style={styles.closeButton}
        onPress={handleClose}
        accessibilityLabel="Close action bar"
        accessibilityRole="button"
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>

      {/* Contact and view buttons */}
      <View style={styles.contactButtons}>
        {selectedReservation && onViewReservationDetails && (
          <Pressable
            style={styles.contactButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onViewReservationDetails()
            }}
            accessibilityLabel="View reservation details"
            accessibilityRole="button"
          >
            <Text style={styles.contactButtonText}>↗</Text>
          </Pressable>
        )}
        {phone && (
          <Pressable
            style={styles.contactButton}
            onPress={handleCall}
            accessibilityLabel={`Call ${name}`}
            accessibilityRole="button"
          >
            <Text style={styles.contactButtonText}>📞</Text>
          </Pressable>
        )}
        {email && (
          <Pressable
            style={styles.contactButton}
            onPress={handleEmail}
            accessibilityLabel={`Email ${name}`}
            accessibilityRole="button"
          >
            <Text style={styles.contactButtonText}>✉️</Text>
          </Pressable>
        )}
      </View>

      {/* Context info */}
      <View style={styles.contextInfo}>
        <View style={styles.contextRow}>
          <Text style={styles.guestName} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <View style={styles.contextDetails}>
          <Text style={styles.detailText}>{covers} GUESTS</Text>
          <Text style={styles.detailSeparator}>•</Text>
          <Text style={styles.detailText}>{formatTime(time)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Neo.black} />
          </View>
        ) : (
          actions.map((action) => (
            <Pressable
              key={action.type}
              style={getButtonStyle(action)}
              onPress={() => handleAction(action)}
              onPressIn={() => setPressedAction(action.type)}
              onPressOut={() => setPressedAction(null)}
              accessibilityLabel={action.label}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.actionButtonText,
                  action.variant === 'primary' && styles.actionButtonTextPrimary,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Neo.cream,
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 12,
    // Inverted shadow (upward)
    shadowColor: Neo.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    marginTop: -4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  contactButton: {
    width: 40,
    height: 40,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  contactButtonText: {
    fontSize: 16,
  },
  contextInfo: {
    flex: 1,
    minWidth: 0,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  contextDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  detailText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  detailSeparator: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingContainer: {
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  actionButtonPrimary: {
    backgroundColor: Neo.lime,
  },
  actionButtonSecondary: {
    backgroundColor: Neo.white,
  },
  actionButtonDestructive: {
    backgroundColor: Neo.pink,
  },
  actionButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  actionButtonTextPrimary: {
    fontWeight: '900',
  },
})
