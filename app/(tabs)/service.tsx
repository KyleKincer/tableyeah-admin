import { format, addDays, subDays, isToday, addMinutes, differenceInMinutes, parseISO } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { FloorPlanCanvas } from '@/components/service/FloorPlanCanvas'
import { SeatingProgressBar } from '@/components/reservation/SeatingProgressBar'
import { WalkInSheet, generateWalkInName } from '@/components/service/WalkInSheet'
import { SeatWaitlistSheet } from '@/components/service/SeatWaitlistSheet'
import { ServerAssignmentSheet } from '@/components/service/ServerAssignmentSheet'
import { SelectionActionBar } from '@/components/service/SelectionActionBar'
import { DragProvider, DraggableRow } from '@/components/dnd'
import { TimelineView } from '@/components/service/TimelineView'
import { useServiceStore } from '@/lib/store/service'
import type { Reservation, ReservationStatus, WaitlistEntry, TableWithStatus } from '@/lib/types'
import type { DragPayload } from '@/lib/store/drag'

type ViewMode = 'floor' | 'timeline' | 'list' | 'waitlist'
type ListPaneTab = 'arrivals' | 'waitlist'

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

function CompactReservationRow({
  reservation,
  onPress,
  isSelected,
}: {
  reservation: Reservation
  onPress: () => void
  isSelected?: boolean
}) {
  const [pressed, setPressed] = useState(false)
  const time = format(new Date(`2000-01-01T${reservation.time}`), 'h:mm a')
  const tables =
    reservation.table_numbers && reservation.table_numbers.length > 0
      ? reservation.table_numbers.join(', ')
      : '—'

  const bgColor = getStatusColor(reservation.status)
  const isWalkIn = reservation.is_walk_in === true

  const showProgressBar =
    reservation.status === 'SEATED' &&
    reservation.seated_at &&
    reservation.expected_turn_time

  return (
    <Pressable
      style={[
        styles.reservationRow,
        pressed && styles.reservationRowPressed,
        isSelected && styles.reservationRowSelected,
      ]}
      onPress={onPress}
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
          <StatusBadge status={reservation.status} />
        </View>
      </View>
      {showProgressBar && (
        <SeatingProgressBar
          seatedAt={reservation.seated_at!}
          expectedMinutes={reservation.expected_turn_time!}
        />
      )}
    </Pressable>
  )
}

