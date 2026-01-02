import { format, addDays, subDays, isToday } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Swipeable } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor } from '@/constants/theme'
import { useReservations } from '@/lib/api/queries'
import {
  useSeatReservation,
  useConfirmReservation,
  useCompleteReservation,
  useCancelReservation,
  useMarkNoShow,
} from '@/lib/api/mutations'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import { DatePicker } from '@/components/ui/DatePicker'
import { DetailPanel } from '@/components/reservation/DetailPanel'
import { ContactActionSheet, type ContactInfo, type RowPosition } from '@/components/ui/ContactActionSheet'
import { SeatingProgressBar } from '@/components/reservation/SeatingProgressBar'
import type { Reservation, ReservationStatus } from '@/lib/types'

const STATUS_FILTERS: { key: ReservationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'BOOKED', label: 'BOOKED' },
  { key: 'CONFIRMED', label: 'CONFIRMED' },
  { key: 'SEATED', label: 'SEATED' },
  { key: 'COMPLETED', label: 'DONE' },
]

function StatusBadge({ status }: { status: ReservationStatus }) {
  const bgColor = getStatusColor(status)
  const textColor = [Neo.lime, Neo.cyan, Neo.yellow].includes(bgColor)
    ? Neo.black
    : Neo.white

  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusText, { color: textColor }]}>{status}</Text>
    </View>
  )
}

function WalkInBadge() {
  return (
    <View style={styles.walkInBadge}>
      <Text style={styles.walkInBadgeText}>WALK-IN</Text>
    </View>
  )
}


interface SwipeAction {
  label: string
  color: string
  textColor?: string
  onPress: () => void
}

