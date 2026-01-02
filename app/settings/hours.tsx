import { useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useOperatingHours } from '@/lib/api/queries'
import { useCreateOperatingHour, useUpdateOperatingHour, useDeleteOperatingHour } from '@/lib/api/mutations'
import { TimePickerButton } from '@/components/ui/TimePicker'
import type { OperatingHour } from '@/lib/types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBREV = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

function NeoToggle({
  value,
  onToggle,
}: {
  value: boolean
  onToggle: (newValue: boolean) => void
}) {
  return (
    <Pressable
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
      onPress={(e) => {
        e.stopPropagation()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onToggle(!value)
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  )
}

function HourRow({
  hour,
  onEdit,
  onToggleActive,
}: {
  hour: OperatingHour
  onEdit: () => void
  onToggleActive: (active: boolean) => void
}) {
  const [pressed, setPressed] = useState(false)
  const hasCustomTimes = hour.reservationStartTime || hour.lastSeatingTime

  return (
    <Pressable
      style={[styles.hourRow, pressed && styles.hourRowPressed]}
      onPress={onEdit}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${formatTime(hour.openTime)} to ${formatTime(hour.closeTime)}. ${hour.active ? 'Active' : 'Inactive'}. Tap to edit`}
      accessibilityRole="button"
    >
      <View style={styles.hourInfo}>
        <Text style={[styles.hourTime, !hour.active && styles.hourTimeInactive]}>
          {formatTime(hour.openTime)} – {formatTime(hour.closeTime)}
        </Text>
        <View style={styles.hourDetails}>
          <Text style={styles.hourDetail}>{hour.slotDuration}min slots</Text>
          {hasCustomTimes ? (
            <Text style={styles.hourDetail}>
              Res: {formatTime(hour.reservationStartTime || hour.openTime)} – {formatTime(hour.lastSeatingTime || hour.closeTime)}
            </Text>
          ) : (
            <Text style={styles.hourDetailAuto}>Last seating auto</Text>
          )}
        </View>
      </View>
      <View style={styles.toggleContainer}>
        <NeoToggle value={hour.active} onToggle={onToggleActive} />
      </View>
    </Pressable>
  )
}

function DayPicker({
  selectedDay,
  onSelect,
  existingDays,
}: {
  selectedDay: number
  onSelect: (day: number) => void
  existingDays: Set<number>
}) {
  return (
    <View style={styles.dayPicker}>
      {DAY_ABBREV.map((abbrev, index) => {
        const isSelected = index === selectedDay
        const hasHours = existingDays.has(index)
        return (
          <Pressable
            key={index}
            style={[
              styles.dayOption,
              isSelected && styles.dayOptionSelected,
              hasHours && !isSelected && styles.dayOptionHasHours,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(index)
            }}
          >
            <Text
              style={[
                styles.dayOptionText,
                isSelected && styles.dayOptionTextSelected,
              ]}
            >
              {abbrev}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

interface HourFormData {
  dayOfWeek: number
  openTime: string
  closeTime: string
  useCustomTimes: boolean
  reservationStartTime: string
  lastSeatingTime: string
  slotDuration: string
}

function HourModal({
  visible,
  onClose,
  hour,
  existingDays,
  onSave,
  onDelete,
  isLoading,
}: {
  visible: boolean
  onClose: () => void
  hour: OperatingHour | null
  existingDays: Set<number>
  onSave: (data: HourFormData) => void
  onDelete?: () => void
  isLoading: boolean
}) {
  const hasCustomTimes = !!(hour?.reservationStartTime || hour?.lastSeatingTime)
  const [formData, setFormData] = useState<HourFormData>({
    dayOfWeek: hour?.dayOfWeek ?? 1,
    openTime: hour?.openTime ?? '11:00',
    closeTime: hour?.closeTime ?? '22:00',
    useCustomTimes: hasCustomTimes,
    reservationStartTime: hour?.reservationStartTime ?? '',
    lastSeatingTime: hour?.lastSeatingTime ?? '',
    slotDuration: hour?.slotDuration?.toString() ?? '30',
  })

  const handleSave = () => {
    if (!formData.openTime || !formData.closeTime) {
      Alert.alert('Error', 'Please enter open and close times')
      return
    }
    onSave(formData)
  }

  const isEditing = !!hour

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{isEditing ? 'EDIT HOURS' : 'ADD HOURS'}</Text>

          {!isEditing && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DAY OF WEEK</Text>
              <DayPicker
                selectedDay={formData.dayOfWeek}
                onSelect={(day) => setFormData({ ...formData, dayOfWeek: day })}
                existingDays={existingDays}
              />
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>OPEN TIME</Text>
              <TimePickerButton
                value={formData.openTime}
                onChange={(v) => setFormData({ ...formData, openTime: v })}
                placeholder="11:00 AM"
              />
            </View>
            <View style={styles.inputSpacer} />
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>CLOSE TIME</Text>
              <TimePickerButton
                value={formData.closeTime}
                onChange={(v) => setFormData({ ...formData, closeTime: v })}
                placeholder="10:00 PM"
              />
            </View>
          </View>

          {/* Custom Reservation Times Toggle */}
          <View style={styles.customTimesSection}>
            <View style={styles.customTimesHeader}>
              <View style={styles.customTimesInfo}>
                <Text style={styles.customTimesLabel}>CUSTOM RESERVATION TIMES</Text>
                <Text style={styles.customTimesHint}>
                  Override auto-calculated last seating
                </Text>
              </View>
              <NeoToggle
                value={formData.useCustomTimes}
                onToggle={(v) => setFormData({ ...formData, useCustomTimes: v })}
              />
            </View>

            {formData.useCustomTimes ? (
              <View style={styles.customTimesFields}>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>RESERVATIONS START</Text>
                    <TimePickerButton
                      value={formData.reservationStartTime || formData.openTime}
                      onChange={(v) => setFormData({ ...formData, reservationStartTime: v })}
                      placeholder="Start time"
                    />
                  </View>
                  <View style={styles.inputSpacer} />
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>LAST SEATING</Text>
                    <TimePickerButton
                      value={formData.lastSeatingTime || formData.closeTime}
                      onChange={(v) => setFormData({ ...formData, lastSeatingTime: v })}
                      placeholder="End time"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.autoExplanation}>
                <Text style={styles.autoExplanationText}>
                  Last seating is calculated automatically based on party size and turn times.
                </Text>
                <Text style={styles.autoExplanationExample}>
                  Example: Close at 10pm with 90min turn → last seating ~8:30pm for larger parties
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SLOT DURATION (MINUTES)</Text>
            <TextInput
              style={[styles.textInput, { width: 100 }]}
              value={formData.slotDuration}
              onChangeText={(v) => setFormData({ ...formData, slotDuration: v })}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={Neo.black + '40'}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary, NeoShadow.sm]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonPrimary, NeoShadow.sm]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.modalButtonText}>{isEditing ? 'SAVE' : 'ADD'}</Text>
              )}
            </Pressable>
          </View>

          {isEditing && onDelete && (
            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>DELETE HOURS</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// Exported content component for use in split view
export function HoursSettingsContent() {
  const { data, isLoading, refetch, isRefetching } = useOperatingHours()
  const createHour = useCreateOperatingHour()
  const updateHour = useUpdateOperatingHour()
  const deleteHour = useDeleteOperatingHour()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingHour, setEditingHour] = useState<OperatingHour | null>(null)

  const hours = data?.hours || []

  // Group hours by day of week
  const sections = useMemo(() => {
    const dayMap = new Map<number, OperatingHour[]>()

    for (const hour of hours) {
      if (!dayMap.has(hour.dayOfWeek)) {
        dayMap.set(hour.dayOfWeek, [])
      }
      dayMap.get(hour.dayOfWeek)!.push(hour)
    }

    // Sort each day's hours by open time
    for (const dayHours of dayMap.values()) {
      dayHours.sort((a, b) => a.openTime.localeCompare(b.openTime))
    }

    // Convert to sections, only including days with hours
    return Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayOfWeek, dayHours]) => ({
        dayOfWeek,
        title: DAY_NAMES[dayOfWeek],
        data: dayHours,
      }))
  }, [hours])

  const existingDays = useMemo(() => {
    return new Set(hours.map((h) => h.dayOfWeek))
  }, [hours])

  const handleOpenModal = (hour: OperatingHour | null = null) => {
    setEditingHour(hour)
    setModalVisible(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingHour(null)
  }

  const handleSave = async (formData: HourFormData) => {
    const slotDuration = parseInt(formData.slotDuration, 10) || 30

    // Clear custom times if toggle is off
    const reservationStartTime = formData.useCustomTimes ? (formData.reservationStartTime || null) : null
    const lastSeatingTime = formData.useCustomTimes ? (formData.lastSeatingTime || null) : null

    try {
      if (editingHour) {
        await updateHour.mutateAsync({
          id: editingHour.id,
          openTime: formData.openTime,
          closeTime: formData.closeTime,
          reservationStartTime,
          lastSeatingTime,
          slotDuration,
        })
      } else {
        await createHour.mutateAsync({
          dayOfWeek: formData.dayOfWeek,
          openTime: formData.openTime,
          closeTime: formData.closeTime,
          reservationStartTime,
          lastSeatingTime,
          slotDuration,
        })
      }
      handleCloseModal()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('Error', 'Failed to save hours')
    }
  }

  const handleToggleActive = async (hour: OperatingHour, active: boolean) => {
    try {
      await updateHour.mutateAsync({ id: hour.id, active })
    } catch {
      Alert.alert('Error', 'Failed to update hours')
    }
  }

  const handleDelete = () => {
    if (!editingHour) return

    Alert.alert(
      'Delete Hours',
      `Are you sure you want to delete this time slot?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHour.mutateAsync(editingHour.id)
              handleCloseModal()
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch {
              Alert.alert('Error', 'Failed to delete hours')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Neo.black} />
      </View>
    )
  }

  return (
    <View style={styles.contentContainer}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <HourRow
            hour={item}
            onEdit={() => handleOpenModal(item)}
            onToggleActive={(active) => handleToggleActive(item, active)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Neo.black}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>NO HOURS SET</Text>
            <Text style={styles.emptyStateText}>
              Tap the + button to add operating hours.
            </Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, NeoShadow.default]}
        onPress={() => handleOpenModal(null)}
        accessibilityLabel="Add operating hours"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <HourModal
        visible={modalVisible}
        onClose={handleCloseModal}
        hour={editingHour}
        existingDays={existingDays}
        onSave={handleSave}
        onDelete={editingHour ? handleDelete : undefined}
        isLoading={createHour.isPending || updateHour.isPending}
      />
    </View>
  )
}

