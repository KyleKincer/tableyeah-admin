import { format } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor } from '@/constants/theme'
import { useActivity, useReservations } from '@/lib/api/queries'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import type { ActivityItem, ActivityRange } from '@/lib/types'

const TIME_RANGES: { key: ActivityRange; label: string }[] = [
  { key: '4h', label: '4H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
]

function getActivityLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'new_reservation':
      return 'NEW BOOKING'
    case 'confirmed':
      return 'CONFIRMED'
    case 'cancellation':
      return 'CANCELLED'
    case 'seated':
      return 'SEATED'
    case 'completed':
      return 'COMPLETED'
    case 'no_show':
      return 'NO-SHOW'
    case 'walk_in':
      return 'WALK-IN'
    case 'modification':
      return 'MODIFIED'
    default:
      return 'ACTIVITY'
  }
}

function getActivityBgColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'new_reservation':
      return Neo.lime
    case 'confirmed':
      return Neo.lime
    case 'cancellation':
      return Neo.pink
    case 'seated':
      return Neo.cyan
    case 'completed':
      return Neo.white
    case 'no_show':
      return Neo.orange
    case 'walk_in':
      return Neo.purple
    case 'modification':
      return Neo.yellow
    default:
      return Neo.white
  }
}

function ActivityRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)
  const time = format(new Date(item.timestamp), 'h:mm a')
  const bgColor = getActivityBgColor(item.type)

  return (
    <Pressable
      style={[
        styles.activityRow,
        { backgroundColor: bgColor },
        pressed && styles.activityRowPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${getActivityLabel(item.type)}: ${item.reservation.name}, ${item.reservation.covers} guests`}
      accessibilityRole="button"
      accessibilityHint="View reservation details"
    >
      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityType}>{getActivityLabel(item.type)}</Text>
          <Text style={styles.activityTime}>{time}</Text>
        </View>
        <Text style={styles.activityName}>
          {item.reservation.name} · {item.reservation.covers}{' '}
          {item.reservation.covers === 1 ? 'guest' : 'guests'}
        </Text>
      </View>
      <Text style={styles.activityChevron}>›</Text>
    </Pressable>
  )
}

function StatCard({
  label,
  value,
  bgColor = Neo.white,
  onPress,
  isTablet = false,
}: {
  label: string
  value: number
  bgColor?: string
  onPress?: () => void
  isTablet?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  if (!onPress) {
    return (
      <View style={[styles.statCard, isTablet && styles.statCardTablet, { backgroundColor: bgColor }]}>
        <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    )
  }

  return (
    <Pressable
      style={[
        styles.statCard,
        isTablet && styles.statCardTablet,
        { backgroundColor: bgColor },
        pressed && styles.statCardPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      accessibilityHint="View reservations"
    >
      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  )
}

function TodayStatCard({
  label,
  value,
  bgColor = Neo.white,
  onPress,
}: {
  label: string
  value: number
  bgColor?: string
  onPress?: () => void
}) {
  const [pressed, setPressed] = useState(false)

  const content = (
    <>
      <Text style={styles.todayStatValue}>{value}</Text>
      <Text style={styles.todayStatLabel}>{label}</Text>
    </>
  )

  if (!onPress) {
    return (
      <View style={[styles.todayStatCard, { backgroundColor: bgColor }]}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      style={[
        styles.todayStatCard,
        { backgroundColor: bgColor },
        pressed && styles.statCardPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      accessibilityHint="View reservations"
    >
      {content}
    </Pressable>
  )
}

function getRangeLabel(range: ActivityRange): string {
  switch (range) {
    case '4h':
      return 'LAST 4 HOURS'
    case '24h':
      return 'LAST 24 HOURS'
    case '7d':
      return 'LAST 7 DAYS'
  }
}

export default function DashboardScreen() {
  const router = useRouter()
  const { isTablet } = useDeviceType()
  const [refreshing, setRefreshing] = useState(false)
  const [activityRange, setActivityRange] = useState<ActivityRange>('4h')
  const { data, isLoading, isFetching, refetch, error } = useActivity(activityRange)

  // Show subtle loading when switching ranges (but not initial load)
  const isRefetchingActivity = isFetching && !isLoading

  // Get today's reservations for the "Today's Service" section
  const todayString = format(new Date(), 'yyyy-MM-dd')
  const { data: todayData, refetch: refetchToday } = useReservations(todayString)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetch(), refetchToday()])
    setRefreshing(false)
  }, [refetch, refetchToday])

  const handleRangeChange = (range: ActivityRange) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActivityRange(range)
  }

  const handleViewAllActivity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/activity')
  }

  const items = data?.items || []
  const todayReservations = todayData?.reservations || []

  // Today's service stats
  const todayStats = {
    upcoming: todayReservations.filter((r) => r.status === 'BOOKED' || r.status === 'CONFIRMED').length,
    seated: todayReservations.filter((r) => r.status === 'SEATED').length,
    completed: todayReservations.filter((r) => r.status === 'COMPLETED').length,
    totalCovers: todayReservations
      .filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW')
      .reduce((sum, r) => sum + r.covers, 0),
  }

  // Activity stats (last 4 hours)
  const activityStats = {
    reservations: items.filter(
      (i) => i.type === 'new_reservation' || i.type === 'walk_in'
    ).length,
    seated: items.filter((i) => i.type === 'seated').length,
    completed: items.filter((i) => i.type === 'completed').length,
    cancelled: items.filter((i) => i.type === 'cancellation' || i.type === 'no_show')
      .length,
  }

  const handleActivityPress = (item: ActivityItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/reservation/${item.reservation.id}`)
  }

  const handleGoToReservations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/(tabs)/reservations')
  }

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>ERROR</Text>
            <Text style={styles.errorText}>Failed to load dashboard</Text>
            <Text style={styles.errorSubtext}>Pull down to retry</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Neo.black}
          />
        }
      >
        {/* Today's Service + Activity Stats (side-by-side on tablet) */}
        {isTablet ? (
          <View style={styles.statsRow}>
            {/* Today's Service - Left */}
            <View style={styles.statsRowLeft}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>TODAY'S SERVICE</Text>
                <Pressable
                  style={[styles.todayCard, styles.todayCardTablet]}
                  onPress={handleGoToReservations}
                  accessibilityLabel="View today's reservations"
                  accessibilityRole="button"
                >
                  <View style={[styles.todayHeader, styles.todayHeaderTablet]}>
                    <Text style={[styles.todayCoversValue, styles.todayCoversValueTablet]}>
                      {todayStats.totalCovers}
                    </Text>
                    <Text style={styles.todayCoversLabel}>COVERS TODAY</Text>
                  </View>
                  <View style={styles.todayStatsRow}>
                    <TodayStatCard
                      label="UPCOMING"
                      value={todayStats.upcoming}
                      bgColor={Neo.lime}
                      onPress={handleGoToReservations}
                    />
                    <TodayStatCard
                      label="SEATED"
                      value={todayStats.seated}
                      bgColor={Neo.cyan}
                      onPress={handleGoToReservations}
                    />
                    <TodayStatCard
                      label="DONE"
                      value={todayStats.completed}
                      bgColor={Neo.white}
                      onPress={handleGoToReservations}
                    />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Activity Stats - Right */}
            <View style={styles.statsRowRight}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{getRangeLabel(activityRange)}</Text>
                  <View style={styles.rangeSelector}>
                    {TIME_RANGES.map((range) => (
                      <Pressable
                        key={range.key}
                        style={[
                          styles.rangeChip,
                          activityRange === range.key && styles.rangeChipActive,
                        ]}
                        onPress={() => handleRangeChange(range.key)}
                        accessibilityLabel={`Show activity for ${range.label}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activityRange === range.key }}
                      >
                        <Text
                          style={[
                            styles.rangeChipText,
                            activityRange === range.key && styles.rangeChipTextActive,
                          ]}
                        >
                          {range.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={[
                  styles.statsGrid,
                  styles.statsGridTabletCompact,
                  isRefetchingActivity && styles.statsGridLoading,
                ]}>
                  <StatCard label="NEW" value={activityStats.reservations} bgColor={Neo.lime} isTablet />
                  <StatCard label="SEATED" value={activityStats.seated} bgColor={Neo.cyan} isTablet />
                  <StatCard label="DONE" value={activityStats.completed} bgColor={Neo.white} isTablet />
                  <StatCard label="LOST" value={activityStats.cancelled} bgColor={Neo.pink} isTablet />
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Today's Service Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TODAY'S SERVICE</Text>
              <Pressable
                style={styles.todayCard}
                onPress={handleGoToReservations}
                accessibilityLabel="View today's reservations"
                accessibilityRole="button"
              >
                <View style={styles.todayHeader}>
                  <Text style={styles.todayCoversValue}>{todayStats.totalCovers}</Text>
                  <Text style={styles.todayCoversLabel}>COVERS TODAY</Text>
                </View>
                <View style={styles.todayStatsRow}>
                  <TodayStatCard
                    label="UPCOMING"
                    value={todayStats.upcoming}
                    bgColor={Neo.lime}
                    onPress={handleGoToReservations}
                  />
                  <TodayStatCard
                    label="SEATED"
                    value={todayStats.seated}
                    bgColor={Neo.cyan}
                    onPress={handleGoToReservations}
                  />
                  <TodayStatCard
                    label="DONE"
                    value={todayStats.completed}
                    bgColor={Neo.white}
                    onPress={handleGoToReservations}
                  />
                </View>
              </Pressable>
            </View>

            {/* Activity Stats with Time Range Selector */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{getRangeLabel(activityRange)}</Text>
                <View style={styles.rangeSelector}>
                  {TIME_RANGES.map((range) => (
                    <Pressable
                      key={range.key}
                      style={[
                        styles.rangeChip,
                        activityRange === range.key && styles.rangeChipActive,
                      ]}
                      onPress={() => handleRangeChange(range.key)}
                      accessibilityLabel={`Show activity for ${range.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activityRange === range.key }}
                    >
                      <Text
                        style={[
                          styles.rangeChipText,
                          activityRange === range.key && styles.rangeChipTextActive,
                        ]}
                      >
                        {range.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[
                styles.statsGrid,
                isRefetchingActivity && styles.statsGridLoading,
              ]}>
                <StatCard label="NEW" value={activityStats.reservations} bgColor={Neo.lime} />
                <StatCard label="SEATED" value={activityStats.seated} bgColor={Neo.cyan} />
                <StatCard label="DONE" value={activityStats.completed} bgColor={Neo.white} />
                <StatCard label="LOST" value={activityStats.cancelled} bgColor={Neo.pink} />
              </View>
            </View>
          </>
        )}

        {/* Recent Activity Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <Pressable
              style={styles.viewAllButton}
              onPress={handleViewAllActivity}
              accessibilityLabel="View all activity"
              accessibilityRole="button"
            >
              <Text style={styles.viewAllText}>VIEW ALL →</Text>
            </Pressable>
          </View>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>NO RECENT ACTIVITY</Text>
            </View>
          ) : isTablet ? (
            // Two-column layout for tablet
            <View style={[styles.activityList, styles.activityListTablet]}>
              <View style={styles.activityGrid}>
                <View style={styles.activityColumn}>
                  {items.slice(0, 8).filter((_, i) => i % 2 === 0).map((item) => (
                    <ActivityRow
                      key={item.id}
                      item={item}
                      onPress={() => handleActivityPress(item)}
                    />
                  ))}
                </View>
                <View style={[styles.activityColumn, styles.activityColumnRight]}>
                  {items.slice(0, 8).filter((_, i) => i % 2 === 1).map((item) => (
                    <ActivityRow
                      key={item.id}
                      item={item}
                      onPress={() => handleActivityPress(item)}
                    />
                  ))}
                </View>
              </View>
              {items.length > 8 && (
                <Pressable
                  style={styles.viewMoreRow}
                  onPress={handleViewAllActivity}
                  accessibilityLabel={`View ${items.length - 8} more activities`}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewMoreText}>
                    +{items.length - 8} MORE · TAP TO VIEW ALL
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.activityList}>
              {items.slice(0, 10).map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  onPress={() => handleActivityPress(item)}
                />
              ))}
              {items.length > 10 && (
                <Pressable
                  style={styles.viewMoreRow}
                  onPress={handleViewAllActivity}
                  accessibilityLabel={`View ${items.length - 10} more activities`}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewMoreText}>
                    +{items.length - 10} MORE · TAP TO VIEW ALL
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
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
  scrollContent: {
    padding: 16,
    gap: 24,
  },
  scrollContentTablet: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statsRowLeft: {
    flex: 1,
  },
  statsRowRight: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  rangeChipActive: {
    backgroundColor: Neo.black,
  },
  rangeChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rangeChipTextActive: {
    color: Neo.white,
  },
  viewAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsGridTablet: {
    flexWrap: 'nowrap',
  },
  statsGridTabletCompact: {
    flexWrap: 'wrap',
  },
  statsGridLoading: {
    opacity: 0.5,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  statValue: {
    fontSize: 48,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statCardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  statCardTablet: {
    padding: 12,
    minWidth: 0,
  },
  statValueTablet: {
    fontSize: 36,
  },
  todayCard: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  todayCardTablet: {
    padding: 12,
  },
  todayHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  todayHeaderTablet: {
    marginBottom: 8,
  },
  todayCoversValue: {
    fontSize: 64,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -3,
  },
  todayCoversValueTablet: {
    fontSize: 48,
  },
  todayCoversLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  todayStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  todayStatCard: {
    flex: 1,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
  },
  todayStatValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
  },
  todayStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activityList: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  activityListTablet: {
    // Container styles for tablet
  },
  activityGrid: {
    flexDirection: 'row',
  },
  activityColumn: {
    flex: 1,
  },
  activityColumnRight: {
    borderLeftWidth: NeoBorder.thin,
    borderLeftColor: Neo.black,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  activityRowPressed: {
    opacity: 0.7,
  },
  activityContent: {
    flex: 1,
  },
  activityChevron: {
    fontSize: 24,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.4,
    marginLeft: 8,
  },
  viewMoreRow: {
    padding: 16,
    backgroundColor: Neo.cream,
    alignItems: 'center',
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  viewMoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activityTime: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  activityName: {
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 32,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.5,
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
  errorCard: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...NeoShadow.lg,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorSubtext: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
})