function SwipeableReservationRow({
  reservation,
  onPress,
  onLongPress,
  isSelected,
  onSeat,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
  showSwipeHint = true,
}: {
  reservation: Reservation
  onPress: () => void
  onLongPress: (position: RowPosition) => void
  isSelected?: boolean
  onSeat: () => void
  onConfirm: () => void
  onComplete: () => void
  onCancel: () => void
  onNoShow: () => void
  showSwipeHint?: boolean
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const rowRef = useRef<View>(null)
  const [pressed, setPressed] = useState(false)
  const time = format(new Date(`2000-01-01T${reservation.time}`), 'h:mm a')
  const tables =
    reservation.table_numbers && reservation.table_numbers.length > 0
      ? reservation.table_numbers.join(', ')
      : '—'

  const bgColor = getStatusColor(reservation.status)
  const isWalkIn = reservation.is_walk_in === true
  const status = reservation.status

  // Determine which actions to show based on current status
  const getLeftAction = (): SwipeAction | null => {
    if (status === 'BOOKED') {
      return { label: 'CONFIRM', color: Neo.lime, onPress: onConfirm }
    }
    if (status === 'CONFIRMED') {
      return { label: 'SEAT', color: Neo.cyan, onPress: onSeat }
    }
    if (status === 'SEATED') {
      return { label: 'COMPLETE', color: Neo.lime, onPress: onComplete }
    }
    return null
  }

  const getRightActions = (): SwipeAction[] => {
    const actions: SwipeAction[] = []
    if (status === 'BOOKED' || status === 'CONFIRMED') {
      actions.push({ label: 'NO-SHOW', color: Neo.orange, onPress: onNoShow })
      actions.push({ label: 'CANCEL', color: Neo.pink, textColor: Neo.white, onPress: onCancel })
    }
    if (status === 'SEATED') {
      actions.push({ label: 'NO-SHOW', color: Neo.orange, onPress: onNoShow })
    }
    return actions
  }

  const leftAction = getLeftAction()
  const rightActions = getRightActions()

  const handleAction = (action: SwipeAction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    swipeableRef.current?.close()
    action.onPress()
  }

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!leftAction) return null

    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    })

    return (
      <Pressable
        style={[styles.swipeAction, styles.swipeActionLeft, { backgroundColor: leftAction.color }]}
        onPress={() => handleAction(leftAction)}
        accessibilityLabel={leftAction.label}
        accessibilityRole="button"
      >
        <Animated.Text
          style={[
            styles.swipeActionText,
            { color: leftAction.textColor || Neo.black, transform: [{ scale }] },
          ]}
        >
          {leftAction.label}
        </Animated.Text>
      </Pressable>
    )
  }

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (rightActions.length === 0) return null

    return (
      <View style={styles.rightActionsContainer}>
        {rightActions.map((action, index) => {
          const scale = dragX.interpolate({
            inputRange: [-80 * (rightActions.length - index), 0],
            outputRange: [1, 0.5],
            extrapolate: 'clamp',
          })

          return (
            <Pressable
              key={action.label}
              style={[styles.swipeAction, { backgroundColor: action.color }]}
              onPress={() => handleAction(action)}
              accessibilityLabel={action.label}
              accessibilityRole="button"
            >
              <Animated.Text
                style={[
                  styles.swipeActionText,
                  { color: action.textColor || Neo.black, transform: [{ scale }] },
                ]}
              >
                {action.label}
              </Animated.Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  const hasSwipeActions = leftAction || rightActions.length > 0

  const showProgressBar =
    reservation.status === 'SEATED' &&
    reservation.seated_at &&
    reservation.expected_turn_time

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    rowRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress({ y, height })
    })
  }

  const rowContent = (
    <View ref={rowRef} collapsable={false}>
      <Pressable
        style={[
          styles.reservationRow,
          pressed && styles.reservationRowPressed,
          isSelected && styles.reservationRowSelected,
        ]}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={400}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${reservation.name}, ${time}, ${reservation.covers} guests, ${reservation.status}${isWalkIn ? ', walk-in' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityHint={hasSwipeActions ? "Tap to view details, swipe for quick actions, hold for contact options" : "Hold for contact options"}
    >
      <View style={styles.reservationRowInner}>
        <View style={[styles.reservationTime, { backgroundColor: bgColor }]}>
          <Text style={styles.timeText}>{time}</Text>
          <Text style={styles.coversText}>
            {reservation.covers} {reservation.covers === 1 ? 'guest' : 'guests'}
          </Text>
        </View>
        <View style={styles.reservationDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.guestName} numberOfLines={1}>{reservation.name}</Text>
            {isWalkIn && <WalkInBadge />}
          </View>
          <Text style={styles.reservationMeta}>
            Table {tables}
          </Text>
          {reservation.notes && (
            <Text style={styles.notes} numberOfLines={1}>
              {reservation.notes}
            </Text>
          )}
        </View>
        <View style={styles.statusContainer}>
          <StatusBadge status={reservation.status} />
          {hasSwipeActions && showSwipeHint && (
            <Text style={styles.swipeHint}>← SWIPE →</Text>
          )}
        </View>
      </View>
      {showProgressBar && (
        <SeatingProgressBar
          seatedAt={reservation.seated_at!}
          expectedMinutes={reservation.expected_turn_time!}
        />
      )}
      </Pressable>
    </View>
  )

  if (!hasSwipeActions) {
    return rowContent
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={leftAction ? renderLeftActions : undefined}
      renderRightActions={rightActions.length > 0 ? renderRightActions : undefined}
      leftThreshold={80}
      rightThreshold={80}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
    >
      {rowContent}
    </Swipeable>
  )
}

function DateSelector({
  date,
  onDateChange,
  onOpenPicker,
  reservations,
  covers,
  isLoading,
}: {
  date: Date
  onDateChange: (date: Date) => void
  onOpenPicker: () => void
  reservations: number
  covers: number
  isLoading: boolean
}) {
  const dateLabel = isToday(date) ? 'TODAY' : format(date, 'EEE, MMM d').toUpperCase()
  const statsLabel = isLoading ? '-- RES • -- COV' : `${reservations} RES • ${covers} COV`
  const [prevPressed, setPrevPressed] = useState(false)
  const [nextPressed, setNextPressed] = useState(false)
  const [datePressed, setDatePressed] = useState(false)

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDateChange(subDays(date, 1))
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDateChange(addDays(date, 1))
  }

  const handleOpenPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onOpenPicker()
  }

  return (
    <View style={styles.dateSelector}>
      <Pressable
        style={[styles.dateButton, prevPressed && styles.dateButtonPressed]}
        onPress={handlePrev}
        onPressIn={() => setPrevPressed(true)}
        onPressOut={() => setPrevPressed(false)}
        accessibilityLabel="Previous day"
        accessibilityRole="button"
      >
        <Text style={styles.dateButtonText}>{'<'}</Text>
      </Pressable>
      <Pressable
        style={[styles.dateDisplay, datePressed && styles.dateDisplayPressed]}
        onPress={handleOpenPicker}
        onPressIn={() => setDatePressed(true)}
        onPressOut={() => setDatePressed(false)}
        accessibilityLabel={`Selected date: ${format(date, 'EEEE, MMMM d, yyyy')}. Tap to open calendar`}
        accessibilityRole="button"
      >
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.dateHint}>{statsLabel}</Text>
      </Pressable>
      <Pressable
        style={[styles.dateButton, nextPressed && styles.dateButtonPressed]}
        onPress={handleNext}
        onPressIn={() => setNextPressed(true)}
        onPressOut={() => setNextPressed(false)}
        accessibilityLabel="Next day"
        accessibilityRole="button"
      >
        <Text style={styles.dateButtonText}>{'>'}</Text>
      </Pressable>
    </View>
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
      accessibilityLabel="Create new reservation"
      accessibilityRole="button"
      accessibilityHint="Opens the create reservation screen"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

export default function ReservationsScreen() {
  const router = useRouter()
  const { isTablet, isLandscape } = useDeviceType()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null)
  const [actionSheetContact, setActionSheetContact] = useState<ContactInfo | null>(null)
  const [actionSheetPosition, setActionSheetPosition] = useState<RowPosition | null>(null)

  // Use split layout on tablets in landscape mode
  const useSplitLayout = isTablet && isLandscape

  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const { data, isLoading, refetch } = useReservations(dateString)
  const [refreshing, setRefreshing] = useState(false)

  // Mutations for quick actions
  const seatMutation = useSeatReservation()
  const confirmMutation = useConfirmReservation()
  const completeMutation = useCompleteReservation()
  const cancelMutation = useCancelReservation()
  const noShowMutation = useMarkNoShow()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const reservations = data?.reservations || []

  // Calculate day summary stats (excluding cancelled and no-shows)
  const activeReservations = reservations.filter(
    (r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW'
  )
  const totalReservations = activeReservations.length
  const totalCovers = activeReservations.reduce((sum, r) => sum + r.covers, 0)

  const filteredReservations =
    statusFilter === 'all'
      ? reservations
      : reservations.filter((r) => r.status === statusFilter)

  const sortedReservations = [...filteredReservations].sort((a, b) =>
    a.time.localeCompare(b.time)
  )

  const handlePress = (reservation: Reservation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (useSplitLayout) {
      // On tablet landscape, show detail in side panel
      setSelectedReservationId(reservation.id)
    } else {
      // On phone/portrait, navigate to detail screen
      router.push(`/reservation/${reservation.id}`)
    }
  }

  const handleCreateNew = () => {
    router.push('/reservation/create')
  }

  const handleDetailActionComplete = () => {
    // Refetch data after an action completes
    refetch()
  }

  const listContent = (
    <>
      {isLoading && !data ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </ScrollView>
      ) : sortedReservations.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          <Text style={styles.emptyTitle}>NO RESERVATIONS</Text>
          <Text style={styles.emptySubtext}>
            {statusFilter === 'all'
              ? 'No reservations for this date'
              : `No ${statusFilter.toLowerCase()} reservations`}
          </Text>
          <Text style={styles.pullHint}>Pull down to refresh</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedReservations}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <SwipeableReservationRow
              reservation={item}
              onPress={() => handlePress(item)}
              onLongPress={(position) => {
                setActionSheetContact({
                  name: item.name,
                  phone: item.phone,
                  email: item.email,
                })
                setActionSheetPosition(position)
              }}
              isSelected={useSplitLayout && selectedReservationId === item.id}
              onSeat={() => seatMutation.mutate(item.id)}
              onConfirm={() => confirmMutation.mutate(item.id)}
              onComplete={() => completeMutation.mutate(item.id)}
              onCancel={() => cancelMutation.mutate(item.id)}
              onNoShow={() => noShowMutation.mutate(item.id)}
              showSwipeHint={!isTablet}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        />
      )}
    </>
  )

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <DateSelector
          date={selectedDate}
          onDateChange={setSelectedDate}
          onOpenPicker={() => setShowDatePicker(true)}
          reservations={totalReservations}
          covers={totalCovers}
          isLoading={isLoading && !data}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.key
            return (
              <Pressable
                key={filter.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setStatusFilter(filter.key)
                }}
                accessibilityLabel={`Filter by ${filter.label.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {useSplitLayout ? (
        // Split layout for tablet landscape
        <View style={styles.splitContainer}>
          <View style={styles.listPane}>
            {listContent}
          </View>
          <View style={styles.detailPane}>
            <DetailPanel
              reservationId={selectedReservationId}
              onActionComplete={handleDetailActionComplete}
            />
          </View>
        </View>
      ) : (
        // Standard layout for phone/portrait
        listContent
      )}

      {/* Floating Action Button */}
      <FAB onPress={handleCreateNew} />

      {/* Date Picker Modal */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Long-press Action Sheet */}
      <ContactActionSheet
        visible={actionSheetContact !== null}
        contact={actionSheetContact}
        rowPosition={actionSheetPosition}
        onClose={() => {
          setActionSheetContact(null)
          setActionSheetPosition(null)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  header: {
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingBottom: 12,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateButton: {
    width: 48,
    height: 48,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  dateButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
  },
  dateDisplay: {
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...NeoShadow.sm,
  },
  dateDisplayPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  dateText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateHint: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  filterChipActive: {
    backgroundColor: Neo.black,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filterChipTextActive: {
    color: Neo.white,
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
  reservationRow: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  reservationRowInner: {
    flexDirection: 'row',
  },
  reservationRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  reservationRowSelected: {
    borderColor: Neo.cyan,
    borderWidth: NeoBorder.thick || 4,
    backgroundColor: Neo.cyan + '20',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    width: '40%',
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
  },
  detailPane: {
    flex: 1,
  },
  reservationTime: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coversText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    opacity: 0.8,
  },
  reservationDetails: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  walkInBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  walkInBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationMeta: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.7,
  },
  notes: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.6,
  },
  statusContainer: {
    alignSelf: 'center',
    marginRight: 14,
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  swipeHint: {
    fontSize: 7,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.3,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  swipeActionLeft: {
    borderRightWidth: 0,
  },
  swipeActionText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rightActionsContainer: {
    flexDirection: 'row',
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
  },
  pullHint: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.4,
    marginTop: 16,
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
    backgroundColor: Neo.lime,
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
    color: Neo.black,
    marginTop: -2,
  },
})
