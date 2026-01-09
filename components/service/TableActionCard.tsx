import { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor, getWaitlistStatusColor } from '@/constants/theme'
import type { Reservation, ReservationStatus, WaitlistEntry, WaitlistStatus, TableWithStatus } from '@/lib/types'

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
        { label: 'CONFIRM', type: 'confirm', variant: 'primary' },
        { label: 'CANCEL', type: 'cancel', variant: 'destructive' },
      ]
    case 'CONFIRMED':
      return [
        { label: 'SEAT', type: 'seat', variant: 'primary' },
        { label: 'NO-SHOW', type: 'noShow', variant: 'secondary' },
        { label: 'CANCEL', type: 'cancel', variant: 'destructive' },
      ]
    case 'SEATED':
      return [
        { label: 'COMPLETE', type: 'complete', variant: 'primary' },
        { label: 'UNSEAT', type: 'unseat', variant: 'secondary' },
        { label: 'NO-SHOW', type: 'noShow', variant: 'destructive' },
      ]
    default:
      return []
  }
}

function getWaitlistActions(status: WaitlistStatus, hasPhone: boolean): ActionConfig[] {
  switch (status) {
    case 'WAITING':
      const actions: ActionConfig[] = [
        { label: 'SEAT', type: 'seat', variant: 'primary' },
      ]
      if (hasPhone) {
        actions.push({ label: 'NOTIFY', type: 'notify', variant: 'secondary' })
      }
      actions.push({ label: 'REMOVE', type: 'remove', variant: 'destructive' })
      return actions
    case 'NOTIFIED':
      return [
        { label: 'SEAT', type: 'seat', variant: 'primary' },
        { label: 'REMOVE', type: 'remove', variant: 'destructive' },
      ]
    default:
      return []
  }
}

// Position relative to anchor point
interface AnchorPosition {
  x: number
  y: number
}

interface TableActionCardProps {
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

  // Available table selection (for walk-in)
  selectedTable?: TableWithStatus | null
  onSeatWalkIn?: (partySize: number) => void

  // Positioning
  anchorPosition: AnchorPosition | null

  // Common
  onClose: () => void
  isLoading?: boolean
}

// Card dimensions (approximate for positioning calculation)
const CARD_WIDTH = 220
const CARD_HEIGHT = 180 // Will be measured dynamically
const MARGIN = 12
const TABLE_RADIUS = 35 // Approximate radius of table for offset

