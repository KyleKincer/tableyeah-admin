import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import * as Haptics from 'expo-haptics'
import { isAfter, isBefore, startOfDay } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useEvents } from '@/lib/api/queries'
import { EventCard } from '@/components/event/EventCard'
import type { EventListItem } from '@/lib/types'

type FilterKey = 'upcoming' | 'past' | 'all'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'UPCOMING' },
  { key: 'past', label: 'PAST' },
  { key: 'all', label: 'ALL' },
]

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
      accessibilityLabel="Create new event"
      accessibilityRole="button"
      accessibilityHint="Opens the create event screen"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

export default function EventsScreen() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('upcoming')
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useEvents()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const events = data?.events || []

  const today = startOfDay(new Date())

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = startOfDay(new Date(event.date))
      if (filter === 'upcoming') {
        return !isBefore(eventDate, today)
      }
      if (filter === 'past') {
        return isBefore(eventDate, today)
      }
      return true // 'all'
    })
  }, [events, filter, today])

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      // Upcoming: ascending (soonest first)
      // Past: descending (most recent first)
      if (filter === 'past') {
        return dateB.getTime() - dateA.getTime()
      }
      return dateA.getTime() - dateB.getTime()
    })
  }, [filteredEvents, filter])

  const handleEventPress = (event: EventListItem) => {
    router.push(`/event/${event.id}`)
  }

  const handleCreateNew = () => {
    router.push('/event/create')
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.key
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFilter(f.key)
                }}
                accessibilityLabel={`Filter by ${f.label.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

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
      ) : sortedEvents.length === 0 ? (
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
          <Text style={styles.emptyTitle}>NO EVENTS</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'upcoming'
              ? 'No upcoming events scheduled'
              : filter === 'past'
                ? 'No past events'
                : 'No events yet'}
          </Text>
          <Pressable
            style={styles.createButton}
            onPress={handleCreateNew}
            accessibilityLabel="Create your first event"
            accessibilityRole="button"
          >
            <Text style={styles.createButtonText}>CREATE YOUR FIRST EVENT</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => handleEventPress(item)}
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

      <FAB onPress={handleCreateNew} />
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
    paddingVertical: 12,
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
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 24,
    paddingVertical: 14,
    ...NeoShadow.sm,
  },
  createButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
