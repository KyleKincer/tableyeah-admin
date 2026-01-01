import { format, addDays, subDays, isToday, addMinutes, differenceInMinutes, parseISO } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Swipeable } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor } from '@/constants/theme'
import { useReservations, useWaitlist, useServerAssignments, useServers, useFloorPlanElements } from '@/lib/api/queries'
import {
  useSeatReservation,
  useConfirmReservation,
  useCompleteReservation,
  useCancelReservation,
  useMarkNoShow,
  useUnseatReservation,
  useCreateWalkIn,
  useSeatWaitlistEntry,
  useSetServerAssignments,
} from '@/lib/api/mutations'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import { useTablesWithStatus } from '@/lib/hooks/useTablesWithStatus'
import { DatePicker } from '@/components/ui/DatePicker'
import { ContactActionSheet, type ContactInfo, type RowPosition } from '@/components/ui/ContactActionSheet'
import { FloorPlanCanvas } from '@/components/service/FloorPlanCanvas'
import { WalkInSheet, generateWalkInName } from '@/components/service/WalkInSheet'
import { SeatWaitlistSheet } from '@/components/service/SeatWaitlistSheet'
import { ServerAssignmentSheet } from '@/components/service/ServerAssignmentSheet'
import { useServiceStore } from '@/lib/store/service'
import type { Reservation, ReservationStatus, WaitlistEntry, TableWithStatus } from '@/lib/types'

type ViewMode = 'floor' | 'list'

// Turn time status colors
type TurnTimeStatus = 'green' | 'amber' | 'red'

function getTurnTimeStatus(seatedAt: string, expectedMinutes: number): TurnTimeStatus {
  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  const percentage = (elapsedMinutes / expectedMinutes) * 100

  if (percentage < 75) return 'green'
  if (percentage <= 100) return 'amber'
  return 'red'
}

function getTurnTimeColor(status: TurnTimeStatus): string {
  switch (status) {
    case 'green':
      return Neo.lime
    case 'amber':
      return Neo.yellow
    case 'red':
      return Neo.pink
  }
}

// Group reservations for service view
interface ReservationSection {
  title: string
  key: string
  data: Reservation[]
  color: string
}

function groupReservationsForService(reservations: Reservation[]): ReservationSection[] {
  const now = new Date()
  const soon = addMinutes(now, 30)

  // Parse time string to Date object for today
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  const arrivingSoon = reservations.filter((r) => {
    if (!['BOOKED', 'CONFIRMED'].includes(r.status)) return false
    const resTime = parseTime(r.time)
    return resTime <= soon && resTime >= addMinutes(now, -15)
  })

  const seated = reservations.filter((r) => r.status === 'SEATED')

  const upcoming = reservations.filter((r) => {
    if (!['BOOKED', 'CONFIRMED'].includes(r.status)) return false
    const resTime = parseTime(r.time)
    return resTime > soon
  })

  const completed = reservations.filter((r) =>
    ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(r.status)
  )

  const sections: ReservationSection[] = []

  if (arrivingSoon.length > 0) {
    sections.push({
      title: `ARRIVING SOON (${arrivingSoon.length})`,
      key: 'arriving',
      data: arrivingSoon.sort((a, b) => a.time.localeCompare(b.time)),
      color: Neo.orange,
    })
  }

  if (seated.length > 0) {
    sections.push({
      title: `SEATED (${seated.length})`,
      key: 'seated',
      data: seated.sort((a, b) => {
        // Sort by seated time (oldest first - they've been there longest)
        if (a.seated_at && b.seated_at) {
          return a.seated_at.localeCompare(b.seated_at)
        }
        return 0
      }),
      color: Neo.cyan,
    })
  }

  if (upcoming.length > 0) {
    sections.push({
      title: `UPCOMING (${upcoming.length})`,
      key: 'upcoming',
      data: upcoming.sort((a, b) => a.time.localeCompare(b.time)),
      color: Neo.blue,
    })
  }

  if (completed.length > 0) {
    sections.push({
      title: `DONE (${completed.length})`,
      key: 'done',
      data: completed.sort((a, b) => b.time.localeCompare(a.time)),
      color: Neo.black + '60',
    })
  }

  return sections
}

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

