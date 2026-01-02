import { useState, useEffect, useMemo } from 'react'
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

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useSeatingSettings, useBlockedDates } from '@/lib/api/queries'
import { useUpdateSeatingSettings, useCreateBlockedDate, useDeleteBlockedDate } from '@/lib/api/mutations'
import type { SeatingSettings, BlockedDate } from '@/lib/types'

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

function SettingRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string
  description?: string
  value: boolean
  onToggle: (newValue: boolean) => void
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <NeoToggle value={value} onToggle={onToggle} />
    </View>
  )
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  const decrement = () => {
    if (value > min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onChange(value - step)
    }
  }

  const increment = () => {
    if (value < max) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onChange(value + step)
    }
  }

  return (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
          onPress={decrement}
          disabled={value <= min}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {value}
          {suffix}
        </Text>
        <Pressable
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
          onPress={increment}
          disabled={value >= max}
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

function BlockedDateRow({
  blockedDate,
  onDelete,
}: {
  blockedDate: BlockedDate
  onDelete: () => void
}) {
  const dateObj = new Date(blockedDate.date + 'T00:00:00')
  const dateStr = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const isPast = dateObj < new Date()

  return (
    <View style={[styles.blockedDateRow, isPast && styles.blockedDateRowPast]}>
      <View style={styles.blockedDateInfo}>
        <Text style={[styles.blockedDateText, isPast && styles.blockedDateTextPast]}>{dateStr}</Text>
        {blockedDate.reason && (
          <Text style={[styles.blockedDateReason, isPast && styles.blockedDateReasonPast]}>
            {blockedDate.reason}
          </Text>
        )}
      </View>
      <Pressable
        style={styles.deleteButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onDelete()
        }}
        accessibilityLabel={`Delete blocked date ${dateStr}`}
        accessibilityRole="button"
      >
        <Text style={styles.deleteButtonText}>✕</Text>
      </Pressable>
    </View>
  )
}

function AddBlockedDateModal({
  visible,
  onClose,
  onAdd,
  isLoading,
}: {
  visible: boolean
  onClose: () => void
  onAdd: (date: string, reason: string | null) => void
  isLoading: boolean
}) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  const handleAdd = () => {
    if (!date) {
      Alert.alert('Error', 'Please enter a date')
      return
    }
    onAdd(date, reason.trim() || null)
  }

  const handleClose = () => {
    setDate('')
    setReason('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>BLOCK A DATE</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DATE</Text>
            <TextInput
              style={styles.textInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Neo.black + '40'}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>REASON (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Christmas Day"
              placeholderTextColor={Neo.black + '40'}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary, NeoShadow.sm]}
              onPress={handleClose}
            >
              <Text style={styles.modalButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonPrimary, NeoShadow.sm]}
              onPress={handleAdd}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.modalButtonText}>BLOCK DATE</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// Exported content component for use in split view
