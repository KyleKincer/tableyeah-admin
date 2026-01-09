import { useState, useRef } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { Zone } from '@/lib/types'

interface ZoneDropdownProps {
  zones: Zone[]
  selectedZoneId: number
  onSelectZone: (zoneId: number) => void
  disabled?: boolean
}

export function ZoneDropdown({
  zones,
  selectedZoneId,
  onSelectZone,
  disabled,
}: ZoneDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [buttonLayout, setButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const buttonRef = useRef<View>(null)

  // Sort zones by sortOrder
  const sortedZones = [...zones].sort((a, b) => a.sortOrder - b.sortOrder)
  const selectedZone = sortedZones.find(z => z.id === selectedZoneId)

  const handleOpen = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Measure button position for dropdown placement
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setButtonLayout({ x, y, width, height })
      setIsOpen(true)
    })
  }

  const handleSelect = (zoneId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelectZone(zoneId)
    setIsOpen(false)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <>
      <Pressable
        ref={buttonRef}
        style={[
          styles.button,
          isOpen && styles.buttonOpen,
          disabled && styles.buttonDisabled,
        ]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Zone: ${selectedZone?.displayName || 'Select zone'}`}
        accessibilityHint="Opens zone selection menu"
      >
        {selectedZone?.emoji && (
          <Text style={styles.emoji}>{selectedZone.emoji}</Text>
        )}
        <Text style={[styles.buttonText, isOpen && styles.buttonTextOpen]} numberOfLines={1}>
          {selectedZone?.displayName?.toUpperCase() || 'ZONE'}
        </Text>
        <Text style={[styles.chevron, isOpen && styles.chevronOpen, isOpen && styles.buttonTextOpen]}>▼</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View
            style={[
              styles.dropdown,
              buttonLayout && {
                top: buttonLayout.y + buttonLayout.height + 4,
                left: buttonLayout.x,
                minWidth: buttonLayout.width,
              },
            ]}
          >
            {sortedZones.map((zone) => {
              const isSelected = zone.id === selectedZoneId
              return (
                <Pressable
                  key={zone.id}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelect(zone.id)}
                >
                  <Text style={styles.dropdownEmoji}>{zone.emoji || '🍽️'}</Text>
                  <Text style={styles.dropdownText}>{zone.displayName.toUpperCase()}</Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    minWidth: 120,
    ...NeoShadow.sm,
  },
  buttonOpen: {
    backgroundColor: Neo.black,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 14,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonTextOpen: {
    color: Neo.white,
  },
  chevron: {
    fontSize: 8,
    color: Neo.black,
    marginLeft: 2,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  overlay: {
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.lg,
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
  },
  dropdownItemSelected: {
    backgroundColor: Neo.lime + '30',
  },
  dropdownEmoji: {
    fontSize: 18,
  },
  dropdownText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
  },
})