function TurnTimeIndicator({
  seatedAt,
  expectedMinutes,
}: {
  seatedAt: string
  expectedMinutes: number
}) {
  const [, forceUpdate] = useState(0)

  // Update every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  const status = getTurnTimeStatus(seatedAt, expectedMinutes)
  const color = getTurnTimeColor(status)

  return (
    <View style={[styles.turnTimeIndicator, { backgroundColor: color }]}>
      <Text style={styles.turnTimeText}>
        {elapsedMinutes}m/{expectedMinutes}m
      </Text>
    </View>
  )
}

interface SwipeAction {
  label: string
  color: string
  textColor?: string
  onPress: () => void
}

function CompactReservationRow({
  reservation,
  onPress,
  onLongPress,
  isSelected,
  onSeat,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
  onUnseat,
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
  onUnseat: () => void
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

  const showTurnTime =
    status === 'SEATED' &&
    reservation.seated_at &&
    reservation.expected_turn_time

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
      actions.push({ label: 'UNSEAT', color: Neo.purple, textColor: Neo.white, onPress: onUnseat })
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
      >
        <View style={styles.reservationRowInner}>
          <View style={[styles.reservationTime, { backgroundColor: bgColor }]}>
            <Text style={styles.timeText}>{time}</Text>
            <Text style={styles.coversText}>
              {reservation.covers} {reservation.covers === 1 ? 'G' : 'G'}
            </Text>
          </View>
          <View style={styles.reservationDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.guestName} numberOfLines={1}>
                {reservation.name}
              </Text>
              {isWalkIn && <WalkInBadge />}
            </View>
            <Text style={styles.reservationMeta}>
              T{tables}
              {reservation.server && ` · ${reservation.server.name}`}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            {showTurnTime ? (
              <TurnTimeIndicator
                seatedAt={reservation.seated_at!}
                expectedMinutes={reservation.expected_turn_time!}
              />
            ) : (
              <StatusBadge status={reservation.status} />
            )}
          </View>
        </View>
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

function ServiceHeader({
  date,
  isLive,
  waitlistCount,
  viewMode,
  showViewToggle,
  onDateChange,
  onOpenPicker,
  onToggleLive,
  onWalkIn,
  onViewModeChange,
  onWaitlistPress,
  onServerAssignmentsPress,
}: {
  date: Date
  isLive: boolean
  waitlistCount: number
  viewMode: ViewMode
  showViewToggle: boolean
  onDateChange: (date: Date) => void
  onOpenPicker: () => void
  onToggleLive: () => void
  onWalkIn: () => void
  onViewModeChange: (mode: ViewMode) => void
  onWaitlistPress: () => void
  onServerAssignmentsPress: () => void
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [prevPressed, setPrevPressed] = useState(false)
  const [nextPressed, setNextPressed] = useState(false)
  const [datePressed, setDatePressed] = useState(false)
  const [livePressed, setLivePressed] = useState(false)
  const [walkInPressed, setWalkInPressed] = useState(false)
  const [serversPressed, setServersPressed] = useState(false)

  // Update time every second when in live mode
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [isLive])

  const dateLabel = isToday(date) ? 'TODAY' : format(date, 'EEE, MMM d').toUpperCase()

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {/* Live indicator and time */}
        <Pressable
          style={[styles.liveButton, isLive && styles.liveButtonActive, livePressed && styles.buttonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onToggleLive()
          }}
          onPressIn={() => setLivePressed(true)}
          onPressOut={() => setLivePressed(false)}
        >
          {isLive && <View style={styles.liveDot} />}
          <Text style={[styles.liveText, isLive && styles.liveTextActive]}>
            {isLive ? format(currentTime, 'h:mm:ss a') : 'GO LIVE'}
          </Text>
        </Pressable>

        {/* View mode toggle (iPad only) */}
        {showViewToggle && (
          <View style={styles.viewToggle}>
            <Pressable
              style={[
                styles.viewToggleButton,
                viewMode === 'floor' && styles.viewToggleButtonActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onViewModeChange('floor')
              }}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'floor' && styles.viewToggleTextActive,
                ]}
              >
                FLOOR
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewToggleButton,
                viewMode === 'list' && styles.viewToggleButtonActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onViewModeChange('list')
              }}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'list' && styles.viewToggleTextActive,
                ]}
              >
                LIST
              </Text>
            </Pressable>
          </View>
        )}

        {/* Waitlist badge */}
        {waitlistCount > 0 && (
          <Pressable
            style={styles.waitlistBadge}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onWaitlistPress()
            }}
          >
            <Text style={styles.waitlistBadgeText}>{waitlistCount} WAITING</Text>
          </Pressable>
        )}

        {/* Servers button */}
        <Pressable
          style={[styles.serversButton, serversPressed && styles.buttonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onServerAssignmentsPress()
          }}
          onPressIn={() => setServersPressed(true)}
          onPressOut={() => setServersPressed(false)}
        >
          <Text style={styles.serversButtonText}>SERVERS</Text>
        </Pressable>

        {/* Walk-in button */}
        <Pressable
          style={[styles.walkInButton, walkInPressed && styles.buttonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onWalkIn()
          }}
          onPressIn={() => setWalkInPressed(true)}
          onPressOut={() => setWalkInPressed(false)}
        >
          <Text style={styles.walkInButtonText}>+ WALK-IN</Text>
        </Pressable>
      </View>

      {/* Date selector */}
      <View style={styles.dateSelector}>
        <Pressable
          style={[styles.dateButton, prevPressed && styles.dateButtonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onDateChange(subDays(date, 1))
          }}
          onPressIn={() => setPrevPressed(true)}
          onPressOut={() => setPrevPressed(false)}
        >
          <Text style={styles.dateButtonText}>{'<'}</Text>
        </Pressable>
        <Pressable
          style={[styles.dateDisplay, datePressed && styles.dateDisplayPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onOpenPicker()
          }}
          onPressIn={() => setDatePressed(true)}
          onPressOut={() => setDatePressed(false)}
        >
          <Text style={styles.dateText}>{dateLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.dateButton, nextPressed && styles.dateButtonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onDateChange(addDays(date, 1))
          }}
          onPressIn={() => setNextPressed(true)}
          onPressOut={() => setNextPressed(false)}
        >
          <Text style={styles.dateButtonText}>{'>'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

export default function ServiceScreen() {
  const router = useRouter()
  const { isTablet, isLandscape } = useDeviceType()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [actionSheetContact, setActionSheetContact] = useState<ContactInfo | null>(null)
  const [actionSheetPosition, setActionSheetPosition] = useState<RowPosition | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('floor')
  const [showWalkInSheet, setShowWalkInSheet] = useState(false)
  const [walkInTableId, setWalkInTableId] = useState<number | undefined>(undefined)
  const [walkInTableNumber, setWalkInTableNumber] = useState<string | undefined>(undefined)
  const [showWaitlistPanel, setShowWaitlistPanel] = useState(false)
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<WaitlistEntry | null>(null)
  const [showServerAssignments, setShowServerAssignments] = useState(false)
  // Server painting mode state
  const [isServerPaintModeActive, setIsServerPaintModeActive] = useState(false)
  const [selectedPaintServerId, setSelectedPaintServerId] = useState<number | null>(null)
  const [pendingServerPaintAssignments, setPendingServerPaintAssignments] = useState<
    Record<number, { serverId: number; serverName: string; serverColor: string } | null>
  >({})

  // Store state
  const {
    isLiveMode,
    selectedDate,
    setLiveMode,
    setSelectedDate,
    mode,
    walkInPartySize,
    enterWalkInMode,
    exitWalkInMode,
    setWalkInPartySize,
    selectReservation,
    selectTable,
    selectedReservationId,
    selectedTableId,
    clearSelection,
  } = useServiceStore()

  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const { data, isLoading, refetch } = useReservations(dateString)
  const { data: waitlistData } = useWaitlist(dateString)
  const { data: serverAssignmentsData } = useServerAssignments(dateString)
  const { data: serversData } = useServers()
  const { data: floorElementsData } = useFloorPlanElements()
  const { tables: tablesWithStatus, refetch: refetchTables } = useTablesWithStatus(dateString)
  const [refreshing, setRefreshing] = useState(false)

  // On iPad, default to floor plan view
  const showFloorPlan = isTablet && viewMode === 'floor'
  const showViewToggle = isTablet
  // Use split layout on iPad in landscape
  const useSplitLayout = isTablet && isLandscape && viewMode === 'floor'

  // Mutations
  const seatMutation = useSeatReservation()
  const confirmMutation = useConfirmReservation()
  const completeMutation = useCompleteReservation()
  const cancelMutation = useCancelReservation()
  const noShowMutation = useMarkNoShow()
  const unseatMutation = useUnseatReservation()
  const createWalkInMutation = useCreateWalkIn()
  const seatWaitlistMutation = useSeatWaitlistEntry()
  const setServerAssignmentsMutation = useSetServerAssignments()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetch(), refetchTables()])
    setRefreshing(false)
  }, [refetch, refetchTables])

  // Auto-refresh in live mode
  useEffect(() => {
    if (!isLiveMode) return
    const interval = setInterval(() => refetch(), 30000)
    return () => clearInterval(interval)
  }, [isLiveMode, refetch])

  // Reset to today when entering live mode
  const handleToggleLive = () => {
    if (!isLiveMode) {
      setSelectedDate(new Date())
      setLiveMode(true)
    } else {
      setLiveMode(false)
    }
  }

  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    setLiveMode(false)
  }

  const reservations = data?.reservations || []
  const activeWaitlistEntries = waitlistData?.entries?.filter(
    (e) => e.status === 'WAITING' || e.status === 'NOTIFIED'
  ) || []
  const waitlistCount = activeWaitlistEntries.length

  const sections = useMemo(
    () => groupReservationsForService(reservations),
    [reservations]
  )

  const handlePress = (reservation: Reservation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/reservation/${reservation.id}`)
  }

  const handleWalkIn = (tableId?: number, tableNumber?: string) => {
    setWalkInTableId(tableId)
    setWalkInTableNumber(tableNumber)
    setShowWalkInSheet(true)
  }

  const handleSeatWalkIn = async (partySize: number, tableId?: number) => {
    const name = generateWalkInName()
    try {
      await createWalkInMutation.mutateAsync({
        covers: partySize,
        name,
        tableIds: tableId ? [tableId] : undefined,
      })
      setShowWalkInSheet(false)
      setWalkInTableId(undefined)
      setWalkInTableNumber(undefined)
      exitWalkInMode()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Handle selecting table from floor plan for walk-in
  const handleSelectTableFromFloorPlan = (partySize: number) => {
    enterWalkInMode(undefined, partySize)
  }

  // Handle seating walk-in at specific table from floor plan
  const handleSeatWalkInAtTable = async (tableId: number) => {
    if (!walkInPartySize) return
    await handleSeatWalkIn(walkInPartySize, tableId)
  }

  const handleSeatWaitlistEntry = async (tableId: number) => {
    if (!selectedWaitlistEntry) return
    try {
      await seatWaitlistMutation.mutateAsync({
        uuid: selectedWaitlistEntry.uuid,
        tableId,
        date: dateString,
        time: format(new Date(), 'HH:mm'),
      })
      setSelectedWaitlistEntry(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleWaitlistPress = (entry: WaitlistEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedWaitlistEntry(entry)
    setShowWaitlistPanel(false)
    // If on floor plan view, we'll use the floor plan to seat them
    // Otherwise, the SeatWaitlistSheet will be shown
  }

  // Handle seating waitlist entry at a specific table from floor plan
  const handleSeatWaitlistAtTableFromFloorPlan = async (tableId: number) => {
    if (!selectedWaitlistEntry) return
    try {
      await seatWaitlistMutation.mutateAsync({
        uuid: selectedWaitlistEntry.uuid,
        tableId,
        date: dateString,
        time: format(new Date(), 'HH:mm'),
      })
      setSelectedWaitlistEntry(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Cancel waitlist seating mode
  const handleCancelWaitlistSeating = () => {
    setSelectedWaitlistEntry(null)
  }

  const handleSaveServerAssignments = async (
    assignments: { tableId: number; serverId: number | null }[]
  ) => {
    try {
      await setServerAssignmentsMutation.mutateAsync({
        date: dateString,
        assignments,
      })
      setShowServerAssignments(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Server painting mode handlers
  const handleEnterServerPaintMode = () => {
    exitWalkInMode() // Exit any other modes
    setIsServerPaintModeActive(true)
    setSelectedPaintServerId(null)
    setPendingServerPaintAssignments({})
  }

  const handleToggleTableServerPaint = (tableId: number) => {
    if (!selectedPaintServerId) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const server = serversData?.servers?.find(s => s.id === selectedPaintServerId)
    if (!server) return

    // Get current assignment (from pending or from API)
    const pendingAssignment = pendingServerPaintAssignments[tableId]
    const currentAssignment = pendingAssignment !== undefined
      ? pendingAssignment
      : serverAssignmentsData?.assignmentsByTable[tableId]

    // Toggle: if already assigned to this server, unassign
    if (currentAssignment?.serverId === selectedPaintServerId) {
      setPendingServerPaintAssignments(prev => ({
        ...prev,
        [tableId]: null,
      }))
    } else {
      // Assign to selected server
      setPendingServerPaintAssignments(prev => ({
        ...prev,
        [tableId]: {
          serverId: server.id,
          serverName: server.name,
          serverColor: server.color,
        },
      }))
    }
  }

  const handleSaveServerPaintAssignments = async () => {
    const changes: { tableId: number; serverId: number | null }[] = []

    for (const [tableIdStr, assignment] of Object.entries(pendingServerPaintAssignments)) {
      const tableId = parseInt(tableIdStr, 10)
      changes.push({
        tableId,
        serverId: assignment?.serverId ?? null,
      })
    }

    if (changes.length === 0) {
      handleCancelServerPaintMode()
      return
    }

    try {
      await setServerAssignmentsMutation.mutateAsync({
        date: dateString,
        assignments: changes,
      })
      handleCancelServerPaintMode()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCancelServerPaintMode = () => {
    setIsServerPaintModeActive(false)
    setSelectedPaintServerId(null)
    setPendingServerPaintAssignments({})
  }

  // Handle server button - opens paint mode on floor plan, sheet on list view
  const handleServerButtonPress = () => {
    if (showFloorPlan) {
      handleEnterServerPaintMode()
    } else {
      setShowServerAssignments(true)
    }
  }

  // Determine the effective mode for floor plan
  const effectiveFloorPlanMode = isServerPaintModeActive
    ? 'server-assignment' as const
    : (showFloorPlan && selectedWaitlistEntry)
      ? 'seat-waitlist' as const
      : mode

  // Handle table press from floor plan
  const handleTablePress = (table: TableWithStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // In walk-in mode, seat the walk-in at this table
    if (mode === 'walk-in' && walkInPartySize && table.status === 'available') {
      handleSeatWalkInAtTable(table.id)
      return
    }

    selectTable(table.id)
    // If table has a seated reservation, also select it
    if (table.currentReservation) {
      selectReservation(table.currentReservation.id)
    }
  }

  const handleTableLongPress = (table: TableWithStatus) => {
    if (table.status === 'available') {
      // Open walk-in sheet with this table pre-selected
      handleWalkIn(table.id, table.table_number)
    } else if (table.currentReservation) {
      router.push(`/reservation/${table.currentReservation.id}`)
    }
  }

  // List content for both views
  const listContent = (
    <>
      {isLoading && !data ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
          }
        >
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </ScrollView>
      ) : sections.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
          }
        >
          <Text style={styles.emptyTitle}>NO RESERVATIONS</Text>
          <Text style={styles.emptySubtext}>No reservations for this date</Text>
          <Text style={styles.pullHint}>Pull down to refresh</Text>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <CompactReservationRow
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
              isSelected={selectedReservationId === item.id}
              onSeat={() => seatMutation.mutate(item.id)}
              onConfirm={() => confirmMutation.mutate(item.id)}
              onComplete={() => completeMutation.mutate(item.id)}
              onCancel={() => cancelMutation.mutate(item.id)}
              onNoShow={() => noShowMutation.mutate(item.id)}
              onUnseat={() => unseatMutation.mutate(item.id)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} color={section.color} />
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
          }
        />
      )}
    </>
  )

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ServiceHeader
        date={selectedDate}
        isLive={isLiveMode}
        waitlistCount={waitlistCount}
        viewMode={viewMode}
        showViewToggle={showViewToggle}
        onDateChange={handleDateChange}
        onOpenPicker={() => setShowDatePicker(true)}
        onToggleLive={handleToggleLive}
        onWalkIn={() => handleWalkIn()}
        onViewModeChange={setViewMode}
        onWaitlistPress={() => setShowWaitlistPanel(true)}
        onServerAssignmentsPress={handleServerButtonPress}
      />

      {useSplitLayout ? (
        <View style={styles.splitContainer}>
          <View style={styles.floorPlanPane}>
            <FloorPlanCanvas
              tables={tablesWithStatus}
              elements={floorElementsData?.elements}
              selectedTableId={selectedTableId}
              onTablePress={handleTablePress}
              onTableLongPress={handleTableLongPress}
              onBackgroundPress={clearSelection}
              serverAssignments={serverAssignmentsData?.assignmentsByTable}
              mode={effectiveFloorPlanMode}
              walkInPartySize={walkInPartySize}
              onCancelMode={
                isServerPaintModeActive
                  ? handleCancelServerPaintMode
                  : selectedWaitlistEntry
                    ? handleCancelWaitlistSeating
                    : exitWalkInMode
              }
              servers={serversData?.servers}
              selectedServerId={selectedPaintServerId}
              pendingServerAssignments={pendingServerPaintAssignments}
              onSelectServer={setSelectedPaintServerId}
              onToggleTableServer={handleToggleTableServerPaint}
              onSaveServerAssignments={handleSaveServerPaintAssignments}
              waitlistEntry={selectedWaitlistEntry}
              onSeatWaitlistAtTable={handleSeatWaitlistAtTableFromFloorPlan}
            />
          </View>
          <View style={styles.listPane}>
            {listContent}
          </View>
        </View>
      ) : showFloorPlan ? (
        <FloorPlanCanvas
          tables={tablesWithStatus}
          elements={floorElementsData?.elements}
          selectedTableId={selectedTableId}
          onTablePress={handleTablePress}
          onTableLongPress={handleTableLongPress}
          onBackgroundPress={clearSelection}
          serverAssignments={serverAssignmentsData?.assignmentsByTable}
          mode={effectiveFloorPlanMode}
          walkInPartySize={walkInPartySize}
          onCancelMode={
            isServerPaintModeActive
              ? handleCancelServerPaintMode
              : selectedWaitlistEntry
                ? handleCancelWaitlistSeating
                : exitWalkInMode
          }
          servers={serversData?.servers}
          selectedServerId={selectedPaintServerId}
          pendingServerAssignments={pendingServerPaintAssignments}
          onSelectServer={setSelectedPaintServerId}
          onToggleTableServer={handleToggleTableServerPaint}
          onSaveServerAssignments={handleSaveServerPaintAssignments}
          waitlistEntry={selectedWaitlistEntry}
          onSeatWaitlistAtTable={handleSeatWaitlistAtTableFromFloorPlan}
        />
      ) : (
        listContent
      )}

      {/* Date Picker Modal */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={handleDateChange}
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

      {/* Walk-in Sheet */}
      <WalkInSheet
        visible={showWalkInSheet}
        tableNumber={walkInTableNumber}
        tableId={walkInTableId}
        onClose={() => {
          setShowWalkInSheet(false)
          setWalkInTableId(undefined)
          setWalkInTableNumber(undefined)
        }}
        onSeat={handleSeatWalkIn}
        onSelectFromFloorPlan={handleSelectTableFromFloorPlan}
        showFloorPlanOption={showFloorPlan}
        isLoading={createWalkInMutation.isPending}
      />

      {/* Waitlist Panel */}
      <Modal
        visible={showWaitlistPanel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWaitlistPanel(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowWaitlistPanel(false)}>
          <Pressable style={styles.waitlistPanel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.waitlistHeader}>
              <Text style={styles.waitlistTitle}>WAITLIST</Text>
              <Pressable
                style={styles.waitlistCloseButton}
                onPress={() => setShowWaitlistPanel(false)}
              >
                <Text style={styles.waitlistCloseButtonText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.waitlistList}>
              {activeWaitlistEntries.map((entry) => (
                <Pressable
                  key={entry.uuid}
                  style={styles.waitlistRow}
                  onPress={() => handleWaitlistPress(entry)}
                >
                  <View style={styles.waitlistRowInfo}>
                    <Text style={styles.waitlistRowName}>{entry.name}</Text>
                    <Text style={styles.waitlistRowMeta}>
                      {entry.covers} guests · {entry.time || 'Any time'}
                    </Text>
                  </View>
                  <View style={[
                    styles.waitlistStatusBadge,
                    entry.status === 'NOTIFIED' && styles.waitlistStatusNotified,
                  ]}>
                    <Text style={styles.waitlistStatusText}>
                      {entry.status === 'NOTIFIED' ? 'NOTIFIED' : 'WAITING'}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {activeWaitlistEntries.length === 0 && (
                <View style={styles.waitlistEmpty}>
                  <Text style={styles.waitlistEmptyText}>No one waiting</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Seat Waitlist Sheet - only show when not on floor plan view */}
      <SeatWaitlistSheet
        visible={selectedWaitlistEntry !== null && !showFloorPlan}
        entry={selectedWaitlistEntry}
        tables={tablesWithStatus}
        onClose={() => setSelectedWaitlistEntry(null)}
        onSeat={handleSeatWaitlistEntry}
        isLoading={seatWaitlistMutation.isPending}
      />

      {/* Server Assignment Sheet */}
      <ServerAssignmentSheet
        visible={showServerAssignments}
        servers={serversData?.servers || []}
        tables={tablesWithStatus}
        currentAssignments={serverAssignmentsData?.assignmentsByTable || {}}
        onClose={() => setShowServerAssignments(false)}
        onSave={handleSaveServerAssignments}
        isLoading={setServerAssignmentsMutation.isPending}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  floorPlanPane: {
    flex: 3,
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
  },
  listPane: {
    flex: 2,
    backgroundColor: Neo.cream,
  },
  header: {
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  liveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    ...NeoShadow.sm,
  },
  liveButtonActive: {
    backgroundColor: Neo.lime,
  },
  buttonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Neo.pink,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  liveTextActive: {
    color: Neo.black,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
  },
  viewToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewToggleButtonActive: {
    backgroundColor: Neo.black,
  },
  viewToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  viewToggleTextActive: {
    color: Neo.white,
  },
  waitlistBadge: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  waitlistBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  serversButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...NeoShadow.sm,
  },
  serversButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  walkInButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...NeoShadow.sm,
  },
  walkInButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '30',
  },
  dateButton: {
    width: 44,
    height: 44,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
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
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
  },
  dateDisplay: {
    minWidth: 140,
    alignItems: 'center',
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.thin,
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
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionHeader: {
    backgroundColor: Neo.cream,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listContent: {
    padding: 16,
  },
  reservationRow: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    marginBottom: 8,
    overflow: 'hidden',
    ...NeoShadow.sm,
  },
  reservationRowInner: {
    flexDirection: 'row',
  },
  reservationRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  reservationRowSelected: {
    borderColor: Neo.cyan,
    borderWidth: NeoBorder.default,
    backgroundColor: Neo.cyan + '20',
  },
  reservationTime: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coversText: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    opacity: 0.8,
  },
  reservationDetails: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestName: {
    fontSize: 14,
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
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  walkInBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationMeta: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    opacity: 0.7,
  },
  statusContainer: {
    alignSelf: 'center',
    marginRight: 10,
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeIndicator: {
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  turnTimeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  swipeAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Neo.black,
  },
  swipeActionLeft: {
    borderRightWidth: 0,
  },
  swipeActionText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rightActionsContainer: {
    flexDirection: 'row',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  waitlistPanel: {
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
    maxHeight: '60%',
  },
  waitlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  waitlistTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  waitlistCloseButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitlistCloseButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    marginTop: -2,
  },
  waitlistList: {
    padding: 16,
  },
  waitlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    marginBottom: 8,
    ...NeoShadow.sm,
  },
  waitlistRowInfo: {
    flex: 1,
  },
  waitlistRowName: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  waitlistRowMeta: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    opacity: 0.7,
  },
  waitlistStatusBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitlistStatusNotified: {
    backgroundColor: Neo.orange,
  },
  waitlistStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  waitlistEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  waitlistEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
})