export function ReservationsSettingsContent() {
  const { data: seatingSettings, isLoading: isLoadingSeating, refetch: refetchSeating } = useSeatingSettings()
  const { data: blockedDates, isLoading: isLoadingDates, refetch: refetchDates } = useBlockedDates()

  const updateSeating = useUpdateSeatingSettings()
  const createBlockedDate = useCreateBlockedDate()
  const deleteBlockedDate = useDeleteBlockedDate()

  const [localSeating, setLocalSeating] = useState<SeatingSettings | null>(null)
  const [isSeatingDirty, setIsSeatingDirty] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (seatingSettings && !localSeating) {
      setLocalSeating(seatingSettings)
    }
  }, [seatingSettings, localSeating])

  const updateLocalSeating = (updates: Partial<SeatingSettings>) => {
    if (localSeating) {
      setLocalSeating({ ...localSeating, ...updates })
      setIsSeatingDirty(true)
    }
  }

  const handleSaveSeating = async () => {
    if (!localSeating) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await updateSeating.mutateAsync(localSeating)
      setIsSeatingDirty(false)
      Alert.alert('Success', 'Reservation settings saved')
    } catch {
      Alert.alert('Error', 'Failed to save settings')
    }
  }

  const handleAddBlockedDate = async (date: string, reason: string | null) => {
    try {
      await createBlockedDate.mutateAsync({ date, reason })
      setShowAddModal(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('Error', 'Failed to block date')
    }
  }

  const handleDeleteBlockedDate = (id: number) => {
    Alert.alert('Delete Blocked Date', 'Are you sure you want to remove this blocked date?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBlockedDate.mutateAsync(id)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          } catch {
            Alert.alert('Error', 'Failed to delete blocked date')
          }
        },
      },
    ])
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchSeating(), refetchDates()])
    setIsRefreshing(false)
  }

  const sortedBlockedDates = useMemo(() => {
    if (!blockedDates) return []
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return [...blockedDates].sort((a, b) => {
      const dateA = new Date(a.date + 'T00:00:00')
      const dateB = new Date(b.date + 'T00:00:00')
      const aIsPast = dateA < now
      const bIsPast = dateB < now
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1
      return dateA.getTime() - dateB.getTime()
    })
  }, [blockedDates])

  if ((isLoadingSeating || isLoadingDates) && !localSeating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Neo.black} />
      </View>
    )
  }

  return (
    <View style={styles.contentContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Neo.black} />
        }
      >
        {/* Turn Times */}
        {localSeating && (
          <View style={styles.section}>
            <SectionHeader title="TURN TIMES" />
            <View style={styles.card}>
              <Text style={styles.cardDescription}>
                How long to block a table after seating each party size
              </Text>
              <NumberStepper
                label="1-2 guests"
                value={localSeating.turnTime2Top}
                onChange={(v) => updateLocalSeating({ turnTime2Top: v })}
                min={30}
                max={300}
                step={15}
                suffix=" min"
              />
              <NumberStepper
                label="3-4 guests"
                value={localSeating.turnTime4Top}
                onChange={(v) => updateLocalSeating({ turnTime4Top: v })}
                min={30}
                max={300}
                step={15}
                suffix=" min"
              />
              <NumberStepper
                label="5-6 guests"
                value={localSeating.turnTime6Top}
                onChange={(v) => updateLocalSeating({ turnTime6Top: v })}
                min={30}
                max={300}
                step={15}
                suffix=" min"
              />
              <NumberStepper
                label="7+ guests"
                value={localSeating.turnTimeLarge}
                onChange={(v) => updateLocalSeating({ turnTimeLarge: v })}
                min={30}
                max={300}
                step={15}
                suffix=" min"
              />
            </View>
          </View>
        )}

        {/* Online Booking Rules */}
        {localSeating && (
          <View style={styles.section}>
            <SectionHeader title="ONLINE BOOKING RULES" />
            <View style={styles.card}>
              <NumberStepper
                label="Max party size"
                value={localSeating.maxPartySizePublic}
                onChange={(v) => updateLocalSeating({ maxPartySizePublic: v })}
                min={2}
                max={20}
                step={1}
                suffix=" guests"
              />
              <View style={styles.divider} />
              <SettingRow
                label="Allow Multi-Table"
                description="Allow guests to book parties that span multiple tables"
                value={localSeating.allowMultiTablePublic}
                onToggle={(v) => updateLocalSeating({ allowMultiTablePublic: v })}
              />
            </View>
          </View>
        )}

        {/* Save Button */}
        {isSeatingDirty && (
          <View style={styles.saveContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                NeoShadow.sm,
                pressed && styles.saveButtonPressed,
              ]}
              onPress={handleSaveSeating}
              disabled={updateSeating.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save reservation settings"
            >
              {updateSeating.isPending ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Blocked Dates */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title="BLOCKED DATES" />
            <Pressable
              style={[styles.addButton, NeoShadow.sm]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setShowAddModal(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="Add blocked date"
            >
              <Text style={styles.addButtonText}>+ ADD</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {sortedBlockedDates.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No blocked dates</Text>
                <Text style={styles.emptyStateHint}>
                  Block specific dates when the restaurant is closed
                </Text>
              </View>
            ) : (
              sortedBlockedDates.map((blockedDate) => (
                <BlockedDateRow
                  key={blockedDate.id}
                  blockedDate={blockedDate}
                  onDelete={() => handleDeleteBlockedDate(blockedDate.id)}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <AddBlockedDateModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBlockedDate}
        isLoading={createBlockedDate.isPending}
      />
    </View>
  )
}

// Screen wrapper for standalone navigation
export default function ReservationsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ReservationsSettingsContent />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: Neo.black + '80',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
    padding: 16,
  },
  cardDescription: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 2,
  },
  settingDescription: {
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Neo.black,
  },
  stepperValue: {
    minWidth: 70,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: Neo.black + '20',
    marginVertical: 8,
  },
  saveContainer: {
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
  },
  addButton: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
  },
  blockedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '10',
  },
  blockedDateRowPast: {
    opacity: 0.5,
  },
  blockedDateInfo: {
    flex: 1,
  },
  blockedDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  blockedDateTextPast: {
    color: Neo.black + '60',
  },
  blockedDateReason: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  blockedDateReasonPast: {
    color: Neo.black + '40',
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.pink,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black + '60',
    marginBottom: 4,
  },
  emptyStateHint: {
    fontSize: 12,
    color: Neo.black + '40',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.lg,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 20,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Neo.black,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: Neo.white,
  },
  modalButtonPrimary: {
    backgroundColor: Neo.pink,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  bottomPadding: {
    height: 40,
  },
})