function WaitlistRow({
  entry,
  onPress,
  isSelected,
}: {
  entry: WaitlistEntry
  onPress: () => void
  isSelected?: boolean
}) {
  const [pressed, setPressed] = useState(false)
  const waitTime = differenceInMinutes(new Date(), parseISO(entry.created_at))
  const waitTimeDisplay = waitTime < 60 ? `${waitTime}m` : `${Math.floor(waitTime / 60)}h ${waitTime % 60}m`

  return (
    <Pressable
      style={[
        styles.waitlistRowItem,
        pressed && styles.waitlistRowItemPressed,
        isSelected && styles.waitlistRowItemSelected,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={styles.waitlistRowLeft}>
        <View style={styles.waitlistRowCovers}>
          <Text style={styles.waitlistRowCoversText}>{entry.covers}</Text>
        </View>
      </View>
      <View style={styles.waitlistRowInfo}>
        <Text style={styles.waitlistRowName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.waitlistRowMeta}>
          {entry.time ? format(new Date(`2000-01-01T${entry.time}`), 'h:mm a') : 'Any time'}
          {entry.notes && ` · ${entry.notes}`}
        </Text>
      </View>
      <View style={styles.waitlistRowRight}>
        <View style={[
          styles.waitlistRowWaitBadge,
          entry.status === 'NOTIFIED' && styles.waitlistRowWaitBadgeNotified,
        ]}>
          <Text style={styles.waitlistRowWaitText}>{waitTimeDisplay}</Text>
        </View>
        {entry.status === 'NOTIFIED' && (
          <Text style={styles.waitlistRowNotifiedLabel}>NOTIFIED</Text>
        )}
      </View>
    </Pressable>
  )
}

function ListPaneTabs({
  activeTab,
  waitlistCount,
  onTabChange,
}: {
  activeTab: ListPaneTab
  waitlistCount: number
  onTabChange: (tab: ListPaneTab) => void
}) {
  return (
    <View style={styles.listPaneTabs}>
      <Pressable
        style={[
          styles.listPaneTab,
          activeTab === 'arrivals' && styles.listPaneTabActive,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onTabChange('arrivals')
        }}
      >
        <Text
          style={[
            styles.listPaneTabText,
            activeTab === 'arrivals' && styles.listPaneTabTextActive,
          ]}
        >
          ARRIVALS
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.listPaneTab,
          activeTab === 'waitlist' && styles.listPaneTabActive,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onTabChange('waitlist')
        }}
      >
        <Text
          style={[
            styles.listPaneTabText,
            activeTab === 'waitlist' && styles.listPaneTabTextActive,
          ]}
        >
          WAITLIST
        </Text>
        {waitlistCount > 0 && (
          <View style={styles.listPaneTabBadge}>
            <Text style={styles.listPaneTabBadgeText}>{waitlistCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

function ServiceHeader({
  date,
  isLive,
  waitlistCount,
  viewMode,
  isTablet,
  useSplitLayout,
  onDateChange,
  onOpenPicker,
  onToggleLive,
  onWalkIn,
  onViewModeChange,
  onServerAssignmentsPress,
}: {
  date: Date
  isLive: boolean
  waitlistCount: number
  viewMode: ViewMode
  isTablet: boolean
  useSplitLayout: boolean
  onDateChange: (date: Date) => void
  onOpenPicker: () => void
  onToggleLive: () => void
  onWalkIn: () => void
  onViewModeChange: (mode: ViewMode) => void
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

  // Phone layout - more compact, two rows
  if (!isTablet) {
    return (
      <View style={styles.header}>
        {/* Row 1: Date + Live indicator */}
        <View style={styles.headerTopPhone}>
          <View style={styles.dateSelectorPhone}>
            <Pressable
              style={[styles.dateButtonSmall, prevPressed && styles.dateButtonPressed]}
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
              style={[styles.dateDisplayCompact, datePressed && styles.dateDisplayPressed]}
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
              style={[styles.dateButtonSmall, nextPressed && styles.dateButtonPressed]}
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

          <Pressable
            style={[styles.liveButtonCompact, isLive && styles.liveButtonActive, livePressed && styles.buttonPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onToggleLive()
            }}
            onPressIn={() => setLivePressed(true)}
            onPressOut={() => setLivePressed(false)}
          >
            {isLive && <View style={styles.liveDot} />}
            <Text style={[styles.liveTextCompact, isLive && styles.liveTextActive]}>
              {isLive ? format(currentTime, 'h:mm a') : 'LIVE'}
            </Text>
          </Pressable>
        </View>

        {/* Row 2: View toggle + action buttons */}
        <View style={styles.headerBottomPhone}>
          <View style={styles.viewToggle}>
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
                ARRIVALS
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewToggleButton,
                viewMode === 'waitlist' && styles.viewToggleButtonActive,
                waitlistCount > 0 && viewMode !== 'waitlist' && styles.viewToggleButtonBadge,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onViewModeChange('waitlist')
              }}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'waitlist' && styles.viewToggleTextActive,
                ]}
              >
                WAIT{waitlistCount > 0 ? ` (${waitlistCount})` : ''}
              </Text>
            </Pressable>
          </View>

          <View style={styles.headerActionsPhone}>
            <Pressable
              style={[styles.walkInButtonCompact, walkInPressed && styles.buttonPressed]}
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
        </View>
      </View>
    )
  }

  // Tablet layout - all controls in single row
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

        {/* Date selector - integrated into toolbar */}
        <View style={styles.dateSelectorInline}>
          <Pressable
            style={[styles.dateButtonInline, prevPressed && styles.dateButtonPressed]}
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
            style={[styles.dateDisplayInline, datePressed && styles.dateDisplayPressed]}
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
            style={[styles.dateButtonInline, nextPressed && styles.dateButtonPressed]}
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

        {/* View mode toggle - Tablet: FLOOR/TIMELINE/LIST */}
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
              viewMode === 'timeline' && styles.viewToggleButtonActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onViewModeChange('timeline')
            }}
          >
            <Text
              style={[
                styles.viewToggleText,
                viewMode === 'timeline' && styles.viewToggleTextActive,
              ]}
            >
              TIME
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
  // Phones default to 'list', tablets to 'floor'
  const [viewMode, setViewMode] = useState<ViewMode>(isTablet ? 'floor' : 'list')
  const [showWalkInSheet, setShowWalkInSheet] = useState(false)
  const [walkInTableId, setWalkInTableId] = useState<number | undefined>(undefined)
  const [walkInTableNumber, setWalkInTableNumber] = useState<string | undefined>(undefined)
  const [listPaneTab, setListPaneTab] = useState<ListPaneTab>('arrivals')
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
    selectWaitlist,
    selectTable,
    selectedReservationUuid,
    selectedWaitlistUuid,
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

  // Set correct initial viewMode based on device type
  // Floor and Timeline views are tablet-only
  useEffect(() => {
    if (!isTablet && (viewMode === 'floor' || viewMode === 'timeline')) {
      setViewMode('list')
    }
  }, [isTablet, viewMode])

  // Auto-refresh in live mode - refresh both list and floor plan data
  useEffect(() => {
    if (!isLiveMode) return
    const interval = setInterval(() => {
      refetch()
      refetchTables()
    }, 30000)
    return () => clearInterval(interval)
  }, [isLiveMode, refetch, refetchTables])

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

  // Get selected reservation object for action bar
  const selectedReservation = useMemo(
    () => selectedReservationUuid
      ? reservations.find(r => r.uuid === selectedReservationUuid) || null
      : null,
    [selectedReservationUuid, reservations]
  )

  // Get selected waitlist entry for action bar (already in selectedWaitlistEntry state)
  const selectedWaitlistForActionBar = useMemo(
    () => selectedWaitlistUuid
      ? activeWaitlistEntries.find(e => e.uuid === selectedWaitlistUuid) || null
      : null,
    [selectedWaitlistUuid, activeWaitlistEntries]
  )

  // Handle reservation row press
  const handleReservationPress = (reservation: Reservation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isTablet) {
      // On tablet, toggle selection for action bar
      if (selectedReservationUuid === reservation.uuid) {
        selectReservation(null)
      } else {
        selectReservation(reservation.uuid)
      }
    } else {
      // On phone, navigate to detail page (like Reservations tab)
      router.push(`/reservation/${reservation.id}`)
    }
  }

  // Navigate to detail view (for action bar view button on tablet)
  const handleReservationNavigate = (reservation: Reservation) => {
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

  // Handle waitlist row press
  const handleWaitlistPress = (entry: WaitlistEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isTablet) {
      // On tablet, toggle selection for action bar
      if (selectedWaitlistUuid === entry.uuid) {
        selectWaitlist(null)
        setSelectedWaitlistEntry(null)
      } else {
        selectWaitlist(entry.uuid)
        setSelectedWaitlistEntry(entry)
      }
    } else {
      // On phone, show seat waitlist sheet directly (triggers SeatWaitlistSheet)
      setSelectedWaitlistEntry(entry)
    }
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
    selectWaitlist(null)
  }

  // Action bar handlers for reservations
  const handleConfirmFromActionBar = async () => {
    if (!selectedReservation) return
    try {
      await confirmMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleSeatFromActionBar = async () => {
    if (!selectedReservation) return
    // For phone, we might want to show a table picker
    // For now, just seat at the assigned table
    try {
      await seatMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCompleteFromActionBar = async () => {
    if (!selectedReservation) return
    try {
      await completeMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCancelFromActionBar = async () => {
    if (!selectedReservation) return
    try {
      await cancelMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleNoShowFromActionBar = async () => {
    if (!selectedReservation) return
    try {
      await noShowMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleUnseatFromActionBar = async () => {
    if (!selectedReservation) return
    try {
      await unseatMutation.mutateAsync(selectedReservation.id)
      clearSelection()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Action bar handlers for waitlist
  const handleSeatWaitlistFromActionBar = () => {
    if (!selectedWaitlistForActionBar) return
    // For tablet in split layout, this will trigger floor plan seat-waitlist mode
    // For phone, show the SeatWaitlistSheet
    setSelectedWaitlistEntry(selectedWaitlistForActionBar)
    // The sheet visibility is controlled by selectedWaitlistEntry !== null && !isTablet
    // For tablet, the floor plan will enter seat-waitlist mode
  }

  const handleNotifyWaitlistFromActionBar = async () => {
    // TODO: Implement notify waitlist mutation
    if (!selectedWaitlistForActionBar) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // For now just clear selection
    clearSelection()
    setSelectedWaitlistEntry(null)
  }

  const handleRemoveWaitlistFromActionBar = async () => {
    // TODO: Implement delete waitlist mutation
    if (!selectedWaitlistForActionBar) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // For now just clear selection
    clearSelection()
    setSelectedWaitlistEntry(null)
  }

  const handleCloseActionBar = () => {
    clearSelection()
    setSelectedWaitlistEntry(null)
  }

  // Handle drag-and-drop onto a table
  const handleDrop = async (tableId: number, payload: DragPayload) => {
    try {
      switch (payload.type) {
        case 'reservation':
          // Seat the reservation at the dropped table
          await seatMutation.mutateAsync(payload.reservation.id)
          break

        case 'waitlist':
          // Seat the waitlist entry at the dropped table
          await seatWaitlistMutation.mutateAsync({
            uuid: payload.entry.uuid,
            tableId,
            date: dateString,
            time: format(new Date(), 'HH:mm'),
          })
          break

        case 'walk-in':
          // Open walk-in sheet with the table pre-selected
          const table = tablesWithStatus.find(t => t.id === tableId)
          handleWalkIn(tableId, table?.table_number)
          return // Don't clear selection, the sheet will handle it
      }

      clearSelection()
      setSelectedWaitlistEntry(null)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
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
    // If table has a seated reservation, find it and select by uuid
    if (table.currentReservation) {
      const reservation = reservations.find(r => r.id === table.currentReservation!.id)
      if (reservation) {
        selectReservation(reservation.uuid)
      }
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
          renderItem={({ item }) => {
            // Only allow dragging for reservations that can be seated
            const canDrag = ['BOOKED', 'CONFIRMED'].includes(item.status)
            const payload: DragPayload = { type: 'reservation', reservation: item }

            return (
              <DraggableRow
                payload={payload}
                enabled={canDrag}
              >
                <CompactReservationRow
                  reservation={item}
                  onPress={() => handleReservationPress(item)}
                  isSelected={selectedReservationUuid === item.uuid}
                />
              </DraggableRow>
            )
          }}
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
    <DragProvider onDrop={handleDrop} enabled={useSplitLayout}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ServiceHeader
        date={selectedDate}
        isLive={isLiveMode}
        waitlistCount={waitlistCount}
        viewMode={viewMode}
        isTablet={isTablet}
        useSplitLayout={useSplitLayout}
        onDateChange={handleDateChange}
        onOpenPicker={() => setShowDatePicker(true)}
        onToggleLive={handleToggleLive}
        onWalkIn={() => handleWalkIn()}
        onViewModeChange={setViewMode}
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
            <ListPaneTabs
              activeTab={listPaneTab}
              waitlistCount={waitlistCount}
              onTabChange={setListPaneTab}
            />
            {listPaneTab === 'arrivals' ? (
              listContent
            ) : (
              <ScrollView
                contentContainerStyle={styles.waitlistListContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
                }
              >
                {activeWaitlistEntries.length === 0 ? (
                  <View style={styles.waitlistEmptyState}>
                    <Text style={styles.waitlistEmptyTitle}>NO ONE WAITING</Text>
                    <Text style={styles.waitlistEmptySubtext}>Waitlist is empty</Text>
                  </View>
                ) : (
                  activeWaitlistEntries.map((entry) => {
                    const payload: DragPayload = { type: 'waitlist', entry }
                    const canDrag = ['WAITING', 'NOTIFIED'].includes(entry.status)

                    return (
                      <DraggableRow
                        key={entry.uuid}
                        payload={payload}
                        enabled={canDrag}
                      >
                        <WaitlistRow
                          entry={entry}
                          onPress={() => handleWaitlistPress(entry)}
                          isSelected={selectedWaitlistUuid === entry.uuid}
                        />
                      </DraggableRow>
                    )
                  })
                )}
              </ScrollView>
            )}
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
      ) : viewMode === 'timeline' ? (
        <TimelineView
          date={dateString}
          reservations={reservations}
          tables={tablesWithStatus}
          seatingSettings={null}
          isLiveMode={isLiveMode}
          selectedReservationId={selectedReservation?.id || null}
          onReservationPress={handleReservationPress}
        />
      ) : viewMode === 'waitlist' ? (
        /* Phone waitlist view */
        <ScrollView
          contentContainerStyle={styles.waitlistListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
          }
        >
          {activeWaitlistEntries.length === 0 ? (
            <View style={styles.waitlistEmptyState}>
              <Text style={styles.waitlistEmptyTitle}>NO ONE WAITING</Text>
              <Text style={styles.waitlistEmptySubtext}>Waitlist is empty</Text>
            </View>
          ) : (
            activeWaitlistEntries.map((entry) => (
              <WaitlistRow
                key={entry.uuid}
                entry={entry}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setSelectedWaitlistEntry(entry)
                }}
                isSelected={selectedWaitlistEntry?.uuid === entry.uuid}
              />
            ))
          )}
        </ScrollView>
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

      {/* Seat Waitlist Sheet - show for phone when waitlist entry is selected */}
      <SeatWaitlistSheet
        visible={selectedWaitlistEntry !== null && !isTablet}
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

      {/* Selection Action Bar */}
      <SelectionActionBar
        selectedReservation={selectedReservation}
        onConfirmReservation={handleConfirmFromActionBar}
        onSeatReservation={handleSeatFromActionBar}
        onCompleteReservation={handleCompleteFromActionBar}
        onCancelReservation={handleCancelFromActionBar}
        onNoShowReservation={handleNoShowFromActionBar}
        onUnseatReservation={handleUnseatFromActionBar}
        onViewReservationDetails={selectedReservation ? () => handleReservationNavigate(selectedReservation) : undefined}
        selectedWaitlist={selectedWaitlistForActionBar}
        onSeatWaitlist={handleSeatWaitlistFromActionBar}
        onNotifyWaitlist={handleNotifyWaitlistFromActionBar}
        onRemoveWaitlist={handleRemoveWaitlistFromActionBar}
        onClose={handleCloseActionBar}
        isLoading={
          confirmMutation.isPending ||
          seatMutation.isPending ||
          completeMutation.isPending ||
          cancelMutation.isPending ||
          noShowMutation.isPending ||
          unseatMutation.isPending ||
          seatWaitlistMutation.isPending
        }
      />
      </SafeAreaView>
    </DragProvider>
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
  // Phone header styles
  headerTopPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  headerBottomPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  headerActionsPhone: {
    flexDirection: 'row',
    gap: 8,
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
  // Compact phone variants
  liveButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    ...NeoShadow.sm,
  },
  liveTextCompact: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateButtonSmall: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateDisplayCompact: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...NeoShadow.sm,
  },
  walkInButtonCompact: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...NeoShadow.sm,
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
  dateSelectorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  dateButtonInline: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDisplayInline: {
    height: 36,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Neo.yellow,
    borderTopWidth: NeoBorder.thin,
    borderBottomWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
  },
  dateSelectorPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
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
  // List pane tabs for tablet split layout
  listPaneTabs: {
    flexDirection: 'row',
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.white,
  },
  listPaneTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  listPaneTabActive: {
    backgroundColor: Neo.black,
  },
  listPaneTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  listPaneTabTextActive: {
    color: Neo.white,
  },
  listPaneTabBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  listPaneTabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Waitlist row styles for sidebar
  waitlistRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
    ...NeoShadow.sm,
  },
  waitlistRowItemPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  waitlistRowItemSelected: {
    borderColor: Neo.purple,
    borderWidth: NeoBorder.default,
    backgroundColor: Neo.purple + '20',
  },
  waitlistRowLeft: {
    width: 56,
    height: 56,
    backgroundColor: Neo.purple,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  waitlistRowCovers: {
    alignItems: 'center',
  },
  waitlistRowCoversText: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.white,
  },
  waitlistRowInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  waitlistRowName: {
    fontSize: 14,
    fontWeight: '800',
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
  waitlistRowRight: {
    paddingRight: 12,
    alignItems: 'flex-end',
  },
  waitlistRowWaitBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitlistRowWaitBadgeNotified: {
    backgroundColor: Neo.orange,
  },
  waitlistRowWaitText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  waitlistRowNotifiedLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.orange,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  waitlistListContent: {
    paddingVertical: 16,
  },
  waitlistEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  waitlistEmptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  waitlistEmptySubtext: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  viewToggleButtonBadge: {
    borderLeftWidth: 2,
    borderLeftColor: Neo.purple,
  },
})
