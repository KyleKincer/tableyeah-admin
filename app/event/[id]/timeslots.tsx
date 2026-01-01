import { format, parseISO, isValid, addHours } from 'date-fns'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useEvent, useEventTimeslots } from '@/lib/api/queries'
import { useCreateTimeslot, useToggleTimeslot, useDeleteTimeslot } from '@/lib/api/mutations'
import { TimePickerButton } from '@/components/ui/TimePicker'
import type { Timeslot } from '@/lib/types'

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function TimeslotCard({
  timeslot,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  timeslot: Timeslot
  onToggle: () => void
  onDelete: () => void
  isToggling: boolean
  isDeleting: boolean
}) {
  const startTime = format(new Date(timeslot.startTime), 'h:mm a')
  const endTime = format(new Date(timeslot.endTime), 'h:mm a')

  const capacityPercentage = timeslot.capacity > 0
    ? Math.min((timeslot.bookedCovers / timeslot.capacity) * 100, 100)
    : 0

  const capacityColor = capacityPercentage < 75
    ? Neo.lime
    : capacityPercentage < 100
      ? Neo.yellow
      : Neo.pink

  return (
    <View style={[styles.timeslotCard, !timeslot.active && styles.timeslotCardInactive]}>
      <View style={styles.timeslotCardMain}>
        <View style={styles.timeslotTimeSection}>
          <Text style={styles.timeslotTime}>{startTime}</Text>
          <Text style={styles.timeslotTimeSeparator}>to</Text>
          <Text style={styles.timeslotTime}>{endTime}</Text>
        </View>
        <View style={styles.timeslotInfoSection}>
          <View style={styles.capacityRow}>
            <View style={styles.capacityBarSmall}>
              <View
                style={[
                  styles.capacityFillSmall,
                  { width: `${capacityPercentage}%`, backgroundColor: capacityColor },
                ]}
              />
            </View>
            <Text style={styles.capacityLabel}>
              {timeslot.bookedCovers}/{timeslot.capacity}
            </Text>
          </View>
          <Text style={styles.reservationCount}>
            {timeslot.reservationCount} {timeslot.reservationCount === 1 ? 'res' : 'res'}
          </Text>
        </View>
      </View>
      <View style={styles.timeslotCardActions}>
        <Pressable
          style={[
            styles.toggleButton,
            timeslot.active ? styles.toggleButtonActive : styles.toggleButtonInactive,
          ]}
          onPress={onToggle}
          disabled={isToggling}
        >
          {isToggling ? (
            <ActivityIndicator size="small" color={Neo.black} />
          ) : (
            <Text style={styles.toggleButtonText}>{timeslot.active ? 'ON' : 'OFF'}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.deleteButton}
          onPress={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={Neo.white} />
          ) : (
            <Text style={styles.deleteButtonText}>X</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

export default function TimeslotsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = parseInt(id, 10)

  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStartTime, setNewStartTime] = useState<string | null>(null)
  const [newEndTime, setNewEndTime] = useState<string | null>(null)
  const [newCapacity, setNewCapacity] = useState('30')

  const { data: event } = useEvent(eventId)
  const { data: timeslotsData, isLoading, refetch } = useEventTimeslots(eventId)

  const createTimeslot = useCreateTimeslot()
  const toggleTimeslot = useToggleTimeslot()
  const deleteTimeslot = useDeleteTimeslot()

  const timeslots = timeslotsData?.timeslots || []

  // Calculate sensible default times for new timeslot
  const getDefaultTimes = (): { startTime: string; endTime: string } => {
    // If there are existing timeslots, use the end time of the last one
    if (timeslots.length > 0) {
      // Sort by start time to find the last timeslot
      const sortedTimeslots = [...timeslots].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      const lastTimeslot = sortedTimeslots[sortedTimeslots.length - 1]
      const lastEndTime = new Date(lastTimeslot.endTime)

      if (isValid(lastEndTime)) {
        const startTime = format(lastEndTime, 'HH:mm')
        const endTime = format(addHours(lastEndTime, 2), 'HH:mm')
        return { startTime, endTime }
      }
    }

    // If no timeslots, use the event start time
    if (event?.date) {
      const eventDate = parseISO(event.date)
      if (isValid(eventDate) && event.date.includes('T')) {
        const startTime = format(eventDate, 'HH:mm')
        const endTime = format(addHours(eventDate, 2), 'HH:mm')
        return { startTime, endTime }
      }
    }

    // Fallback to 6 PM
    return { startTime: '18:00', endTime: '20:00' }
  }

  const handleOpenAddForm = () => {
    const defaults = getDefaultTimes()
    setNewStartTime(defaults.startTime)
    setNewEndTime(defaults.endTime)
    setNewCapacity('30')
    setShowAddForm(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleAddTimeslot = () => {
    if (!newStartTime || !newEndTime || !newCapacity) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    const capacity = parseInt(newCapacity, 10)
    if (isNaN(capacity) || capacity <= 0) {
      Alert.alert('Error', 'Capacity must be a positive number')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    createTimeslot.mutate(
      {
        eventId,
        eventDate: event ? format(new Date(event.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        startTime: newStartTime,
        endTime: newEndTime,
        capacity,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setShowAddForm(false)
          // Reset to null - defaults will be recalculated when form reopens
          setNewStartTime(null)
          setNewEndTime(null)
          setNewCapacity('30')
        },
        onError: () => {
          Alert.alert('Error', 'Failed to create timeslot')
        },
      }
    )
  }

  const handleToggle = (timeslot: Timeslot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleTimeslot.mutate({ id: timeslot.id, eventId, active: timeslot.active })
  }

  const handleDelete = (timeslot: Timeslot) => {
    if (timeslot.reservationCount > 0) {
      Alert.alert(
        'Cannot Delete',
        `This timeslot has ${timeslot.reservationCount} reservation(s). You cannot delete a timeslot with existing reservations.`
      )
      return
    }

    Alert.alert(
      'Delete Timeslot',
      'Are you sure you want to delete this timeslot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            deleteTimeslot.mutate({ id: timeslot.id, eventId })
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
        }
      >
        {/* Add Timeslot Form */}
        {showAddForm ? (
          <View style={styles.addForm}>
            <SectionHeader title="ADD TIMESLOT" />
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>START TIME</Text>
                <TimePickerButton
                  value={newStartTime}
                  onChange={setNewStartTime}
                  placeholder="Select"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>END TIME</Text>
                <TimePickerButton
                  value={newEndTime}
                  onChange={setNewEndTime}
                  placeholder="Select"
                />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formFieldSmall}>
                <Text style={styles.formLabel}>CAPACITY</Text>
                <TextInput
                  style={styles.capacityInput}
                  value={newCapacity}
                  onChangeText={setNewCapacity}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="30"
                  placeholderTextColor={`${Neo.black}40`}
                />
              </View>
            </View>
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, createTimeslot.isPending && styles.saveButtonDisabled]}
                onPress={handleAddTimeslot}
                disabled={createTimeslot.isPending}
              >
                {createTimeslot.isPending ? (
                  <ActivityIndicator size="small" color={Neo.black} />
                ) : (
                  <Text style={styles.saveButtonText}>ADD TIMESLOT</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.addButton}
            onPress={handleOpenAddForm}
          >
            <Text style={styles.addButtonText}>+ ADD TIMESLOT</Text>
          </Pressable>
        )}

        {/* Existing Timeslots */}
        <SectionHeader title="EXISTING TIMESLOTS" />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Neo.black} />
          </View>
        ) : timeslots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No timeslots yet</Text>
            <Text style={styles.emptySubtext}>Add a timeslot to allow bookings for this event</Text>
          </View>
        ) : (
          <View style={styles.timeslotsList}>
            {timeslots.map((timeslot) => (
              <TimeslotCard
                key={timeslot.id}
                timeslot={timeslot}
                onToggle={() => handleToggle(timeslot)}
                onDelete={() => handleDelete(timeslot)}
                isToggling={toggleTimeslot.isPending && toggleTimeslot.variables?.id === timeslot.id}
                isDeleting={deleteTimeslot.isPending && deleteTimeslot.variables?.id === timeslot.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addForm: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flex: 1,
  },
  formFieldSmall: {
    width: 120,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 14,
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  capacityInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    flex: 2,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  emptySubtext: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  timeslotsList: {
    gap: 12,
  },
  timeslotCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    flexDirection: 'row',
    ...NeoShadow.sm,
  },
  timeslotCardInactive: {
    opacity: 0.6,
  },
  timeslotCardMain: {
    flex: 1,
    padding: 14,
  },
  timeslotTimeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeslotTime: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeslotTimeSeparator: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeslotInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  capacityBarSmall: {
    flex: 1,
    height: 6,
    backgroundColor: Neo.black + '20',
    borderWidth: 1,
    borderColor: Neo.black,
  },
  capacityFillSmall: {
    height: '100%',
  },
  capacityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationCount: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeslotCardActions: {
    borderLeftWidth: NeoBorder.thin,
    borderLeftColor: Neo.black,
  },
  toggleButton: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  toggleButtonActive: {
    backgroundColor: Neo.lime,
  },
  toggleButtonInactive: {
    backgroundColor: Neo.white,
  },
  toggleButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deleteButton: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Neo.pink,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.white,
  },
})
