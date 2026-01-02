import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useZonesData } from '@/lib/api/queries'
import {
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
  useUpdateZoneBookingRules,
  useCreateZoneGroup,
  useUpdateZoneGroup,
  useDeleteZoneGroup,
  useUpdateZoneMemberships,
  useCreateZonePacingRule,
  useUpdateZonePacingRule,
  useDeleteZonePacingRule,
} from '@/lib/api/mutations'
import type { Zone, ZoneBookingRules, ZoneGroup, ZonePacingRule } from '@/lib/types'

// Preset colors for zones
const ZONE_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#64748b', // slate
]

function ZoneColorBadge({ color, emoji, name }: { color: string; emoji: string | null; name: string }) {
  const textColor = getContrastText(color)

  return (
    <View style={[styles.zoneBadge, { backgroundColor: color }]}>
      <Text style={[styles.zoneBadgeText, { color: textColor }]}>
        {emoji || name.substring(0, 2).toUpperCase()}
      </Text>
    </View>
  )
}

function ZoneRow({ zone, onPress }: { zone: Zone; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.zoneRow, pressed && styles.zoneRowPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${zone.displayName}, ${zone.active ? 'active' : 'inactive'}`}
      accessibilityRole="button"
      accessibilityHint="Tap to edit"
    >
      <View style={[styles.colorStripe, { backgroundColor: zone.color }]} />
      <ZoneColorBadge color={zone.color} emoji={zone.emoji} name={zone.displayName} />
      <View style={styles.zoneInfo}>
        <Text style={styles.zoneName}>{zone.displayName}</Text>
        <View style={styles.zoneMetaRow}>
          {!zone.active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
            </View>
          )}
          {!zone.publicBookable && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>NOT BOOKABLE</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  )
}

interface ZoneFormData {
  displayName: string
  key: string
  emoji: string
  color: string
  active: boolean
  publicBookable: boolean
}

interface BookingRulesFormData {
  minPartySize: string
  maxPartySize: string
  turnTime2Top: string
  turnTime4Top: string
  turnTime6Top: string
  turnTimeLarge: string
  allowMultiTable: boolean
  allowCrossZone: boolean
}

interface PacingFormData {
  maxCoversPerSlot: string
  maxPartiesPerSlot: string
}

// Preset emojis for zone groups
const GROUP_EMOJIS = ['🏠', '🌿', '🌅', '🔒', '⭐', '🎉', '🎵', '🌺', '☀️', '🌙', '❄️', '🌊']

function NeoToggle({
  value,
  onToggle,
  disabled = false,
}: {
  value: boolean
  onToggle: (newValue: boolean) => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={[
        styles.toggleTrack,
        value ? styles.toggleTrackOn : styles.toggleTrackOff,
        disabled && styles.toggleTrackDisabled,
      ]}
      onPress={() => {
        if (disabled) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onToggle(!value)
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View
        style={[
          styles.toggleKnob,
          value ? styles.toggleKnobOn : styles.toggleKnobOff,
          disabled && styles.toggleKnobDisabled,
        ]}
      />
    </Pressable>
  )
}

function ZoneModal({
  visible,
  zone,
  bookingRules,
  pacingRule,
  zoneGroups,
  zoneMemberships,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  visible: boolean
  zone: Zone | null
  bookingRules: ZoneBookingRules | null
  pacingRule: ZonePacingRule | null
  zoneGroups: ZoneGroup[]
  zoneMemberships: number[]
  onClose: () => void
  onSave: (data: ZoneFormData, rulesData: BookingRulesFormData, pacingData: PacingFormData, groupIds: number[]) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'rules' | 'pacing'>('basic')

  // Basic info form
  const [displayName, setDisplayName] = useState('')
  const [key, setKey] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(ZONE_COLORS[0])
  const [active, setActive] = useState(true)
  const [publicBookable, setPublicBookable] = useState(true)

  // Booking rules form
  const [minPartySize, setMinPartySize] = useState('')
  const [maxPartySize, setMaxPartySize] = useState('')
  const [turnTime2Top, setTurnTime2Top] = useState('')
  const [turnTime4Top, setTurnTime4Top] = useState('')
  const [turnTime6Top, setTurnTime6Top] = useState('')
  const [turnTimeLarge, setTurnTimeLarge] = useState('')
  const [allowMultiTable, setAllowMultiTable] = useState(false)
  const [allowCrossZone, setAllowCrossZone] = useState(false)

  // Pacing form
  const [maxCoversPerSlot, setMaxCoversPerSlot] = useState('')
  const [maxPartiesPerSlot, setMaxPartiesPerSlot] = useState('')

  // Group memberships
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])

  const handleClose = () => {
    setActiveTab('basic')
    onClose()
  }

  const handleSave = () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a zone name')
      return
    }
    if (!key.trim()) {
      Alert.alert('Error', 'Please enter a zone key')
      return
    }

    onSave(
      {
        displayName: displayName.trim(),
        key: key.trim().toLowerCase().replace(/\s+/g, '-'),
        emoji: emoji.trim() || '',
        color,
        active,
        publicBookable,
      },
      {
        minPartySize,
        maxPartySize,
        turnTime2Top,
        turnTime4Top,
        turnTime6Top,
        turnTimeLarge,
        allowMultiTable,
        allowCrossZone,
      },
      {
        maxCoversPerSlot,
        maxPartiesPerSlot,
      },
      selectedGroupIds
    )
  }

  const handleDelete = () => {
    Alert.alert(
      'DELETE ZONE',
      `Permanently delete ${zone?.displayName}? Tables in this zone will need to be reassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    )
  }

  // Reset form when modal opens or zone changes
  useEffect(() => {
    if (visible) {
      setActiveTab('basic')
      setDisplayName(zone?.displayName || '')
      setKey(zone?.key || '')
      setEmoji(zone?.emoji || '')
      setColor(zone?.color || ZONE_COLORS[0])
      setActive(zone?.active ?? true)
      setPublicBookable(zone?.publicBookable ?? true)

      // Booking rules
      setMinPartySize(bookingRules?.minPartySize?.toString() || '')
      setMaxPartySize(bookingRules?.maxPartySize?.toString() || '')
      setTurnTime2Top(bookingRules?.turnTime2Top?.toString() || '')
      setTurnTime4Top(bookingRules?.turnTime4Top?.toString() || '')
      setTurnTime6Top(bookingRules?.turnTime6Top?.toString() || '')
      setTurnTimeLarge(bookingRules?.turnTimeLarge?.toString() || '')
      setAllowMultiTable(bookingRules?.allowMultiTable ?? false)
      setAllowCrossZone(bookingRules?.allowCrossZone ?? false)

      // Pacing
      setMaxCoversPerSlot(pacingRule?.maxCoversPerSlot?.toString() || '')
      setMaxPartiesPerSlot(pacingRule?.maxPartiesPerSlot?.toString() || '')

      // Group memberships
      setSelectedGroupIds(zoneMemberships)
    }
  }, [visible, zone, bookingRules, pacingRule, zoneMemberships])

  // Auto-generate key from name
  const handleNameChange = (text: string) => {
    setDisplayName(text)
    if (!zone) {
      // Only auto-generate key for new zones
      setKey(text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable
            onPress={handleClose}
            style={styles.modalHeaderButton}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={styles.modalHeaderButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {zone ? 'EDIT ZONE' : 'NEW ZONE'}
          </Text>
          <Pressable
            onPress={handleSave}
            style={[styles.modalHeaderButton, styles.modalSaveButton]}
            disabled={isSaving}
            accessibilityLabel="Save"
            accessibilityRole="button"
          >
            <Text style={[styles.modalHeaderButtonText, styles.modalSaveButtonText]}>
              {isSaving ? '...' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        {/* Tab buttons */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabButton, activeTab === 'basic' && styles.tabButtonActive]}
            onPress={() => setActiveTab('basic')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'basic' && styles.tabButtonTextActive]}>
              BASIC
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'rules' && styles.tabButtonActive]}
            onPress={() => setActiveTab('rules')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'rules' && styles.tabButtonTextActive]}>
              BOOKING
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'pacing' && styles.tabButtonActive]}
            onPress={() => setActiveTab('pacing')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'pacing' && styles.tabButtonTextActive]}>
              PACING
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          {activeTab === 'basic' ? (
            <>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={displayName}
                  onChangeText={handleNameChange}
                  placeholder="e.g., Patio, Main Dining"
                  placeholderTextColor={Neo.black + '40'}
                  autoCapitalize="words"
                  autoFocus={!zone}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>KEY</Text>
                <TextInput
                  style={styles.textInput}
                  value={key}
                  onChangeText={(t) => setKey(t.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="e.g., patio, main-dining"
                  placeholderTextColor={Neo.black + '40'}
                  autoCapitalize="none"
                />
                <Text style={styles.formHint}>Used in URLs and integrations</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>EMOJI (OPTIONAL)</Text>
                <TextInput
                  style={[styles.textInput, styles.emojiInput]}
                  value={emoji}
                  onChangeText={setEmoji}
                  placeholder="e.g., 🌳"
                  placeholderTextColor={Neo.black + '40'}
                  maxLength={2}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>COLOR</Text>
                <View style={styles.colorGrid}>
                  {ZONE_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.colorOption,
                        { backgroundColor: c },
                        color === c && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setColor(c)
                      }}
                      accessibilityLabel={`Color ${c}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: color === c }}
                    >
                      {color === c && (
                        <Text style={[styles.colorCheckmark, { color: getContrastText(c) }]}>
                          ✓
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Active</Text>
                    <Text style={styles.toggleDescription}>Zone is available for use</Text>
                  </View>
                  <NeoToggle value={active} onToggle={setActive} />
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Public Bookable</Text>
                    <Text style={styles.toggleDescription}>Guests can request this zone</Text>
                  </View>
                  <NeoToggle value={publicBookable} onToggle={setPublicBookable} />
                </View>
              </View>

              <View style={styles.previewSection}>
                <Text style={styles.formLabel}>PREVIEW</Text>
                <View style={styles.previewContainer}>
                  <ZoneColorBadge color={color} emoji={emoji || null} name={displayName || 'AB'} />
                  <Text style={styles.previewName}>{displayName || 'Zone Name'}</Text>
                </View>
              </View>
            </>
          ) : activeTab === 'rules' ? (
            <>
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>PARTY SIZE</Text>
                <View style={styles.formRow}>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>MIN</Text>
                    <TextInput
                      style={styles.textInput}
                      value={minPartySize}
                      onChangeText={setMinPartySize}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>MAX</Text>
                    <TextInput
                      style={styles.textInput}
                      value={maxPartySize}
                      onChangeText={setMaxPartySize}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Text style={styles.formHint}>Leave blank to use restaurant defaults</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>TURN TIMES (MINUTES)</Text>
                <View style={styles.formRow}>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>2-TOP</Text>
                    <TextInput
                      style={styles.textInput}
                      value={turnTime2Top}
                      onChangeText={setTurnTime2Top}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>4-TOP</Text>
                    <TextInput
                      style={styles.textInput}
                      value={turnTime4Top}
                      onChangeText={setTurnTime4Top}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>6-TOP</Text>
                    <TextInput
                      style={styles.textInput}
                      value={turnTime6Top}
                      onChangeText={setTurnTime6Top}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>LARGE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={turnTimeLarge}
                      onChangeText={setTurnTimeLarge}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Text style={styles.formHint}>Override restaurant-wide turn times for this zone</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>TABLE COMBINING</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Allow Multi-Table</Text>
                    <Text style={styles.toggleDescription}>Combine tables in this zone</Text>
                  </View>
                  <NeoToggle value={allowMultiTable} onToggle={setAllowMultiTable} />
                </View>
                <View style={[styles.toggleRow, { marginTop: 16 }]}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Allow Cross-Zone</Text>
                    <Text style={styles.toggleDescription}>Combine with other zones</Text>
                  </View>
                  <NeoToggle value={allowCrossZone} onToggle={setAllowCrossZone} />
                </View>
              </View>
            </>
          ) : activeTab === 'pacing' ? (
            <>
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>PACING LIMITS</Text>
                <Text style={styles.formHint}>Control how many guests or parties can be seated per timeslot in this zone</Text>
              </View>

              <View style={styles.formSection}>
                <View style={styles.formRow}>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>MAX COVERS</Text>
                    <TextInput
                      style={styles.textInput}
                      value={maxCoversPerSlot}
                      onChangeText={setMaxCoversPerSlot}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.formHint}>Guests per slot</Text>
                  </View>
                  <View style={styles.formRowItem}>
                    <Text style={styles.formLabel}>MAX PARTIES</Text>
                    <TextInput
                      style={styles.textInput}
                      value={maxPartiesPerSlot}
                      onChangeText={setMaxPartiesPerSlot}
                      placeholder="—"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.formHint}>Reservations per slot</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardTitle}>HOW PACING WORKS</Text>
                  <Text style={styles.infoCardText}>
                    Leave blank to allow unlimited bookings. Set max covers to limit total guests,
                    or max parties to limit number of reservations per timeslot.
                  </Text>
                </View>
              </View>

              {/* Zone Group memberships */}
              {zoneGroups.length > 0 && (
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>PREFERENCE GROUPS</Text>
                  <Text style={styles.formHint}>Which guest preference groups include this zone?</Text>
                  <View style={styles.groupChipsContainer}>
                    {zoneGroups.filter(g => g.active).map((group) => {
                      const isSelected = selectedGroupIds.includes(group.id)
                      return (
                        <Pressable
                          key={group.id}
                          style={[styles.groupChip, isSelected && styles.groupChipSelected]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            if (isSelected) {
                              setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id))
                            } else {
                              setSelectedGroupIds([...selectedGroupIds, group.id])
                            }
                          }}
                        >
                          <Text style={styles.groupChipEmoji}>{group.emoji || '🏷️'}</Text>
                          <Text style={[styles.groupChipText, isSelected && styles.groupChipTextSelected]}>
                            {group.displayName}
                          </Text>
                          {isSelected && <Text style={styles.groupChipCheck}>✓</Text>}
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}
            </>
          ) : null}

          {/* Delete button - only for existing zones */}
          {zone && (
            <View style={styles.dangerSection}>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={isDeleting}
                accessibilityLabel="Delete zone"
                accessibilityRole="button"
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'DELETING...' : 'DELETE ZONE'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function FAB({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <Pressable
      style={[styles.fab, pressed && styles.fabPressed]}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel="Add zone"
      accessibilityRole="button"
      accessibilityHint="Opens the add zone modal"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

// Zone Group Row Component
function ZoneGroupRow({ group, onPress }: { group: ZoneGroup; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.groupRow, pressed && styles.groupRowPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${group.displayName}, ${group.active ? 'active' : 'inactive'}`}
      accessibilityRole="button"
      accessibilityHint="Tap to edit"
    >
      <Text style={styles.groupRowEmoji}>{group.emoji || '🏷️'}</Text>
      <View style={styles.groupRowInfo}>
        <Text style={styles.groupRowName}>{group.displayName}</Text>
        {!group.active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
          </View>
        )}
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  )
}

