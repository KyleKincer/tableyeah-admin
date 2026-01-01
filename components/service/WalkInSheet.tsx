import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'

// Emoji names for walk-ins
const WALK_IN_EMOJIS = [
  '🦊', '🐻', '🦁', '🐯', '🐸', '🦉', '🦋', '🐝',
  '🌸', '🌻', '🍄', '🌵', '⭐', '🌙', '🔥', '💎',
  '🍀', '🌈', '🎸', '🎨', '🚀', '⚡', '🎯', '🎪',
]

export function generateWalkInName(): string {
  const emoji = WALK_IN_EMOJIS[Math.floor(Math.random() * WALK_IN_EMOJIS.length)]
  return `${emoji} Walk-in`
}

interface WalkInSheetProps {
  visible: boolean
  tableNumber?: string
  tableId?: number
  onClose: () => void
  onSeat: (partySize: number, tableId?: number) => void
  onSelectFromFloorPlan?: (partySize: number) => void
  showFloorPlanOption?: boolean
  isLoading?: boolean
}

export function WalkInSheet({
  visible,
  tableNumber,
  tableId,
  onClose,
  onSeat,
  onSelectFromFloorPlan,
  showFloorPlanOption = false,
  isLoading = false,
}: WalkInSheetProps) {
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [customSize, setCustomSize] = useState(7)

  const handleSizePress = (size: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedSize(size)
  }

  const handleSeat = () => {
    if (selectedSize === null) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onSeat(selectedSize, tableId)
  }

  const handleClose = () => {
    setSelectedSize(null)
    onClose()
  }

  const incrementCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCustomSize((s) => Math.min(s + 1, 20))
    setSelectedSize(Math.min(customSize + 1, 20))
  }

  const decrementCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCustomSize((s) => Math.max(s - 1, 7))
    setSelectedSize(Math.max(customSize - 1, 7))
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
            <Text style={styles.title}>WALK-IN</Text>
            {tableNumber && (
              <View style={styles.tableBadge}>
                <Text style={styles.tableBadgeText}>TABLE {tableNumber}</Text>
              </View>
            )}
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {/* Party size label */}
          <Text style={styles.label}>PARTY SIZE</Text>

          {/* Quick size buttons (1-6) */}
          <View style={styles.sizeGrid}>
            {[1, 2, 3, 4, 5, 6].map((size) => (
              <Pressable
                key={size}
                style={[
                  styles.sizeButton,
                  selectedSize === size && styles.sizeButtonSelected,
                ]}
                onPress={() => handleSizePress(size)}
              >
                <Text
                  style={[
                    styles.sizeButtonText,
                    selectedSize === size && styles.sizeButtonTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Large party picker (7+) */}
          <View style={styles.largePartyRow}>
            <Text style={styles.largePartyLabel}>LARGE PARTY:</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperButton} onPress={decrementCustom}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.stepperValue,
                  selectedSize === customSize && selectedSize >= 7 && styles.stepperValueSelected,
                ]}
                onPress={() => handleSizePress(customSize)}
              >
                <Text
                  style={[
                    styles.stepperValueText,
                    selectedSize === customSize && selectedSize >= 7 && styles.stepperValueTextSelected,
                  ]}
                >
                  {customSize}
                </Text>
              </Pressable>
              <Pressable style={styles.stepperButton} onPress={incrementCustom}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {/* Select from floor plan button (when available and no table pre-selected) */}
            {showFloorPlanOption && !tableId && (
              <Pressable
                style={[
                  styles.floorPlanButton,
                  selectedSize === null && styles.seatButtonDisabled,
                ]}
                onPress={() => {
                  if (selectedSize !== null && onSelectFromFloorPlan) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    onSelectFromFloorPlan(selectedSize)
                    handleClose()
                  }
                }}
                disabled={selectedSize === null}
              >
                <Text style={styles.floorPlanButtonText}>
                  {selectedSize !== null
                    ? 'SELECT TABLE ON FLOOR PLAN'
                    : 'SELECT SIZE FIRST'}
                </Text>
              </Pressable>
            )}

            {/* Seat button */}
            <Pressable
              style={[
                styles.seatButton,
                selectedSize === null && styles.seatButtonDisabled,
                isLoading && styles.seatButtonLoading,
              ]}
              onPress={handleSeat}
              disabled={selectedSize === null || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Neo.black} />
              ) : (
                <Text style={styles.seatButtonText}>
                  {tableId && selectedSize !== null
                    ? `SEAT AT TABLE ${tableNumber}`
                    : selectedSize !== null
                      ? `SEAT ${selectedSize} ${selectedSize === 1 ? 'GUEST' : 'GUESTS'} (AUTO)`
                      : 'SELECT SIZE'}
                </Text>
              )}
            </Pressable>
          </View>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
    flex: 1,
  },
  tableBadge: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  tableBadgeText: {
    fontSize: 11,
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
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.6,
  },
  sizeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sizeButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  sizeButtonSelected: {
    backgroundColor: Neo.lime,
    ...NeoShadow.default,
  },
  sizeButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
  },
  sizeButtonTextSelected: {
    color: Neo.black,
  },
  largePartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  largePartyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  stepperButton: {
    width: 44,
    height: 44,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
  },
  stepperValue: {
    width: 60,
    height: 44,
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.thin,
    borderBottomWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueSelected: {
    backgroundColor: Neo.lime,
  },
  stepperValueText: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
  },
  stepperValueTextSelected: {
    color: Neo.black,
  },
  actionButtons: {
    gap: 10,
  },
  floorPlanButton: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  floorPlanButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  seatButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  seatButtonDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  seatButtonLoading: {
    backgroundColor: Neo.yellow,
  },
  seatButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
