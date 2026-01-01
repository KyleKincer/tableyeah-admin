import { format, addDays, subDays, isToday } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

import { Neo, NeoBorder, NeoShadow, getWaitlistStatusColor, getContrastText } from '@/constants/theme'
import { useWaitlist } from '@/lib/api/queries'
import {
  useNotifyWaitlistEntry,
  useUpdateWaitlistStatus,
  useDeleteWaitlistEntry,
} from '@/lib/api/mutations'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import { DatePicker } from '@/components/ui/DatePicker'
import { ContactActionSheet, type ContactInfo, type RowPosition } from '@/components/ui/ContactActionSheet'
import type { WaitlistEntry, WaitlistStatus } from '@/lib/types'

type WaitlistFilter = WaitlistStatus | 'all'

const STATUS_FILTERS: { key: WaitlistFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'WAITING', label: 'WAITING' },
  { key: 'NOTIFIED', label: 'NOTIFIED' },
]

function WaitlistStatusBadge({ status }: { status: WaitlistStatus }) {
  const bgColor = getWaitlistStatusColor(status)
  const textColor = getContrastText(bgColor)

  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusText, { color: textColor }]}>{status}</Text>
    </View>
  )
}

interface SwipeAction {
  label: string
  color: string
  textColor?: string
  onPress: () => void
}