// Screen wrapper for standalone navigation
export default function HoursScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <HoursSettingsContent />
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
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: Neo.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  hourRowPressed: {
    backgroundColor: Neo.yellow,
  },
  hourInfo: {
    flex: 1,
  },
  hourTime: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 4,
  },
  hourTimeInactive: {
    color: Neo.black + '50',
  },
  hourDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourDetail: {
    fontSize: 11,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hourDetailAuto: {
    fontSize: 11,
    color: Neo.black + '40',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleContainer: {
    marginLeft: 12,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Neo.black + '60',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 32,
    fontWeight: '700',
    color: Neo.black,
    marginTop: -2,
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
    maxHeight: '90%',
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
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputSpacer: {
    width: 12,
  },
  customTimesSection: {
    marginBottom: 16,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
  },
  customTimesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customTimesInfo: {
    flex: 1,
    marginRight: 12,
  },
  customTimesLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  customTimesHint: {
    fontSize: 10,
    color: Neo.black + '60',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  customTimesFields: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  autoExplanation: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  autoExplanationText: {
    fontSize: 12,
    color: Neo.black + '70',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  autoExplanationExample: {
    fontSize: 11,
    color: Neo.black + '50',
    marginTop: 8,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
  },
  dayOptionSelected: {
    backgroundColor: Neo.lime,
  },
  dayOptionHasHours: {
    backgroundColor: Neo.cream,
  },
  dayOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dayOptionTextSelected: {
    fontWeight: '800',
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
    backgroundColor: Neo.lime,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.pink,
  },
})
