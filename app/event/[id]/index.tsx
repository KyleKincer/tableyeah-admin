import { format, parseISO, isValid } from 'date-fns'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
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

import { Neo, NeoBorder, NeoShadow, getPaymentModeLabel } from '@/constants/theme'
import { useEvent, useEventTimeslots, useEventReservations, useEventImages } from '@/lib/api/queries'
import { useUpdateEvent, useDeleteEvent } from '@/lib/api/mutations'
import { useQueryClient } from '@tanstack/react-query'
import type { Event } from '@/lib/types'
import { PaymentModeBadge } from '@/components/event/PaymentBadge'
import { EventImagesSection } from '@/components/event/EventImagesSection'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  )
}

function EditableInfoRow({
  label,
  value,
  onPress,
}: {
  label: string
  value: string | number | null | undefined
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.infoRow, styles.infoRowEditable, pressed && styles.infoRowPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueContainer}>
        <Text style={styles.infoValue}>{value ?? '—'}</Text>
        <Text style={styles.editIcon}>✎</Text>
      </View>
    </Pressable>
  )
}

function NavCard({
  title,
  subtitle,
  onPress,
  color = Neo.white,
}: {
  title: string
  subtitle: string
  onPress: () => void
  color?: string
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.navCard,
        { backgroundColor: color },
        pressed && styles.navCardPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={styles.navCardContent}>
        <Text style={styles.navCardTitle}>{title}</Text>
        <Text style={styles.navCardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.navCardArrow}>→</Text>
    </Pressable>
  )
}

function NeoSwitch({
  label,
  description,
  value,
  onToggle,
  disabled,
}: {
  label: string
  description?: string
  value: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={styles.switchRow}
      onPress={() => {
        if (!disabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onToggle()
        }
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.switchLabelContainer}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description && <Text style={styles.switchDescription}>{description}</Text>}
      </View>
      <View
        style={[
          styles.switchTrack,
          value ? styles.switchTrackOn : styles.switchTrackOff,
        ]}
      >
        <View
          style={[
            styles.switchKnob,
            value ? styles.switchKnobOn : styles.switchKnobOff,
          ]}
        />
      </View>
    </Pressable>
  )
}

function NeoButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  loading?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor =
    variant === 'destructive'
      ? Neo.pink
      : variant === 'primary'
        ? Neo.lime
        : Neo.white

  return (
    <Pressable
      style={[
        styles.actionButton,
        { backgroundColor: bgColor },
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Neo.black} size="small" />
      ) : (
        <Text style={[styles.actionButtonText, variant === 'destructive' && { color: Neo.white }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export default function EventDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = parseInt(id, 10)

  const [refreshing, setRefreshing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showCapacityEditor, setShowCapacityEditor] = useState(false)

  const queryClient = useQueryClient()
  const { data: event, isLoading, refetch } = useEvent(eventId)
  const { data: timeslotsData } = useEventTimeslots(eventId)
  const { data: reservationsData } = useEventReservations(eventId)
  const { data: imagesData, refetch: refetchImages } = useEventImages(eventId)

  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()

  const timeslots = timeslotsData?.timeslots || []
  const reservations = reservationsData?.reservations || []
  const summary = reservationsData?.summary
  const images = imagesData?.images || []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleStartEdit = () => {
    if (event) {
      setEditName(event.name)
      setIsEditing(true)
    }
  }

  const handleSaveEdit = () => {
    if (!editName.trim()) return

    updateEvent.mutate(
      { id: eventId, name: editName.trim() },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setIsEditing(false)
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update event')
        },
      }
    )
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName('')
  }

  // Optimistic toggle for active status
  const handleToggleActive = () => {
    if (!event) return
    const newValue = !event.active

    // Optimistically update the cache
    queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
      old ? { ...old, active: newValue } : old
    )

    updateEvent.mutate(
      { id: eventId, active: newValue },
      {
        onError: () => {
          // Revert on error
          queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
            old ? { ...old, active: !newValue } : old
          )
          Alert.alert('Error', 'Failed to update event')
        },
      }
    )
  }

  // Optimistic toggle for visible status
  const handleToggleVisible = () => {
    if (!event) return
    const newValue = !event.visible

    // Optimistically update the cache
    queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
      old ? { ...old, visible: newValue } : old
    )

    updateEvent.mutate(
      { id: eventId, visible: newValue },
      {
        onError: () => {
          // Revert on error
          queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
            old ? { ...old, visible: !newValue } : old
          )
          Alert.alert('Error', 'Failed to update event')
        },
      }
    )
  }

  // Handle date update
  const handleDateChange = (newDate: Date) => {
    if (!event) return
    const dateString = format(newDate, 'yyyy-MM-dd')
    const oldEventDate = event.date

    // Preserve existing time when updating date
    const existingEventDate = parseISO(event.date)
    const hasExistingTime = event.date.includes('T') && isValid(existingEventDate)
    const existingTime = hasExistingTime ? format(existingEventDate, 'HH:mm:ss') : '00:00:00'
    const newISODate = `${dateString}T${existingTime}`

    // Optimistically update
    queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
      old ? { ...old, date: newISODate } : old
    )

    updateEvent.mutate(
      { id: eventId, date: dateString },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setShowDatePicker(false)
        },
        onError: () => {
          queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
            old ? { ...old, date: oldEventDate } : old
          )
          Alert.alert('Error', 'Failed to update date')
        },
      }
    )
  }

  // Handle time update
  const handleTimeChange = (newTime: string) => {
    if (!event) return
    const oldEventDate = event.date

    // Combine existing date with new time for optimistic update
    const existingEventDate = parseISO(event.date)
    const dateString = isValid(existingEventDate)
      ? format(existingEventDate, 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
    const newISODate = `${dateString}T${newTime}:00`

    // Optimistically update
    queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
      old ? { ...old, date: newISODate } : old
    )

    updateEvent.mutate(
      { id: eventId, time: newTime },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setShowTimePicker(false)
        },
        onError: () => {
          queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
            old ? { ...old, date: oldEventDate } : old
          )
          Alert.alert('Error', 'Failed to update time')
        },
      }
    )
  }

  // Handle capacity update
  const handleCapacityChange = (newCapacity: number) => {
    if (!event) return
    const oldCapacity = event.capacity

    // Optimistically update
    queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
      old ? { ...old, capacity: newCapacity } : old
    )

    updateEvent.mutate(
      { id: eventId, capacity: newCapacity },
      {
        onError: () => {
          queryClient.setQueryData(['event', eventId], (old: Event | undefined) =>
            old ? { ...old, capacity: oldCapacity } : old
          )
          Alert.alert('Error', 'Failed to update capacity')
        },
      }
    )
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent.mutate(eventId, {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                router.back()
              },
              onError: () => {
                Alert.alert('Error', 'Failed to delete event')
              },
            })
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Neo.black} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>EVENT NOT FOUND</Text>
          <NeoButton label="GO BACK" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    )
  }

  // Parse date - handle both ISO timestamps and date-only strings
  const eventDate = parseISO(event.date)
  const hasTime = event.date.includes('T') && isValid(eventDate)
  const dateLabel = isValid(eventDate) ? format(eventDate, 'EEEE, MMMM d, yyyy') : 'Invalid date'
  const timeLabel = hasTime ? format(eventDate, 'h:mm a') : 'No time set'
  // Extract time in HH:mm format for the picker
  const currentTime = hasTime ? format(eventDate, 'HH:mm') : null
  const capacityFill = event.capacity > 0
    ? Math.round((event.totalCovers / event.capacity) * 100)
    : 0

  const activeTimeslots = timeslots.filter((t) => t.active).length
  const totalTimeslotCapacity = timeslots.reduce((sum, t) => sum + t.capacity, 0)

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
        }
      >
        {/* Event Header */}
        <View style={styles.headerCard}>
          {isEditing ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.editNameButtons}>
                <Pressable style={styles.editButton} onPress={handleCancelEdit}>
                  <Text style={styles.editButtonText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[styles.editButton, styles.editButtonSave]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.editButtonText}>SAVE</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={handleStartEdit}>
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.editHint}>TAP TO EDIT</Text>
            </Pressable>
          )}
        </View>

        {/* Settings Toggles */}
        <View style={styles.settingsCard}>
          <NeoSwitch
            label="Accepting Reservations"
            description={event.active ? 'Guests can book this event' : 'Bookings are paused'}
            value={event.active}
            onToggle={handleToggleActive}
          />
          <View style={styles.settingsDivider} />
          <NeoSwitch
            label="Visible to Public"
            description={event.visible ? 'Shown on your booking page' : 'Hidden from guests'}
            value={event.visible}
            onToggle={handleToggleVisible}
          />
        </View>

        {/* Details Card */}
        <SectionHeader title="DETAILS" />
        <View style={styles.detailsCard}>
          <EditableInfoRow
            label="DATE"
            value={dateLabel}
            onPress={() => setShowDatePicker(true)}
          />
          <EditableInfoRow
            label="TIME"
            value={timeLabel}
            onPress={() => setShowTimePicker(true)}
          />
          {showCapacityEditor ? (
            <View style={styles.capacityEditorRow}>
              <Text style={styles.infoLabel}>CAPACITY</Text>
              <View style={styles.capacityControls}>
                <Pressable
                  style={styles.capacityButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleCapacityChange(Math.max(1, event.capacity - 10))
                  }}
                >
                  <Text style={styles.capacityButtonText}>−10</Text>
                </Pressable>
                <Pressable
                  style={styles.capacityButtonSmall}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleCapacityChange(Math.max(1, event.capacity - 1))
                  }}
                >
                  <Text style={styles.capacityButtonText}>−</Text>
                </Pressable>
                <View style={styles.capacityValue}>
                  <Text style={styles.capacityValueText}>{event.capacity}</Text>
                </View>
                <Pressable
                  style={styles.capacityButtonSmall}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleCapacityChange(event.capacity + 1)
                  }}
                >
                  <Text style={styles.capacityButtonText}>+</Text>
                </Pressable>
                <Pressable
                  style={styles.capacityButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleCapacityChange(event.capacity + 10)
                  }}
                >
                  <Text style={styles.capacityButtonText}>+10</Text>
                </Pressable>
                <Pressable
                  style={styles.capacityDoneButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setShowCapacityEditor(false)
                  }}
                >
                  <Text style={styles.capacityDoneText}>✓</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <EditableInfoRow
              label="CAPACITY"
              value={`${event.totalCovers} / ${event.capacity} covers (${capacityFill}%)`}
              onPress={() => setShowCapacityEditor(true)}
            />
          )}
          <InfoRow label="RESERVATIONS" value={event.reservationCount} />
        </View>

        {/* Navigation Cards */}
        <SectionHeader title="MANAGE" />

        <NavCard
          title="TIMESLOTS"
          subtitle={`${activeTimeslots} active · ${totalTimeslotCapacity} total capacity`}
          onPress={() => router.push(`/event/${eventId}/timeslots`)}
          color={Neo.cyan + '40'}
        />

        <NavCard
          title="PRICING"
          subtitle={event.paymentMode === 'NONE'
            ? 'Free event'
            : `${getPaymentModeLabel(event.paymentMode)} · $${((event.pricePerPersonCents || event.depositPerPersonCents || 0) / 100).toFixed(0)}/person`}
          onPress={() => router.push(`/event/${eventId}/pricing`)}
          color={Neo.lime + '40'}
        />

        <NavCard
          title="RESERVATIONS"
          subtitle={summary
            ? `${reservations.length} bookings · $${(summary.netRevenue / 100).toFixed(0)} revenue`
            : `${event.reservationCount} bookings`}
          onPress={() => router.push(`/event/${eventId}/reservations`)}
          color={Neo.yellow + '40'}
        />

        {/* Payment Badge */}
        <SectionHeader title="PAYMENT MODE" />
        <View style={styles.paymentInfo}>
          <PaymentModeBadge
            mode={event.paymentMode}
            pricePerPersonCents={event.pricePerPersonCents || event.depositPerPersonCents}
            currency={event.currency}
          />
        </View>

        {/* Images Section */}
        <View style={styles.imagesSection}>
          <EventImagesSection
            eventId={eventId}
            images={images}
            primaryImageUrl={null}
            onImagesChanged={() => refetchImages()}
          />
        </View>

        {/* Delete Button */}
        <View style={styles.deleteContainer}>
          <NeoButton
            label="DELETE EVENT"
            onPress={handleDelete}
            variant="destructive"
            loading={deleteEvent.isPending}
          />
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={isValid(parseISO(event.date)) ? parseISO(event.date) : new Date()}
        onSelectDate={handleDateChange}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Time Picker Modal */}
      {showTimePicker && (
        <View style={styles.timePickerOverlay}>
          <Pressable style={styles.timePickerBackdrop} onPress={() => setShowTimePicker(false)} />
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>SELECT TIME</Text>
            </View>
            <TimePicker
              value={currentTime}
              onChange={(time) => {
                handleTimeChange(time)
              }}
              placeholder="Select time"
            />
            <Pressable
              style={styles.timePickerCancel}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.timePickerCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 16,
  },
  headerCard: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    ...NeoShadow.default,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  editHint: {
    fontSize: 9,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.5,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editNameContainer: {
    gap: 12,
  },
  editNameInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  editNameButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editButtonSave: {
    backgroundColor: Neo.lime,
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  settingsCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    marginTop: 16,
    ...NeoShadow.sm,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: Neo.black + '20',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  switchDescription: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  switchTrack: {
    width: 52,
    height: 32,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    padding: 3,
  },
  switchTrackOn: {
    backgroundColor: Neo.lime,
  },
  switchTrackOff: {
    backgroundColor: Neo.white,
  },
  switchKnob: {
    width: 24,
    height: 24,
    backgroundColor: Neo.black,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchKnobOff: {
    alignSelf: 'flex-start',
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
  detailsCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  infoRowEditable: {
    backgroundColor: Neo.white,
  },
  infoRowPressed: {
    backgroundColor: Neo.cream,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 16,
    gap: 8,
  },
  editIcon: {
    fontSize: 14,
    color: Neo.black,
    opacity: 0.4,
  },
  capacityEditorRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
    gap: 12,
  },
  capacityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  capacityButton: {
    width: 44,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityButtonSmall: {
    width: 32,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityValue: {
    width: 64,
    height: 40,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityValueText: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityDoneButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  capacityDoneText: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 12,
  },
  navCardPressed: {
    opacity: 0.8,
  },
  navCardContent: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  navCardSubtitle: {
    fontSize: 11,
    color: '#4A4A4A',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  navCardArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
  },
  paymentInfo: {
    flexDirection: 'row',
  },
  imagesSection: {
    marginTop: 24,
  },
  deleteContainer: {
    marginTop: 48,
  },
  actionButton: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...NeoShadow.sm,
  },
  actionButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timePickerContainer: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    margin: 20,
    ...NeoShadow.lg,
  },
  timePickerHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timePickerCancel: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
