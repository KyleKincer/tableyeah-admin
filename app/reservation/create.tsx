import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getPaymentModeLabel } from '@/constants/theme'
import { useAvailability, useGuests, useAvailableTables, useEvents, useEventTimeslots } from '@/lib/api/queries'
import { useCreateReservation, useCreateWalkIn, useCreateEventReservation } from '@/lib/api/mutations'
import { DatePicker } from '@/components/ui/DatePicker'
import type { AdminTimeSlot, GuestInfo, AvailableTable, EventListItem, Timeslot } from '@/lib/types'

type BookingMode = 'reservation' | 'walkin' | 'event'

// Party size options
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.toggleButton,
        active && styles.toggleButtonActive,
        pressed && styles.toggleButtonPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function PartySizePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (size: number) => void
}) {
  return (
    <View style={styles.partySizeContainer}>
      {PARTY_SIZES.map((size) => {
        const isSelected = size === value
        return (
          <Pressable
            key={size}
            style={[styles.partySizeButton, isSelected && styles.partySizeButtonSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onChange(size)
            }}
          >
            <Text
              style={[styles.partySizeText, isSelected && styles.partySizeTextSelected]}
            >
              {size}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TimeSlotPicker({
  slots,
  selectedTime,
  onSelectTime,
  isLoading,
}: {
  slots: AdminTimeSlot[]
  selectedTime: string | null
  onSelectTime: (time: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Neo.black} />
        <Text style={styles.loadingText}>Loading times...</Text>
      </View>
    )
  }

  if (slots.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No available times</Text>
      </View>
    )
  }

  return (
    <View style={styles.timeSlotsGrid}>
      {slots.map((slot) => {
        const isSelected = slot.time === selectedTime
        const isDisabled = slot.status === 'full'
        const bgColor =
          slot.status === 'available'
            ? Neo.lime
            : slot.status === 'limited'
              ? Neo.yellow
              : Neo.pink

        return (
          <Pressable
            key={slot.time}
            style={[
              styles.timeSlot,
              { backgroundColor: isSelected ? Neo.black : bgColor },
              isDisabled && styles.timeSlotDisabled,
            ]}
            onPress={() => {
              if (!isDisabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onSelectTime(slot.time)
              }
            }}
            disabled={isDisabled}
          >
            <Text
              style={[
                styles.timeSlotText,
                isSelected && styles.timeSlotTextSelected,
                isDisabled && styles.timeSlotTextDisabled,
              ]}
            >
              {format(new Date(`2000-01-01T${slot.time}`), 'h:mm a')}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function GuestSearchInput({
  value,
  onChange,
  onSelectGuest,
  selectedGuest,
}: {
  value: string
  onChange: (text: string) => void
  onSelectGuest: (guest: GuestInfo | null) => void
  selectedGuest: GuestInfo | null
}) {
  const { data, isLoading } = useGuests(value.length >= 2 ? value : undefined)
  const guests = data?.guests || []
  const showResults = value.length >= 2 && !selectedGuest

  if (selectedGuest) {
    return (
      <View style={styles.selectedGuest}>
        <View style={styles.selectedGuestInfo}>
          <Text style={styles.selectedGuestName}>{selectedGuest.name}</Text>
          {selectedGuest.email && (
            <Text style={styles.selectedGuestEmail}>{selectedGuest.email}</Text>
          )}
          <Text style={styles.selectedGuestStats}>
            {selectedGuest.visitCount} visits
            {(selectedGuest.noShowCount ?? selectedGuest.noShows ?? 0) > 0 && ` · ${selectedGuest.noShowCount ?? selectedGuest.noShows} no-shows`}
          </Text>
        </View>
        <Pressable
          style={styles.clearGuestButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onSelectGuest(null)
            onChange('')
          }}
        >
          <Text style={styles.clearGuestButtonText}>X</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder="Search or enter guest name"
        placeholderTextColor={`${Neo.black}60`}
        autoCapitalize="words"
      />
      {showResults && (
        <View style={styles.guestResults}>
          {isLoading ? (
            <View style={styles.guestResultsLoading}>
              <ActivityIndicator size="small" color={Neo.black} />
            </View>
          ) : guests.length > 0 ? (
            guests.slice(0, 5).map((guest) => (
              <Pressable
                key={guest.id}
                style={styles.guestResultRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onSelectGuest(guest)
                  onChange(guest.name)
                }}
              >
                <Text style={styles.guestResultName}>{guest.name}</Text>
                <Text style={styles.guestResultMeta}>
                  {guest.visitCount} visits
                  {(guest.noShowCount ?? guest.noShows ?? 0) > 0 && ` · ${guest.noShowCount ?? guest.noShows} no-shows`}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.guestResultsEmpty}>
              <Text style={styles.guestResultsEmptyText}>No matching guests</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function TablePicker({
  tables,
  selectedTableIds,
  onToggleTable,
  isLoading,
}: {
  tables: AvailableTable[]
  selectedTableIds: number[]
  onToggleTable: (tableId: number) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Neo.black} />
        <Text style={styles.loadingText}>Loading tables...</Text>
      </View>
    )
  }

  if (tables.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No tables available</Text>
      </View>
    )
  }

  // Group tables by zone
  const tablesByZone = tables.reduce(
    (acc, table) => {
      const zone = table.zone_display_name || 'Other'
      if (!acc[zone]) acc[zone] = []
      acc[zone].push(table)
      return acc
    },
    {} as Record<string, AvailableTable[]>
  )

  return (
    <View style={styles.tablesContainer}>
      {Object.entries(tablesByZone).map(([zone, zoneTables]) => (
        <View key={zone}>
          <Text style={styles.zoneLabel}>{zone.toUpperCase()}</Text>
          <View style={styles.tablesGrid}>
            {zoneTables.map((table) => {
              const isSelected = selectedTableIds.includes(table.id)
              return (
                <Pressable
                  key={table.id}
                  style={[styles.tableButton, isSelected && styles.tableButtonSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onToggleTable(table.id)
                  }}
                >
                  <Text
                    style={[styles.tableNumber, isSelected && styles.tableNumberSelected]}
                  >
                    {table.table_number}
                  </Text>
                  <Text
                    style={[
                      styles.tableCapacity,
                      isSelected && styles.tableCapacitySelected,
                    ]}
                  >
                    {table.min_capacity}-{table.max_capacity}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

function EventPicker({
  events,
  selectedEventId,
  onSelectEvent,
  isLoading,
  showDate = false,
}: {
  events: EventListItem[]
  selectedEventId: number | null
  onSelectEvent: (event: EventListItem | null) => void
  isLoading: boolean
  showDate?: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Neo.black} />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    )
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No upcoming events</Text>
      </View>
    )
  }

  return (
    <View style={styles.eventsContainer}>
      {events.map((event) => {
        const isSelected = event.id === selectedEventId
        const isFull = event.totalCovers >= event.capacity
        const remaining = event.capacity - event.totalCovers
        const paymentLabel = getPaymentModeLabel(event.paymentMode)
        const eventDate = new Date(event.date)

        return (
          <Pressable
            key={event.id}
            style={[
              styles.eventCard,
              isSelected && styles.eventCardSelected,
              isFull && styles.eventCardFull,
            ]}
            onPress={() => {
              if (!isFull) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                onSelectEvent(isSelected ? null : event)
              }
            }}
            disabled={isFull}
          >
            {/* Date banner when showing multiple dates */}
            {showDate && (
              <View style={[styles.eventCardDateBanner, isSelected && styles.eventCardDateBannerSelected]}>
                <Text style={[styles.eventCardDateText, isSelected && styles.eventCardDateTextSelected]}>
                  {format(eventDate, 'EEE, MMM d').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.eventCardHeader}>
              <Text
                style={[
                  styles.eventCardName,
                  isSelected && styles.eventCardNameSelected,
                ]}
                numberOfLines={1}
              >
                {event.name}
              </Text>
              {event.paymentMode !== 'NONE' && (
                <View style={[styles.eventPaymentBadge, { backgroundColor: Neo.lime }]}>
                  <Text style={styles.eventPaymentBadgeText}>{paymentLabel}</Text>
                </View>
              )}
            </View>
            <View style={styles.eventCardMeta}>
              <Text style={styles.eventCardTime}>
                {format(eventDate, 'h:mm a')}
              </Text>
              <Text style={[styles.eventCardCapacity, isFull && { color: Neo.pink }]}>
                {isFull ? 'FULL' : `${remaining} spots left`}
              </Text>
            </View>
            {event.paymentMode === 'PREPAY_PER_PERSON' && event.pricePerPersonCents && (
              <Text style={styles.eventCardPrice}>
                ${(event.pricePerPersonCents / 100).toFixed(2)}/person
              </Text>
            )}
            {event.paymentMode === 'DEPOSIT_PER_PERSON' && event.depositPerPersonCents && (
              <Text style={styles.eventCardPrice}>
                ${(event.depositPerPersonCents / 100).toFixed(2)} deposit/person
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

function EventTimeslotPicker({
  timeslots,
  selectedTimeslotId,
  onSelectTimeslot,
  partySize,
  isLoading,
}: {
  timeslots: Timeslot[]
  selectedTimeslotId: number | null
  onSelectTimeslot: (timeslot: Timeslot | null) => void
  partySize: number
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Neo.black} />
        <Text style={styles.loadingText}>Loading timeslots...</Text>
      </View>
    )
  }

  const activeTimeslots = timeslots.filter(t => t.active)

  if (activeTimeslots.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No timeslots available</Text>
      </View>
    )
  }

  return (
    <View style={styles.timeSlotsGrid}>
      {activeTimeslots.map((slot) => {
        const isSelected = slot.id === selectedTimeslotId
        const remaining = slot.capacity - slot.bookedCovers
        const hasRoom = remaining >= partySize
        const isFull = remaining <= 0

        let bgColor = Neo.lime
        if (isFull) bgColor = Neo.pink
        else if (remaining < partySize) bgColor = Neo.yellow

        return (
          <Pressable
            key={slot.id}
            style={[
              styles.eventTimeslot,
              { backgroundColor: isSelected ? Neo.black : bgColor },
              isFull && styles.timeSlotDisabled,
            ]}
            onPress={() => {
              if (!isFull) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onSelectTimeslot(isSelected ? null : slot)
              }
            }}
            disabled={isFull}
          >
            <Text
              style={[
                styles.eventTimeslotTime,
                isSelected && styles.timeSlotTextSelected,
              ]}
            >
              {format(new Date(slot.startTime), 'h:mm a')}
            </Text>
            <Text
              style={[
                styles.eventTimeslotCapacity,
                isSelected && { color: Neo.white, opacity: 0.8 },
              ]}
            >
              {isFull ? 'FULL' : `${remaining} left`}
            </Text>
            {!hasRoom && !isFull && (
              <Text style={styles.eventTimeslotWarning}>!</Text>
            )}
          </Pressable>
        )
      })}
    </View>
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
        <Text style={styles.actionButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export default function CreateReservationScreen() {
  const router = useRouter()

  // Form state
  const [bookingMode, setBookingMode] = useState<BookingMode>('reservation')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [partySize, setPartySize] = useState(2)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestInfo | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Event-specific state
  const [selectedEvent, setSelectedEvent] = useState<EventListItem | null>(null)
  const [selectedTimeslot, setSelectedTimeslot] = useState<Timeslot | null>(null)

  const isWalkIn = bookingMode === 'walkin'
  const isEvent = bookingMode === 'event'

  // Queries
  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const { data: availabilityData, isLoading: isLoadingAvailability } = useAvailability(
    dateString,
    partySize
  )

  // Event queries - fetch all events, filter client-side
  const { data: allEventsData, isLoading: isLoadingEvents } = useEvents()
  const { data: timeslotsData, isLoading: isLoadingTimeslots } = useEventTimeslots(
    selectedEvent?.id || 0
  )

  // Filter and sort events: active, visible, upcoming (today or future), sorted by date
  const today = startOfDay(new Date())
  const upcomingEvents = (allEventsData?.events || [])
    .filter(event => {
      if (!event.active) return false
      const eventDate = parseISO(event.date)
      return isAfter(eventDate, today) || format(eventDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // For tables, we need date/time/partySize
  // Walk-ins use current date/time, reservations use selected values
  const now = new Date()
  const tableQueryDate = isWalkIn ? format(now, 'yyyy-MM-dd') : dateString
  const tableQueryTime = isWalkIn
    ? format(now, 'HH:mm')
    : selectedTime || format(now, 'HH:mm')
  const { data: tablesData, isLoading: isLoadingTables } = useAvailableTables(
    tableQueryDate,
    tableQueryTime,
    partySize
  )

  // Mutations
  const createReservation = useCreateReservation()
  const createWalkIn = useCreateWalkIn()
  const createEventReservation = useCreateEventReservation()

  const slots = availabilityData?.slots || []
  const tables = tablesData?.tables || []
  const timeslots = timeslotsData?.timeslots || []

  const handleToggleTable = (tableId: number) => {
    setSelectedTableIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    )
  }

  const handleSelectGuest = (guest: GuestInfo | null) => {
    setSelectedGuest(guest)
    if (guest) {
      setEmail(guest.email || '')
    }
  }

  const handleSelectEvent = (event: EventListItem | null) => {
    setSelectedEvent(event)
    setSelectedTimeslot(null) // Reset timeslot when event changes
    // Auto-set the date to match the event
    if (event) {
      setSelectedDate(parseISO(event.date))
    }
  }

  const handleSelectTimeslot = (timeslot: Timeslot | null) => {
    setSelectedTimeslot(timeslot)
  }

  const handleModeChange = (mode: BookingMode) => {
    setBookingMode(mode)
    // Reset event-specific state when changing modes
    if (mode !== 'event') {
      setSelectedEvent(null)
      setSelectedTimeslot(null)
    }
    // Reset regular reservation time when switching away
    if (mode !== 'reservation') {
      setSelectedTime(null)
    }
  }

  // Validation
  const canSubmitWalkIn = guestName.trim().length > 0 && partySize > 0
  const canSubmitReservation = guestName.trim().length > 0 && partySize > 0 && selectedTime !== null
  const canSubmitEvent = guestName.trim().length > 0 && partySize > 0 && selectedEvent !== null &&
    (timeslots.length === 0 || selectedTimeslot !== null) // Allow no timeslot if event has none

  const canSubmit = isWalkIn ? canSubmitWalkIn : isEvent ? canSubmitEvent : canSubmitReservation

  const handleSubmit = () => {
    if (!canSubmit) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (isWalkIn) {
      createWalkIn.mutate(
        {
          covers: partySize,
          name: guestName.trim(),
          tableIds: selectedTableIds.length > 0 ? selectedTableIds : undefined,
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.back()
          },
          onError: () => {
            Alert.alert('Error', 'Failed to create walk-in')
          },
        }
      )
    } else if (isEvent && selectedEvent) {
      createEventReservation.mutate(
        {
          eventId: selectedEvent.id,
          timeslotId: selectedTimeslot?.id,
          covers: partySize,
          name: guestName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.back()
          },
          onError: (error) => {
            Alert.alert('Error', error.message || 'Failed to create event reservation')
          },
        }
      )
    } else {
      createReservation.mutate(
        {
          date: dateString,
          time: selectedTime!,
          covers: partySize,
          name: guestName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          tableIds: selectedTableIds.length > 0 ? selectedTableIds : undefined,
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.back()
          },
          onError: () => {
            Alert.alert('Error', 'Failed to create reservation')
          },
        }
      )
    }
  }

  const isMutating = createReservation.isPending || createWalkIn.isPending || createEventReservation.isPending

  // Calculate pricing for event booking
  const eventPricing = selectedEvent && partySize > 0 ? (() => {
    if (selectedEvent.paymentMode === 'PREPAY_PER_PERSON' && selectedEvent.pricePerPersonCents) {
      return {
        label: 'Total',
        amount: (selectedEvent.pricePerPersonCents * partySize) / 100,
      }
    }
    if (selectedEvent.paymentMode === 'DEPOSIT_PER_PERSON' && selectedEvent.depositPerPersonCents) {
      return {
        label: 'Deposit',
        amount: (selectedEvent.depositPerPersonCents * partySize) / 100,
      }
    }
    return null
  })() : null

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Booking Mode Toggle */}
          <View style={styles.toggleContainer}>
            <ToggleButton
              label="RESERVATION"
              active={bookingMode === 'reservation'}
              onPress={() => handleModeChange('reservation')}
            />
            <ToggleButton
              label="WALK-IN"
              active={bookingMode === 'walkin'}
              onPress={() => handleModeChange('walkin')}
            />
            <ToggleButton
              label="EVENT"
              active={bookingMode === 'event'}
              onPress={() => handleModeChange('event')}
            />
          </View>

          {/* Event Booking: Event Selection FIRST (event-first UX) */}
          {isEvent && (
            <>
              <SectionHeader title="SELECT EVENT" />
              <EventPicker
                events={upcomingEvents}
                selectedEventId={selectedEvent?.id || null}
                onSelectEvent={handleSelectEvent}
                isLoading={isLoadingEvents}
                showDate={true}
              />

              {/* Timeslots for selected event */}
              {selectedEvent && timeslots.length > 0 && (
                <>
                  <SectionHeader title="SELECT TIMESLOT" />
                  <EventTimeslotPicker
                    timeslots={timeslots}
                    selectedTimeslotId={selectedTimeslot?.id || null}
                    onSelectTimeslot={handleSelectTimeslot}
                    partySize={partySize}
                    isLoading={isLoadingTimeslots}
                  />
                </>
              )}
            </>
          )}

          {/* Date - For regular reservations only */}
          {bookingMode === 'reservation' && (
            <>
              <SectionHeader title="DATE" />
              <Pressable
                style={styles.dateButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowDatePicker(true)
                }}
              >
                <Text style={styles.dateButtonText}>
                  {format(selectedDate, 'EEEE, MMMM d, yyyy').toUpperCase()}
                </Text>
              </Pressable>
            </>
          )}

          {/* Regular Reservation: Time Slots */}
          {bookingMode === 'reservation' && (
            <>
              <SectionHeader title="TIME" />
              <TimeSlotPicker
                slots={slots}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
                isLoading={isLoadingAvailability}
              />
            </>
          )}

          {/* Party Size */}
          <SectionHeader title="PARTY SIZE" />
          <PartySizePicker value={partySize} onChange={setPartySize} />

          {/* Guest Info */}
          <SectionHeader title="GUEST" />
          <GuestSearchInput
            value={guestName}
            onChange={setGuestName}
            onSelectGuest={handleSelectGuest}
            selectedGuest={selectedGuest}
          />

          {!selectedGuest && (
            <>
              <TextInput
                style={[styles.textInput, { marginTop: 12 }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email (optional)"
                placeholderTextColor={`${Neo.black}60`}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.textInput, { marginTop: 12 }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone (optional)"
                placeholderTextColor={`${Neo.black}60`}
                keyboardType="phone-pad"
              />
            </>
          )}

          {/* Tables - Not for event bookings */}
          {!isEvent && (
            <>
              <SectionHeader title="TABLE (OPTIONAL)" />
              <TablePicker
                tables={tables}
                selectedTableIds={selectedTableIds}
                onToggleTable={handleToggleTable}
                isLoading={isLoadingTables}
              />
            </>
          )}

          {/* Notes - Only for reservations and events */}
          {!isWalkIn && (
            <>
              <SectionHeader title="NOTES (OPTIONAL)" />
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special requests, allergies, etc."
                placeholderTextColor={`${Neo.black}60`}
                multiline
                numberOfLines={3}
              />
            </>
          )}

          {/* Pricing Summary for Event Bookings */}
          {isEvent && eventPricing && (
            <View style={styles.pricingSummary}>
              <Text style={styles.pricingSummaryLabel}>{eventPricing.label.toUpperCase()}</Text>
              <Text style={styles.pricingSummaryAmount}>${eventPricing.amount.toFixed(2)}</Text>
              <Text style={styles.pricingSummaryNote}>
                {selectedEvent?.paymentMode === 'PREPAY_PER_PERSON'
                  ? 'Payment link will be sent to guest'
                  : 'Deposit required at booking'}
              </Text>
            </View>
          )}

          {/* Submit */}
          <View style={styles.submitContainer}>
            <NeoButton
              label={
                isWalkIn
                  ? 'SEAT WALK-IN'
                  : isEvent
                    ? selectedEvent?.paymentMode === 'NONE'
                      ? 'CREATE EVENT BOOKING'
                      : 'CREATE & SEND PAYMENT LINK'
                    : 'CREATE RESERVATION'
              }
              onPress={handleSubmit}
              disabled={!canSubmit || isMutating}
              loading={isMutating}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal - Only for regular reservations */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date)
          setSelectedTime(null) // Reset time when date changes
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  toggleButtonActive: {
    backgroundColor: Neo.lime,
  },
  toggleButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleButtonTextActive: {
    color: Neo.black,
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
  dateButton: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  partySizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  partySizeButton: {
    width: 48,
    height: 48,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partySizeButtonSelected: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
  },
  partySizeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  partySizeTextSelected: {
    fontWeight: '900',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  loadingText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptySlots: {
    padding: 16,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
  },
  emptySlotsText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  timeSlotDisabled: {
    opacity: 0.4,
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeSlotTextSelected: {
    color: Neo.white,
  },
  timeSlotTextDisabled: {
    color: Neo.black,
  },
  textInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedGuest: {
    flexDirection: 'row',
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  selectedGuestInfo: {
    flex: 1,
  },
  selectedGuestName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  selectedGuestEmail: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.7,
  },
  selectedGuestStats: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.6,
  },
  clearGuestButton: {
    width: 32,
    height: 32,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearGuestButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
  },
  guestResults: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderTopWidth: 0,
    maxHeight: 200,
  },
  guestResultsLoading: {
    padding: 16,
    alignItems: 'center',
  },
  guestResultRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black,
  },
  guestResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  guestResultMeta: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.6,
  },
  guestResultsEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  guestResultsEmptyText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tablesContainer: {
    gap: 16,
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
    opacity: 0.6,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableButton: {
    width: 64,
    height: 64,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableButtonSelected: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableNumberSelected: {
    fontWeight: '900',
  },
  tableCapacity: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    marginTop: 2,
  },
  tableCapacitySelected: {
    opacity: 1,
  },
  submitContainer: {
    marginTop: 32,
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
  // Event booking styles
  eventsContainer: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.sm,
  },
  eventCardSelected: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default + 1,
  },
  eventCardFull: {
    opacity: 0.5,
  },
  eventCardDateBanner: {
    backgroundColor: Neo.yellow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    marginHorizontal: -16,
    marginTop: -16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  eventCardDateBannerSelected: {
    backgroundColor: Neo.black,
  },
  eventCardDateText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventCardDateTextSelected: {
    color: Neo.white,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventCardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  eventCardNameSelected: {
    color: Neo.black,
  },
  eventPaymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  eventPaymentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  eventCardTime: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventCardCapacity: {
    fontSize: 11,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  eventCardPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
  },
  eventTimeslot: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
    minWidth: 100,
  },
  eventTimeslotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventTimeslotCapacity: {
    fontSize: 10,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.7,
  },
  eventTimeslotWarning: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 12,
    fontWeight: '900',
    color: Neo.pink,
  },
  pricingSummary: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  pricingSummaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  pricingSummaryAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  pricingSummaryNote: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
    opacity: 0.7,
    textAlign: 'center',
  },
})
