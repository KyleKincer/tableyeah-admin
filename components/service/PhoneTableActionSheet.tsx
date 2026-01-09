import { useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
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

interface PhoneTableActionSheetProps {
  visible: boolean

  // What's selected - exactly one will be set
  selectedTable: TableWithStatus | null // For available table (walk-in)
  selectedReservation: Reservation | null // For occupied table
  selectedWaitlist: WaitlistEntry | null // For waitlist seating

  // Actions for reservations
  onConfirmReservation?: () => void
  onSeatReservation?: () => void
  onCompleteReservation?: () => void
  onCancelReservation?: () => void
  onNoShowReservation?: () => void
  onUnseatReservation?: () => void
  onViewReservationDetails?: () => void

  // Actions for waitlist
  onSeatWaitlist?: () => void
  onNotifyWaitlist?: () => void
  onRemoveWaitlist?: () => void

  // Actions for available table (walk-in)
  onSeatWalkIn?: (partySize: number) => void

  onClose: () => void
  isLoading?: boolean
}

export function PhoneTableActionSheet({
  visible,
  selectedTable,
  selectedReservation,
  selectedWaitlist,
  onConfirmReservation,
  onSeatReservation,
  onCompleteReservation,
  onCancelReservation,
  onNoShowReservation,
  onUnseatReservation,
  onViewReservationDetails,
  onSeatWaitlist,
  onNotifyWaitlist,
  onRemoveWaitlist,
  onSeatWalkIn,
  onClose,
  isLoading = false,
}: PhoneTableActionSheetProps) {
  const [pressedAction, setPressedAction] = useState<ActionType | null>(null)
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null)
  const [pressedPartySize, setPressedPartySize] = useState<number | null>(null)
  const [detailsPressed, setDetailsPressed] = useState(false)

  // Determine which mode we're in
  const isAvailableTable = selectedTable?.status === 'available' && !selectedReservation && !selectedWaitlist
  const hasReservation = !!selectedReservation
  const hasWaitlist = !!selectedWaitlist

  // Reset party size when sheet closes
  const handleClose = () => {
    setSelectedPartySize(null)
    onClose()
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

  // Handle action button press
  const handleAction = (action: ActionConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (hasReservation) {
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
    } else if (hasWaitlist) {
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
    for (let i = 1; i <= Math.min(maxCapacity, 6); i++) {
      sizes.push(i)
    }
    return sizes
  }

  // Contact handlers
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

  // Render available table (walk-in) UI
  if (isAvailableTable && selectedTable) {
    const partySizes = getPartySizeOptions()

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <Text style={styles.title}>TABLE {selectedTable.table_number}</Text>
                <View style={[styles.statusBadge, { backgroundColor: Neo.lime }]}>
                  <Text style={styles.statusBadgeText}>AVAILABLE</Text>
                </View>
              </View>
              <Pressable style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            {/* Capacity info */}
            <Text style={styles.capacityText}>
              SEATS {selectedTable.min_capacity === selectedTable.max_capacity
                ? selectedTable.max_capacity
                : `${selectedTable.min_capacity}-${selectedTable.max_capacity}`}
            </Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Walk-in label */}
            <Text style={styles.sectionLabel}>WALK-IN PARTY SIZE</Text>

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
                  styles.primaryButton,
                  !selectedPartySize && styles.primaryButtonDisabled,
                ]}
                onPress={handleSeatWalkIn}
                disabled={!selectedPartySize}
                accessibilityLabel={selectedPartySize ? `Seat ${selectedPartySize} guests` : 'Select party size first'}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>
                  {selectedPartySize
                    ? `SEAT ${selectedPartySize} ${selectedPartySize === 1 ? 'GUEST' : 'GUESTS'}`
                    : 'SELECT SIZE'}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    )
  }

  // Render reservation or waitlist UI
  if (!hasReservation && !hasWaitlist) return null

  let name = ''
  let covers = 0
  let time = ''
  let statusColor = Neo.blue
  let status = ''
  let actions: ActionConfig[] = []
  let tableNumbers = ''

  if (hasReservation && selectedReservation) {
    name = selectedReservation.name
    covers = selectedReservation.covers
    time = selectedReservation.time
    statusColor = getStatusColor(selectedReservation.status)
    status = selectedReservation.status
    actions = getReservationActions(selectedReservation.status)
    tableNumbers = selectedReservation.table_numbers?.join(', ') || '—'
  } else if (hasWaitlist && selectedWaitlist) {
    name = selectedWaitlist.name
    covers = selectedWaitlist.covers
    time = selectedWaitlist.time || 'ANY'
    statusColor = getWaitlistStatusColor(selectedWaitlist.status)
    status = selectedWaitlist.status
    actions = getWaitlistActions(selectedWaitlist.status, !!selectedWaitlist.phone)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {/* Details */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailText}>{covers} GUESTS</Text>
            <Text style={styles.detailSeparator}>•</Text>
            <Text style={styles.detailText}>{formatTime(time)}</Text>
            {hasReservation && (
              <>
                <Text style={styles.detailSeparator}>•</Text>
                <Text style={styles.detailText}>T{tableNumbers}</Text>
              </>
            )}
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor }]}>
            <Text style={[
              styles.statusBadgeLargeText,
              [Neo.lime, Neo.cyan, Neo.yellow].includes(statusColor) && { color: Neo.black }
            ]}>
              {status}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Actions */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Neo.black} />
            </View>
          ) : (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
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
              ))}
            </View>
          )}

          {/* Contact and details row */}
          {(phone || email || (hasReservation && onViewReservationDetails)) && (
            <>
              <View style={styles.divider} />
              <View style={styles.bottomRow}>
                {/* Contact buttons */}
                {(phone || email) && (
                  <View style={styles.contactButtons}>
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
                )}

                {/* View details button */}
                {hasReservation && onViewReservationDetails && (
                  <Pressable
                    style={[
                      styles.detailsButton,
                      detailsPressed && styles.detailsButtonPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onViewReservationDetails()
                    }}
                    onPressIn={() => setDetailsPressed(true)}
                    onPressOut={() => setDetailsPressed(false)}
                    accessibilityLabel={`View details for ${name}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.detailsButtonText}>VIEW DETAILS</Text>
                    <Text style={styles.detailsChevron}>›</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    marginTop: -2,
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  detailSeparator: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
  },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    marginBottom: 4,
  },
  statusBadgeLargeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Neo.black,
    opacity: 0.2,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.6,
  },
  partySizeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  partySizeButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  partySizeButtonSelected: {
    backgroundColor: Neo.lime,
    ...NeoShadow.default,
  },
  partySizeButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  partySizeText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
  },
  partySizeTextSelected: {
    color: Neo.black,
  },
  loadingContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  primaryButtonDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  actionButtonTextPrimary: {
    fontWeight: '900',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 44,
    height: 44,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  contactButtonText: {
    fontSize: 18,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    ...NeoShadow.sm,
  },
  detailsButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  detailsButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  detailsChevron: {
    fontSize: 18,
    fontWeight: '400',
    color: Neo.black,
    marginTop: -1,
  },
})