function SwipeableWaitlistRow({
  entry,
  onPress,
  onLongPress,
  isSelected,
  onNotify,
  onSeat,
  onCancel,
  onRemove,
  showSwipeHint = true,
}: {
  entry: WaitlistEntry
  onPress: () => void
  onLongPress: (position: RowPosition) => void
  isSelected?: boolean
  onNotify: () => void
  onSeat: () => void
  onCancel: () => void
  onRemove: () => void
  showSwipeHint?: boolean
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const rowRef = useRef<View>(null)
  const [pressed, setPressed] = useState(false)

  const timeDisplay = entry.time
    ? format(new Date(`2000-01-01T${entry.time}`), 'h:mm a')
    : 'ANY TIME'

  const bgColor = getWaitlistStatusColor(entry.status)
  const status = entry.status
  const hasPhone = !!entry.phone

  // Check if this is a final state (no actions except remove)
  const isFinalState = ['CONVERTED', 'EXPIRED', 'CANCELLED'].includes(status)

  // Determine which actions to show based on current status
  // Left swipe = primary action (SEAT)
  const getLeftAction = (): SwipeAction | null => {
    if (status === 'WAITING' || status === 'NOTIFIED') {
      return { label: 'SEAT', color: Neo.lime, onPress: onSeat }
    }
    return null
  }

  // Right swipe = secondary actions (NOTIFY if available, CANCEL, REMOVE)
  const getRightActions = (): SwipeAction[] => {
    const actions: SwipeAction[] = []
    // Add NOTIFY option if waiting and has phone
    if (status === 'WAITING' && hasPhone) {
      actions.push({ label: 'NOTIFY', color: Neo.cyan, onPress: onNotify })
    }
    if (status === 'WAITING' || status === 'NOTIFIED') {
      actions.push({ label: 'CANCEL', color: Neo.pink, textColor: Neo.white, onPress: onCancel })
    }
    // Remove is always available
    actions.push({ label: 'REMOVE', color: Neo.black, textColor: Neo.white, onPress: onRemove })
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
          styles.entryRow,
          pressed && styles.entryRowPressed,
          isSelected && styles.entryRowSelected,
        ]}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityLabel={`${entry.name}, ${entry.covers} guests, ${timeDisplay}, ${entry.status}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityHint={hasSwipeActions ? "Tap to view details, swipe for quick actions, hold for contact options" : "Hold for contact options"}
      >
      <View style={[styles.entryTime, { backgroundColor: bgColor }]}>
        <Text style={styles.timeText}>{timeDisplay}</Text>
        <Text style={styles.coversText}>
          {entry.covers} {entry.covers === 1 ? 'guest' : 'guests'}
        </Text>
      </View>
      <View style={styles.entryDetails}>
        <Text style={styles.guestName}>{entry.name}</Text>
        <Text style={styles.entryMeta}>
          {entry.phone || '(no phone)'} {entry.email ? `· ${entry.email}` : ''}
        </Text>
        {entry.notes && (
          <Text style={styles.notes} numberOfLines={1}>
            {entry.notes}
          </Text>
        )}
      </View>
      <View style={styles.statusContainer}>
        <WaitlistStatusBadge status={entry.status} />
        {hasSwipeActions && showSwipeHint && !isFinalState && (
          <Text style={styles.swipeHint}>← SWIPE →</Text>
        )}
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

function DateSelector({
  date,
  onDateChange,
  onOpenPicker,
}: {
  date: Date
  onDateChange: (date: Date) => void
  onOpenPicker: () => void
}) {
  const dateLabel = isToday(date) ? 'TODAY' : format(date, 'EEE, MMM d').toUpperCase()
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
        <Text style={styles.dateHint}>TAP TO PICK</Text>
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
      accessibilityLabel="Add to waitlist"
      accessibilityRole="button"
      accessibilityHint="Opens the add to waitlist screen"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

export default function WaitlistScreen() {
  const router = useRouter()
  const { isTablet } = useDeviceType()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<WaitlistFilter>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [actionSheetContact, setActionSheetContact] = useState<ContactInfo | null>(null)
  const [actionSheetPosition, setActionSheetPosition] = useState<RowPosition | null>(null)

  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const { data, isLoading, refetch } = useWaitlist(dateString)
  const [refreshing, setRefreshing] = useState(false)

  // Mutations for quick actions
  const notifyMutation = useNotifyWaitlistEntry()
  const updateStatusMutation = useUpdateWaitlistStatus()
  const deleteMutation = useDeleteWaitlistEntry()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const entries = data?.entries || []
  const filteredEntries =
    statusFilter === 'all'
      ? entries
      : entries.filter((e) => e.status === statusFilter)

  // Sort by created_at (newest first) or by time preference
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    // Sort by created_at descending (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const handlePress = (entry: WaitlistEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // For now, we could show an alert or navigate to a detail screen
    // This is a placeholder - we can add a detail modal later
    Alert.alert(
      entry.name,
      `Party of ${entry.covers}\n${entry.phone || 'No phone'}\n${entry.email || 'No email'}\n\n${entry.notes || 'No notes'}`,
      [{ text: 'OK' }]
    )
  }

  const handleAddNew = () => {
    router.push('/waitlist/create')
  }

  const handleNotify = (entry: WaitlistEntry) => {
    if (!entry.phone) {
      Alert.alert('No Phone', 'This guest has no phone number on file.')
      return
    }
    Alert.alert(
      'Notify Guest',
      `Send "table ready" SMS to ${entry.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            notifyMutation.mutate(entry.uuid, {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('Notified', `SMS sent to ${entry.name}`)
              },
              onError: (error: any) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                const message = error?.message || 'Failed to send notification'
                Alert.alert('Notification Failed', message)
              },
            })
          },
        },
      ]
    )
  }

  const handleSeat = (entry: WaitlistEntry) => {
    router.push({
      pathname: '/waitlist/seat',
      params: {
        uuid: entry.uuid,
        name: entry.name,
        covers: entry.covers.toString(),
        date: dateString,
      },
    })
  }

  const handleCancel = (entry: WaitlistEntry) => {
    Alert.alert(
      'Cancel Entry',
      `Cancel waitlist entry for ${entry.name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Entry',
          style: 'destructive',
          onPress: () => {
            updateStatusMutation.mutate(
              { uuid: entry.uuid, status: 'CANCELLED' },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                },
                onError: (error: any) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  const message = error?.message || 'Failed to cancel entry'
                  Alert.alert('Error', message)
                },
              }
            )
          },
        },
      ]
    )
  }

  const handleRemove = (entry: WaitlistEntry) => {
    Alert.alert(
      'Remove Entry',
      `Permanently remove ${entry.name} from waitlist?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(entry.uuid, {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              },
              onError: (error: any) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                const message = error?.message || 'Failed to remove entry'
                Alert.alert('Error', message)
              },
            })
          },
        },
      ]
    )
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
      ) : sortedEntries.length === 0 ? (
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
          <Text style={styles.emptyTitle}>NO WAITLIST</Text>
          <Text style={styles.emptySubtext}>
            {statusFilter === 'all'
              ? 'No guests waiting for this date'
              : `No ${statusFilter.toLowerCase()} entries`}
          </Text>
          <Text style={styles.pullHint}>Pull down to refresh</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedEntries}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <SwipeableWaitlistRow
              entry={item}
              onPress={() => handlePress(item)}
              onLongPress={(position) => {
                setActionSheetContact({
                  name: item.name,
                  phone: item.phone,
                  email: item.email,
                })
                setActionSheetPosition(position)
              }}
              onNotify={() => handleNotify(item)}
              onSeat={() => handleSeat(item)}
              onCancel={() => handleCancel(item)}
              onRemove={() => handleRemove(item)}
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

      {listContent}

      {/* Floating Action Button */}
      <FAB onPress={handleAddNew} />

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
    backgroundColor: Neo.purple,
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
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateHint: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.white,
    opacity: 0.7,
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
  entryRow: {
    flexDirection: 'row',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  entryRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  entryRowSelected: {
    borderColor: Neo.purple,
    borderWidth: NeoBorder.thick || 4,
    backgroundColor: Neo.purple + '20',
  },
  entryTime: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  coversText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    opacity: 0.8,
  },
  entryDetails: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  guestName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  entryMeta: {
    fontSize: 11,
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
    backgroundColor: Neo.purple,
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
})
