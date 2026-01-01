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

export interface RowPosition {
  y: number
  height: number
}

export interface ContactInfo {
  name: string
  phone?: string | null
  email?: string | null
}

interface ContactActionSheetProps {
  visible: boolean
  contact: ContactInfo | null
  rowPosition: RowPosition | null
  onClose: () => void
}

interface ActionButtonProps {
  label: string
  icon: string
  onPress: () => void
  disabled?: boolean
}

function ActionButton({ label, icon, onPress, disabled }: ActionButtonProps) {
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <Pressable
      style={[
        styles.actionButton,
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
      <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  )
}

const SHEET_HEIGHT_WITH_EMAIL = 240
const SHEET_HEIGHT_PHONE_ONLY = 180
const SHEET_HEIGHT_EMAIL_ONLY = 180
const PADDING = 16

export function ContactActionSheet({ visible, contact, rowPosition, onClose }: ContactActionSheetProps) {
  const { height: screenHeight } = useWindowDimensions()

  const phone = contact?.phone
  const email = contact?.email
  const hasPhone = !!phone
  const hasEmail = !!email
  const hasAnyContact = hasPhone || hasEmail

  // Calculate sheet height based on available actions
  const getSheetHeight = () => {
    if (hasPhone && hasEmail) return SHEET_HEIGHT_WITH_EMAIL
    if (hasPhone) return SHEET_HEIGHT_PHONE_ONLY
    if (hasEmail) return SHEET_HEIGHT_EMAIL_ONLY
    return SHEET_HEIGHT_PHONE_ONLY // fallback
  }

  const sheetHeight = getSheetHeight()

  // Calculate vertical position to center sheet on the row
  const getSheetTop = (): number | undefined => {
    if (!rowPosition) return undefined

    const rowCenter = rowPosition.y + rowPosition.height / 2
    let top = rowCenter - sheetHeight / 2

    const minTop = PADDING
    const maxTop = screenHeight - sheetHeight - PADDING

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

  const handleCopyPhone = async () => {
    if (!phone) return
    await Clipboard.setStringAsync(phone)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied', 'Phone number copied to clipboard')
    onClose()
  }

  const handleEmail = async () => {
    if (!email) return
    const url = `mailto:${email}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      onClose()
    } else {
      Alert.alert('Cannot Send Email', 'Email is not supported on this device.')
    }
  }

  const handleCopyEmail = async () => {
    if (!email) return
    await Clipboard.setStringAsync(email)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied', 'Email copied to clipboard')
    onClose()
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  if (!contact) return null

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
              <Text style={styles.guestName}>{contact.name}</Text>
              {hasPhone && <Text style={styles.contactInfo}>{phone}</Text>}
              {hasEmail && <Text style={styles.contactInfo}>{email}</Text>}
              {!hasAnyContact && (
                <Text style={styles.noContact}>NO CONTACT INFO</Text>
              )}
            </View>

            {/* Phone Actions */}
            {hasPhone && (
              <View style={styles.actions}>
                <ActionButton
                  icon="📞"
                  label="CALL"
                  onPress={handleCall}
                />
                <ActionButton
                  icon="💬"
                  label="TEXT"
                  onPress={handleText}
                />
                <ActionButton
                  icon="📋"
                  label="COPY"
                  onPress={handleCopyPhone}
                />
              </View>
            )}

            {/* Email Actions */}
            {hasEmail && (
              <View style={[styles.actions, !hasPhone && styles.actionsFirst]}>
                <ActionButton
                  icon="✉️"
                  label="EMAIL"
                  onPress={handleEmail}
                />
                <ActionButton
                  icon="📋"
                  label="COPY"
                  onPress={handleCopyEmail}
                />
              </View>
            )}

            {/* No contact message */}
            {!hasAnyContact && (
              <View style={styles.noContactContainer}>
                <Text style={styles.noContactText}>
                  No phone or email on file
                </Text>
              </View>
            )}

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
  contactInfo: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  noContact: {
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
  actionsFirst: {
    // No additional styles needed, just for semantic clarity
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Neo.white,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  actionButtonPressed: {
    backgroundColor: Neo.lime,
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionLabelDisabled: {
    color: Neo.black,
  },
  noContactContainer: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  noContactText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.5,
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