// Zone Group Modal
function ZoneGroupModal({
  visible,
  group,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  visible: boolean
  group: ZoneGroup | null
  onClose: () => void
  onSave: (data: { displayName: string; emoji: string; active: boolean; publicVisible: boolean }) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [displayName, setDisplayName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [active, setActive] = useState(true)
  const [publicVisible, setPublicVisible] = useState(true)

  useEffect(() => {
    if (visible) {
      setDisplayName(group?.displayName || '')
      setEmoji(group?.emoji || '')
      setActive(group?.active ?? true)
      setPublicVisible(group?.publicVisible ?? true)
    }
  }, [visible, group])

  const handleSave = () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a group name')
      return
    }
    onSave({ displayName: displayName.trim(), emoji, active, publicVisible })
  }

  const handleDelete = () => {
    Alert.alert(
      'DELETE GROUP',
      `Permanently delete ${group?.displayName}? Zones will be unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: onDelete },
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalHeaderButton}>
            <Text style={styles.modalHeaderButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.modalTitle}>{group ? 'EDIT GROUP' : 'NEW GROUP'}</Text>
          <Pressable
            onPress={handleSave}
            style={[styles.modalHeaderButton, styles.modalSaveButton]}
            disabled={isSaving}
          >
            <Text style={[styles.modalHeaderButtonText, styles.modalSaveButtonText]}>
              {isSaving ? '...' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>NAME</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g., Indoor, Outdoor"
              placeholderTextColor={Neo.black + '40'}
              autoCapitalize="words"
              autoFocus={!group}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>EMOJI</Text>
            <View style={styles.emojiGrid}>
              {GROUP_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiOption, emoji === e && styles.emojiOptionSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setEmoji(e)
                  }}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Active</Text>
                <Text style={styles.toggleDescription}>Group is available for use</Text>
              </View>
              <NeoToggle value={active} onToggle={setActive} />
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Public Visible</Text>
                <Text style={styles.toggleDescription}>Guests can select this preference</Text>
              </View>
              <NeoToggle value={publicVisible} onToggle={setPublicVisible} />
            </View>
          </View>

          {group && (
            <View style={styles.dangerSection}>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'DELETING...' : 'DELETE GROUP'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// Exported content component for use in split view
export function ZonesSettingsContent() {
  const { data, isLoading, refetch } = useZonesData()
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [groupModalVisible, setGroupModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ZoneGroup | null>(null)

  const createMutation = useCreateZone()
  const updateMutation = useUpdateZone()
  const deleteMutation = useDeleteZone()
  const updateBookingRulesMutation = useUpdateZoneBookingRules()
  const updateMembershipsMutation = useUpdateZoneMemberships()
  const createPacingMutation = useCreateZonePacingRule()
  const updatePacingMutation = useUpdateZonePacingRule()

  // Zone group mutations
  const createGroupMutation = useCreateZoneGroup()
  const updateGroupMutation = useUpdateZoneGroup()
  const deleteGroupMutation = useDeleteZoneGroup()

  const isSaving = createMutation.isPending || updateMutation.isPending ||
    updateBookingRulesMutation.isPending || updateMembershipsMutation.isPending ||
    createPacingMutation.isPending || updatePacingMutation.isPending
  const isDeleting = deleteMutation.isPending
  const isGroupSaving = createGroupMutation.isPending || updateGroupMutation.isPending
  const isGroupDeleting = deleteGroupMutation.isPending

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const zones = data?.zones || []
  const bookingRules = data?.bookingRules || []
  const pacingRules = data?.pacingRules || []
  const zoneGroups = data?.zoneGroups || []
  const memberships = data?.memberships || []

  // Sort by sortOrder
  const sortedZones = [...zones].sort((a, b) => a.sortOrder - b.sortOrder)
  const sortedGroups = [...zoneGroups].sort((a, b) => a.sortOrder - b.sortOrder)

  // Get booking rules for a zone
  const getBookingRulesForZone = (zoneId: number): ZoneBookingRules | null => {
    return bookingRules.find((r) => r.zoneId === zoneId) || null
  }

  // Get default pacing rule for a zone (no day/time filter)
  const getPacingRuleForZone = (zoneId: number): ZonePacingRule | null => {
    return pacingRules.find((r) => r.zoneId === zoneId && r.dayOfWeek === null) || null
  }

  // Get zone group memberships for a zone
  const getMembershipsForZone = (zoneId: number): number[] => {
    return memberships.filter((m) => m.zoneId === zoneId).map((m) => m.groupId)
  }

  const handleAddNew = () => {
    setEditingZone(null)
    setModalVisible(true)
  }

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone)
    setModalVisible(true)
  }

  const handleDelete = async () => {
    if (!editingZone) return

    try {
      await deleteMutation.mutateAsync(editingZone.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setModalVisible(false)
      setEditingZone(null)
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error?.message || 'Failed to delete zone')
    }
  }

  const handleSave = async (
    formData: ZoneFormData,
    rulesData: BookingRulesFormData,
    pacingData: PacingFormData,
    groupIds: number[]
  ) => {
    const parseNumber = (val: string): number | null => {
      const num = parseInt(val, 10)
      return isNaN(num) ? null : num
    }

    if (editingZone) {
      // Update existing zone
      try {
        await updateMutation.mutateAsync({
          id: editingZone.id,
          displayName: formData.displayName,
          key: formData.key,
          emoji: formData.emoji || null,
          color: formData.color,
          active: formData.active,
          publicBookable: formData.publicBookable,
        })

        // Update booking rules
        await updateBookingRulesMutation.mutateAsync({
          zoneId: editingZone.id,
          minPartySize: parseNumber(rulesData.minPartySize),
          maxPartySize: parseNumber(rulesData.maxPartySize),
          turnTime2Top: parseNumber(rulesData.turnTime2Top),
          turnTime4Top: parseNumber(rulesData.turnTime4Top),
          turnTime6Top: parseNumber(rulesData.turnTime6Top),
          turnTimeLarge: parseNumber(rulesData.turnTimeLarge),
          allowMultiTable: rulesData.allowMultiTable,
          allowCrossZone: rulesData.allowCrossZone,
        })

        // Update memberships
        await updateMembershipsMutation.mutateAsync({
          zoneId: editingZone.id,
          groupIds,
        })

        // Update pacing rule
        const existingPacing = getPacingRuleForZone(editingZone.id)
        const maxCovers = parseNumber(pacingData.maxCoversPerSlot)
        const maxParties = parseNumber(pacingData.maxPartiesPerSlot)

        if (existingPacing) {
          await updatePacingMutation.mutateAsync({
            id: existingPacing.id,
            maxCoversPerSlot: maxCovers,
            maxPartiesPerSlot: maxParties,
          })
        } else if (maxCovers !== null || maxParties !== null) {
          await createPacingMutation.mutateAsync({
            zoneId: editingZone.id,
            maxCoversPerSlot: maxCovers,
            maxPartiesPerSlot: maxParties,
          })
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setModalVisible(false)
        setEditingZone(null)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to update zone')
      }
    } else {
      // Create new zone
      try {
        const result = await createMutation.mutateAsync({
          displayName: formData.displayName,
          key: formData.key,
          emoji: formData.emoji || null,
          color: formData.color,
          active: formData.active,
          publicBookable: formData.publicBookable,
        })

        // Set booking rules for new zone
        if (result.id) {
          await updateBookingRulesMutation.mutateAsync({
            zoneId: result.id,
            minPartySize: parseNumber(rulesData.minPartySize),
            maxPartySize: parseNumber(rulesData.maxPartySize),
            turnTime2Top: parseNumber(rulesData.turnTime2Top),
            turnTime4Top: parseNumber(rulesData.turnTime4Top),
            turnTime6Top: parseNumber(rulesData.turnTime6Top),
            turnTimeLarge: parseNumber(rulesData.turnTimeLarge),
            allowMultiTable: rulesData.allowMultiTable,
            allowCrossZone: rulesData.allowCrossZone,
          })

          // Set memberships
          if (groupIds.length > 0) {
            await updateMembershipsMutation.mutateAsync({
              zoneId: result.id,
              groupIds,
            })
          }

          // Set pacing rule
          const maxCovers = parseNumber(pacingData.maxCoversPerSlot)
          const maxParties = parseNumber(pacingData.maxPartiesPerSlot)
          if (maxCovers !== null || maxParties !== null) {
            await createPacingMutation.mutateAsync({
              zoneId: result.id,
              maxCoversPerSlot: maxCovers,
              maxPartiesPerSlot: maxParties,
            })
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setModalVisible(false)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to create zone')
      }
    }
  }

  // Zone group handlers
  const handleAddGroup = () => {
    setEditingGroup(null)
    setGroupModalVisible(true)
  }

  const handleEditGroup = (group: ZoneGroup) => {
    setEditingGroup(group)
    setGroupModalVisible(true)
  }

  const handleDeleteGroup = async () => {
    if (!editingGroup) return
    try {
      await deleteGroupMutation.mutateAsync(editingGroup.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setGroupModalVisible(false)
      setEditingGroup(null)
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error?.message || 'Failed to delete group')
    }
  }

  const handleSaveGroup = async (formData: { displayName: string; emoji: string; active: boolean; publicVisible: boolean }) => {
    // Generate key from display name
    const key = formData.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    if (editingGroup) {
      try {
        await updateGroupMutation.mutateAsync({
          id: editingGroup.id,
          displayName: formData.displayName,
          emoji: formData.emoji || null,
          active: formData.active,
          publicVisible: formData.publicVisible,
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setGroupModalVisible(false)
        setEditingGroup(null)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to update group')
      }
    } else {
      try {
        await createGroupMutation.mutateAsync({
          displayName: formData.displayName,
          key,
          emoji: formData.emoji || null,
          active: formData.active,
          publicVisible: formData.publicVisible,
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setGroupModalVisible(false)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to create group')
      }
    }
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Neo.black} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.contentContainer}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Neo.black}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Zone Groups Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PREFERENCE GROUPS</Text>
            <Pressable
              style={styles.sectionAddButton}
              onPress={handleAddGroup}
              accessibilityLabel="Add preference group"
              accessibilityRole="button"
            >
              <Text style={styles.sectionAddButtonText}>+ ADD</Text>
            </Pressable>
          </View>
          {sortedGroups.length === 0 ? (
            <View style={styles.sectionEmptyState}>
              <Text style={styles.sectionEmptyText}>
                No preference groups. Add groups like "Indoor" or "Outdoor" to let guests choose.
              </Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {sortedGroups.map((group) => (
                <ZoneGroupRow key={group.id} group={group} onPress={() => handleEditGroup(group)} />
              ))}
            </View>
          )}
        </View>

        {/* Zones Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ZONES</Text>
            <Pressable
              style={styles.sectionAddButton}
              onPress={handleAddNew}
              accessibilityLabel="Add zone"
              accessibilityRole="button"
            >
              <Text style={styles.sectionAddButtonText}>+ ADD</Text>
            </Pressable>
          </View>
          {sortedZones.length === 0 ? (
            <View style={styles.sectionEmptyState}>
              <Text style={styles.sectionEmptyText}>
                No zones. Add zones to organize your dining areas (e.g., Patio, Bar, Main Dining).
              </Text>
            </View>
          ) : (
            <View style={styles.zoneList}>
              {sortedZones.map((zone) => (
                <ZoneRow key={zone.id} zone={zone} onPress={() => handleEdit(zone)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ZoneModal
        visible={modalVisible}
        zone={editingZone}
        bookingRules={editingZone ? getBookingRulesForZone(editingZone.id) : null}
        pacingRule={editingZone ? getPacingRuleForZone(editingZone.id) : null}
        zoneGroups={zoneGroups}
        zoneMemberships={editingZone ? getMembershipsForZone(editingZone.id) : []}
        onClose={() => {
          setModalVisible(false)
          setEditingZone(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        isSaving={isSaving}
        isDeleting={isDeleting}
      />

      <ZoneGroupModal
        visible={groupModalVisible}
        group={editingGroup}
        onClose={() => {
          setGroupModalVisible(false)
          setEditingGroup(null)
        }}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
        isSaving={isGroupSaving}
        isDeleting={isGroupDeleting}
      />
    </View>
  )
}

// Screen wrapper for standalone navigation
export default function ZonesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ZonesSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  zoneRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  colorStripe: {
    width: 6,
    alignSelf: 'stretch',
  },
  zoneBadge: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  zoneBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  zoneInfo: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  zoneMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  inactiveBadge: {
    backgroundColor: Neo.black + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Neo.black + '40',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '60',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    paddingHorizontal: 24,
    ...NeoShadow.sm,
  },
  addFirstButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    ...NeoShadow.lg,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    backgroundColor: Neo.blue,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.default,
  },
  fabPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  fabText: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.white,
    marginTop: -2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.blue,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalHeaderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalHeaderButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalSaveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalSaveButtonText: {
    color: Neo.black,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.white,
    letterSpacing: -0.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Neo.black,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black + '60',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tabButtonTextActive: {
    color: Neo.black,
    fontWeight: '800',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formHint: {
    fontSize: 10,
    color: Neo.black + '60',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formRowItem: {
    flex: 1,
  },
  textInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emojiInput: {
    width: 80,
    textAlign: 'center',
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: NeoBorder.thick,
  },
  colorCheckmark: {
    fontSize: 20,
    fontWeight: '900',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleTrack: {
    width: 52,
    height: 32,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    padding: 3,
  },
  toggleTrackOn: {
    backgroundColor: Neo.lime,
  },
  toggleTrackOff: {
    backgroundColor: Neo.white,
  },
  toggleTrackDisabled: {
    opacity: 0.5,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: Neo.black,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    alignSelf: 'flex-start',
  },
  toggleKnobDisabled: {
    backgroundColor: Neo.black + '60',
  },
  previewSection: {
    marginTop: 8,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    gap: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  dangerSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  deleteButton: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomPadding: {
    height: 40,
  },
  // Scroll content
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Section styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionAddButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionAddButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionEmptyState: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    alignItems: 'center',
  },
  sectionEmptyText: {
    fontSize: 12,
    color: Neo.black + '60',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Zone list
  zoneList: {
    gap: 12,
  },
  // Group list
  groupList: {
    gap: 8,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...NeoShadow.sm,
  },
  groupRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  groupRowEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  groupRowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupRowName: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  // Emoji picker grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionSelected: {
    borderWidth: NeoBorder.thick,
    backgroundColor: Neo.lime,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  // Info card
  infoCard: {
    backgroundColor: Neo.cyan + '30',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 16,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoCardText: {
    fontSize: 12,
    color: Neo.black,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Group chips for zone memberships
  groupChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  groupChipSelected: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
  },
  groupChipEmoji: {
    fontSize: 14,
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  groupChipTextSelected: {
    fontWeight: '800',
  },
  groupChipCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
  },
})
