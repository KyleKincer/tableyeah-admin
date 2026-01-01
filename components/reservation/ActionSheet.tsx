import { useState } from 'react'
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { Reservation } from '@/lib/types'

interface RowPosition {
  y: number
  height: number
}

interface ActionSheetProps {
  visible: boolean
  reservation: Reservation | null
  rowPosition: RowPosition | null
  onClose: () => void
}

interface ActionButtonProps {
  label: string
  icon: string
  onPress: () => void
  disabled?: boolean
  variant?: 'default' | 'secondary'
}

function ActionButton({ label, icon, onPress, disabled, variant = 'default' }: ActionButtonProps) {
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === 'secondary' && styles.actionButtonSecondary,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[
        styles.actionLabel,
        disabled && styles.actionLabelDisabled,
      ]}>
        {label}
      </Text>
    </Pressable>
  )
}

const SHEET_HEIGHT = 180 // Approximate height of the action sheet
const PADDING = 16

export function ReservationActionSheet({ visible, reservation, rowPosition, onClose }: ActionSheetProps) {
  const { height: screenHeight } = useWindowDimensions()
  const phone = reservation?.phone
  const hasPhone = !!phone

  // Calculate vertical position to center sheet on the row
  const getSheetTop = (): number | undefined => {
    if (!rowPosition) return undefined

    // Center the sheet on the row
    const rowCenter = rowPosition.y + rowPosition.height / 2
    let top = rowCenter - SHEET_HEIGHT / 2

    // Clamp to screen bounds with padding
    const minTop = PADDING
    const maxTop = screenHeight - SHEET_HEIGHT - PADDING

    return Math.max(minTop, Math.min(top, maxTop))
  }

  const sheetTop = getSheetTop()

  const handleCall = async () => {
    if (!phone) return
    const url = `tel:${phone}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      onClose()
    } else {
      Alert.alert('Cannot Make Call', 'Phone calls are not supported on this device.')
    }
  }

  const handleText = async () => {
    if (!phone) return
    const url = `sms:${phone}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      onClose()
    } else {
      Alert.alert('Cannot Send Text', 'SMS is not supported on this device.')
    }
  }

  const handleCopy = async () => {
    if (!phone) return
    await Clipboard.setStringAsync(phone)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied', `Phone number copied to clipboard`)
    onClose()
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  if (!reservation) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View
          style={[
            styles.sheetContainer,
            sheetTop !== undefined && {
              position: 'absolute',
              top: sheetTop,
              left: PADDING,
              right: PADDING,
            }
          ]}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.guestName}>{reservation.name}</Text>
              {hasPhone ? (
                <Text style={styles.phone}>{phone}</Text>
              ) : (
                <Text style={styles.noPhone}>NO PHONE ON FILE</Text>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <ActionButton
                icon="📞"
                label="CALL"
                onPress={handleCall}
                disabled={!hasPhone}
              />
              <ActionButton
                icon="💬"
                label="TEXT"
                onPress={handleText}
                disabled={!hasPhone}
              />
              <ActionButton
                icon="📋"
                label="COPY"
                onPress={handleCopy}
                disabled={!hasPhone}
              />
            </View>

            {/* Close button */}
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    padding: PADDING,
  },
  sheet: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.lg,
  },
  header: {
    backgroundColor: Neo.yellow,
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    alignItems: 'center',
  },
  guestName: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  phone: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  noPhone: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.5,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Neo.white,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  actionButtonSecondary: {
    backgroundColor: Neo.cream,
  },
  actionButtonPressed: {
    backgroundColor: Neo.lime,
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionLabelDisabled: {
    color: Neo.black,
  },
  closeButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.white,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
