import { format } from 'date-fns'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useActivity } from '@/lib/api/queries'
import type { ActivityItem, ActivityRange } from '@/lib/types'

const TIME_RANGES: { key: ActivityRange; label: string; description: string }[] = [
  { key: '4h', label: '4H', description: 'Last 4 hours' },
  { key: '24h', label: '24H', description: 'Last 24 hours' },
  { key: '7d', label: '7D', description: 'Last 7 days' },
]

const ACTIVITY_TYPES = [
  { key: 'all', label: 'ALL' },
  { key: 'new_reservation', label: 'NEW' },
  { key: 'confirmed', label: 'CONFIRMED' },
  { key: 'seated', label: 'SEATED' },
  { key: 'completed', label: 'DONE' },
  { key: 'cancellation', label: 'CANCELLED' },
  { key: 'no_show', label: 'NO-SHOW' },
  { key: 'walk_in', label: 'WALK-IN' },
] as const

type ActivityTypeFilter = typeof ACTIVITY_TYPES[number]['key']

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
  const timestamp = new Date(item.timestamp)
  const time = format(timestamp, 'h:mm a')
  const date = format(timestamp, 'MMM d')
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
          <Text style={styles.activityTime}>{date} · {time}</Text>
        </View>
        <Text style={styles.activityName}>{item.reservation.name}</Text>
        <Text style={styles.activityMeta}>
          {item.reservation.covers} {item.reservation.covers === 1 ? 'guest' : 'guests'}
          {item.reservation.table_numbers && item.reservation.table_numbers.length > 0 && (
            ` · Table ${item.reservation.table_numbers.join(', ')}`
          )}
        </Text>
      </View>
      <Text style={styles.activityChevron}>›</Text>
    </Pressable>
  )
}

export default function ActivityScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [activityRange, setActivityRange] = useState<ActivityRange>('24h')
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('all')

  const { data, isLoading, refetch } = useActivity(activityRange)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const items = data?.items || []
  const filteredItems = typeFilter === 'all'
    ? items
    : items.filter((item) => item.type === typeFilter)

  const handleActivityPress = (item: ActivityItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/reservation/${item.reservation.id}`)
  }

  const handleRangeChange = (range: ActivityRange) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActivityRange(range)
  }

  const handleTypeFilterChange = (type: ActivityTypeFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTypeFilter(type)
  }

  const currentRange = TIME_RANGES.find((r) => r.key === activityRange)

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header with time range selector */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>ACTIVITY</Text>
          <View style={styles.rangeSelector}>
            {TIME_RANGES.map((range) => (
              <Pressable
                key={range.key}
                style={[
                  styles.rangeChip,
                  activityRange === range.key && styles.rangeChipActive,
                ]}
                onPress={() => handleRangeChange(range.key)}
                accessibilityLabel={range.description}
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

        {/* Type filter */}
        <FlatList
          horizontal
          data={ACTIVITY_TYPES}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilterContainer}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.typeChip,
                typeFilter === item.key && styles.typeChipActive,
              ]}
              onPress={() => handleTypeFilterChange(item.key)}
              accessibilityLabel={`Filter by ${item.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: typeFilter === item.key }}
            >
              <Text
                style={[
                  styles.typeChipText,
                  typeFilter === item.key && styles.typeChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Activity list */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityRow item={item} onPress={() => handleActivityPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Neo.black}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>NO ACTIVITY</Text>
            <Text style={styles.emptySubtext}>
              {typeFilter === 'all'
                ? `No activity in the ${currentRange?.description.toLowerCase()}`
                : `No ${typeFilter.replace('_', ' ')} activity`}
            </Text>
          </View>
        }
        ListHeaderComponent={
          filteredItems.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredItems.length} {filteredItems.length === 1 ? 'event' : 'events'} · {currentRange?.description}
              </Text>
            </View>
          ) : null
        }
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  rangeChipActive: {
    backgroundColor: Neo.black,
  },
  rangeChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rangeChipTextActive: {
    color: Neo.white,
  },
  typeFilterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  typeChipActive: {
    backgroundColor: Neo.yellow,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  typeChipTextActive: {
    color: Neo.black,
  },
  listContent: {
    flexGrow: 1,
  },
  listHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.5,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: NeoBorder.thin,
    ...NeoShadow.sm,
  },
  activityRowPressed: {
    opacity: 0.7,
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  activityContent: {
    flex: 1,
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
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  activityMeta: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
    marginTop: 2,
  },
  activityChevron: {
    fontSize: 24,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.4,
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
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
    textAlign: 'center',
  },
})