export function TableActionCard({
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
  selectedTable,
  onSeatWalkIn,
  anchorPosition,
  onClose,
  isLoading = false,
}: TableActionCardProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [pressedAction, setPressedAction] = useState<ActionType | null>(null)
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: CARD_HEIGHT })
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null)
  const [pressedPartySize, setPressedPartySize] = useState<number | null>(null)
  const [guestInfoPressed, setGuestInfoPressed] = useState(false)

  // Determine if this is an available table (for walk-in UI)
  const isAvailableTable = selectedTable?.status === 'available' && !selectedReservation && !selectedWaitlist

  const isVisible = (!!selectedReservation || !!selectedWaitlist || isAvailableTable) && !!anchorPosition

  // Reset party size when card closes or table changes
  useEffect(() => {
    if (!isVisible) {
      setSelectedPartySize(null)
    }
  }, [isVisible, selectedTable?.id])

  // Animated values
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.9)

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 100 })
      scale.value = withSpring(1, { damping: 40, stiffness: 1500 })
    } else {
      opacity.value = withTiming(0, { duration: 80 })
      scale.value = withTiming(0.9, { duration: 80 })
    }
  }, [isVisible])

  // Calculate position to stay on screen
  const calculatePosition = useCallback(() => {
    if (!anchorPosition) return { x: 0, y: 0 }

    const { x: anchorX, y: anchorY } = anchorPosition
    let x: number
    let y: number

    // Try positioning to the right of the anchor
    x = anchorX + TABLE_RADIUS + MARGIN

    // If would overflow right, position to the left
    if (x + cardSize.width > screenWidth - insets.right - MARGIN) {
      x = anchorX - TABLE_RADIUS - MARGIN - cardSize.width
    }

    // If would overflow left too, center it
    if (x < insets.left + MARGIN) {
      x = Math.max(insets.left + MARGIN, (screenWidth - cardSize.width) / 2)
    }

    // Vertical: center on anchor, but clamp to screen
    y = anchorY - cardSize.height / 2

    // Clamp to stay within safe area
    const minY = insets.top + MARGIN + 60 // Account for header/stats bar
    const maxY = screenHeight - insets.bottom - cardSize.height - MARGIN
    y = Math.max(minY, Math.min(maxY, y))

    return { x, y }
  }, [anchorPosition, cardSize, screenWidth, screenHeight, insets])

  const position = calculatePosition()

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width !== cardSize.width || height !== cardSize.height) {
      setCardSize({ width, height })
    }
  }

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

    const variantStyle =
      action.variant === 'primary'
        ? styles.actionButtonPrimary
        : action.variant === 'destructive'
          ? styles.actionButtonDestructive
          : styles.actionButtonSecondary

    return [styles.actionButton, variantStyle, isPressed && styles.actionButtonPressed]
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

  // Handle party size selection for walk-in
  const handleSelectPartySize = (size: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedPartySize(size)
  }

  // Handle walk-in seat action
  const handleSeatWalkIn = () => {
    if (!selectedPartySize || !onSeatWalkIn) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSeatWalkIn(selectedPartySize)
  }

  // Generate party size options based on table capacity
  const getPartySizeOptions = () => {
    if (!selectedTable) return [1, 2, 3, 4, 5, 6]
    const maxCapacity = selectedTable.max_capacity || 6
    const sizes: number[] = []
    for (let i = 1; i <= Math.min(maxCapacity, 8); i++) {
      sizes.push(i)
    }
    return sizes
  }

  // Render walk-in UI for available tables
  if (isAvailableTable && selectedTable) {
    const partySizes = getPartySizeOptions()

    return (
      <Animated.View
        style={[
          styles.container,
          {
            left: position.x,
            top: position.y,
          },
          animatedStyle,
        ]}
        onLayout={handleCardLayout}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.guestName} numberOfLines={1}>
              TABLE {selectedTable.table_number}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: Neo.lime }]} />
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityLabel="Close action card"
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        </View>

        {/* Details row */}
        <View style={styles.detailsRow}>
          <Text style={styles.detailText}>
            SEATS {selectedTable.min_capacity === selectedTable.max_capacity
              ? selectedTable.max_capacity
              : `${selectedTable.min_capacity}-${selectedTable.max_capacity}`}
          </Text>
          <Text style={styles.detailSeparator}>•</Text>
          <Text style={styles.detailText}>AVAILABLE</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Walk-in label */}
        <Text style={styles.walkInLabel}>WALK-IN PARTY SIZE</Text>

        {/* Party size grid */}
        <View style={styles.partySizeGrid}>
          {partySizes.map((size) => {
            const isSelected = selectedPartySize === size
            const isPressed = pressedPartySize === size
            return (
              <Pressable
                key={size}
                style={[
                  styles.partySizeButton,
                  isSelected && styles.partySizeButtonSelected,
                  isPressed && styles.partySizeButtonPressed,
                ]}
                onPress={() => handleSelectPartySize(size)}
                onPressIn={() => setPressedPartySize(size)}
                onPressOut={() => setPressedPartySize(null)}
                accessibilityLabel={`${size} ${size === 1 ? 'guest' : 'guests'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.partySizeText,
                    isSelected && styles.partySizeTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Seat button */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Neo.black} />
          </View>
        ) : (
          <Pressable
            style={[
              styles.seatWalkInButton,
              !selectedPartySize && styles.seatWalkInButtonDisabled,
            ]}
            onPress={handleSeatWalkIn}
            disabled={!selectedPartySize}
            accessibilityLabel={selectedPartySize ? `Seat ${selectedPartySize} guests` : 'Select party size first'}
            accessibilityRole="button"
          >
            <Text style={styles.seatWalkInButtonText}>
              {selectedPartySize ? `SEAT ${selectedPartySize} ${selectedPartySize === 1 ? 'GUEST' : 'GUESTS'}` : 'SELECT SIZE'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    )
  }

  // Render reservation/waitlist UI
  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: position.x,
          top: position.y,
        },
        animatedStyle,
      ]}
      onLayout={handleCardLayout}
    >
      {/* Header row with close button */}
      <View style={styles.header}>
        {/* Tappable guest info area - tap to view details */}
        {selectedReservation && onViewReservationDetails ? (
          <Pressable
            style={[
              styles.guestInfoTappable,
              guestInfoPressed && styles.guestInfoPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onViewReservationDetails()
            }}
            onPressIn={() => setGuestInfoPressed(true)}
            onPressOut={() => setGuestInfoPressed(false)}
            accessibilityLabel={`View details for ${name}`}
            accessibilityRole="button"
            accessibilityHint="Opens full reservation details"
          >
            <View style={styles.guestInfoContent}>
              <View style={styles.headerInfo}>
                <Text style={styles.guestName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailText}>{covers} GUESTS</Text>
                <Text style={styles.detailSeparator}>•</Text>
                <Text style={styles.detailText}>{formatTime(time)}</Text>
              </View>
            </View>
            {/* Chevron indicator */}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : (
          <View style={styles.guestInfoStatic}>
            <View style={styles.headerInfo}>
              <Text style={styles.guestName} numberOfLines={1}>
                {name}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailText}>{covers} GUESTS</Text>
              <Text style={styles.detailSeparator}>•</Text>
              <Text style={styles.detailText}>{formatTime(time)}</Text>
            </View>
          </View>
        )}
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close action card"
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Actions grid */}
      <View style={styles.actionsGrid}>
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

      {/* Contact row - only show if there are contact options */}
      {(phone || email) && (
        <>
          <View style={styles.divider} />
          <View style={styles.contactRow}>
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
        </>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    minWidth: 200,
    maxWidth: 260,
    ...NeoShadow.default,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  guestInfoTappable: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginLeft: -6,
    marginVertical: -4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestInfoPressed: {
    backgroundColor: Neo.yellow + '40',
  },
  guestInfoContent: {
    flex: 1,
    minWidth: 0,
  },
  guestInfoStatic: {
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '400',
    color: Neo.black,
    opacity: 0.35,
    marginLeft: 6,
    marginTop: -2,
  },
  guestName: {
    fontSize: 15,
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
  closeButton: {
    width: 28,
    height: 28,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    marginTop: -2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
  divider: {
    height: 1,
    backgroundColor: Neo.black,
    opacity: 0.2,
    marginVertical: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  contactButtonText: {
    fontSize: 14,
  },
  // Walk-in UI styles
  walkInLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 8,
    opacity: 0.7,
  },
  partySizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  partySizeButton: {
    width: 40,
    height: 40,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  partySizeButtonSelected: {
    backgroundColor: Neo.cyan,
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  partySizeButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  partySizeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  partySizeTextSelected: {
    fontWeight: '900',
  },
  seatWalkInButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  seatWalkInButtonDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  seatWalkInButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
