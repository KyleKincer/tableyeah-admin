import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useGiftCards } from '@/lib/api/queries'
import type { GiftCard, GiftCardStatus } from '@/lib/types'
import { GiftCardDetailPanel } from './GiftCardDetailPanel'

const STATUS_FILTERS: { key: GiftCardStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'ACTIVE', label: 'ACTIVE' },
  { key: 'VOID', label: 'VOID' },
]

function getStatusColor(status: GiftCardStatus): string {
  switch (status) {
    case 'ACTIVE':
      return Neo.lime
    case 'VOID':
      return Neo.pink
    default:
      return Neo.cream
  }
}

function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatCode(code: string): string {
  // Format as XXXX-XXXX-XXXX-XXXX
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  return cleaned.match(/.{1,4}/g)?.join('-') || code
}

function formatDate(dateString: string | undefined | null, formatStr: string): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'
    return format(date, formatStr)
  } catch {
    return 'N/A'
  }
}

function formatCodeLast4(codeLast4: string): string {
  // Display masked code with last 4
  return `****-****-****-${codeLast4}`
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  )
}

function GiftCardCard({
  giftCard,
  onPress,
  isSelected,
}: {
  giftCard: GiftCard
  onPress: () => void
  isSelected?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.giftCardCard,
        pressed && styles.giftCardCardPressed,
        isSelected && styles.giftCardCardSelected,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Gift card ending in ${giftCard.codeLast4}`}
    >
      <View style={styles.giftCardHeader}>
        <Text style={styles.giftCardCode}>{formatCodeLast4(giftCard.codeLast4)}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(giftCard.status) }]}>
          <Text style={styles.badgeText}>{giftCard.status}</Text>
        </View>
      </View>

      <View style={styles.giftCardDetails}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>BALANCE</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(giftCard.balanceCents, giftCard.currency)}
          </Text>
        </View>
        {giftCard.balanceCents !== giftCard.initialValueCents && (
          <Text style={styles.initialValue}>
            Initial: {formatCurrency(giftCard.initialValueCents, giftCard.currency)}
          </Text>
        )}
      </View>

      {(giftCard.recipientName || giftCard.recipientEmail) && (
        <View style={styles.recipientInfo}>
          {giftCard.recipientName && (
            <Text style={styles.recipientName}>{giftCard.recipientName}</Text>
          )}
          {giftCard.recipientEmail && (
            <Text style={styles.recipientEmail}>{giftCard.recipientEmail}</Text>
          )}
        </View>
      )}

      <View style={styles.giftCardFooter}>
        <Text style={styles.giftCardDate}>
          {formatDate(giftCard.createdAt, 'MMM d, yyyy')}
        </Text>
        <Text style={styles.chevron}>→</Text>
      </View>
    </Pressable>
  )
}

export function GiftCardsList({ useSplitLayout }: { useSplitLayout: boolean }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<GiftCardStatus | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<number | null>(null)

  const { data, isLoading, refetch } = useGiftCards({
    search: search || undefined,
    status: filter === 'all' ? undefined : filter,
    limit: 50,
  })

  const giftCards = data?.giftCards || []
  const stats = data?.stats

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleGiftCardPress = (giftCard: GiftCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (useSplitLayout) {
      setSelectedGiftCardId(giftCard.id)
    } else {
      router.push(`/gift-card/${giftCard.id}` as any)
    }
  }

  const handleIssuePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/gift-card/issue' as any)
  }

  const renderItem = ({ item }: { item: GiftCard }) => (
    <GiftCardCard
      giftCard={item}
      onPress={() => handleGiftCardPress(item)}
      isSelected={useSplitLayout && selectedGiftCardId === item.id}
    />
  )

  const listContent = (
    <>
      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <StatsCard
            label="ISSUED"
            value={formatCurrency(stats.totalIssuedCents, 'USD')}
          />
          <StatsCard
            label="OUTSTANDING"
            value={formatCurrency(stats.outstandingBalanceCents, 'USD')}
          />
          <StatsCard
            label="ACTIVE"
            value={stats.activeCount.toString()}
          />
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by code, email, or name..."
          placeholderTextColor={Neo.black + '40'}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {STATUS_FILTERS.map((f) => {
          const isActive = filter === f.key
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setFilter(f.key)
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* List */}
      {isLoading && giftCards.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Neo.black} />
        </View>
      ) : giftCards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>NO GIFT CARDS</Text>
          <Text style={styles.emptyStateSubtext}>
            {search ? 'Try a different search' : 'Issue your first gift card'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={giftCards}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={handleIssuePress}
        accessibilityRole="button"
        accessibilityLabel="Issue new gift card"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </>
  )

  if (useSplitLayout) {
    return (
      <View style={styles.splitContainer}>
        <View style={styles.listPane}>{listContent}</View>
        <View style={styles.detailPane}>
          {selectedGiftCardId ? (
            <GiftCardDetailPanel giftCardId={selectedGiftCardId} />
          ) : (
            <View style={styles.detailPlaceholder}>
              <Text style={styles.detailPlaceholderText}>SELECT A GIFT CARD</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return <View style={styles.container}>{listContent}</View>
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
  listPane: {
    width: '40%',
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
  },
  detailPane: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  detailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  detailPlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.3,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailPlaceholderSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.2,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  statsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    marginTop: 4,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Neo.black,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Neo.lime,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 14,
    textAlign: 'center',
  },
  filterChipTextActive: {
    opacity: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80, // Space for FAB
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.3,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.2,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  giftCardCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 12,
    ...NeoShadow.default,
  },
  giftCardCardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  giftCardCardSelected: {
    backgroundColor: Neo.lime,
  },
  giftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  giftCardCode: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  giftCardDetails: {
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  initialValue: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recipientInfo: {
    backgroundColor: Neo.cream,
    padding: 12,
    marginBottom: 12,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black + '30',
  },
  recipientName: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
  },
  recipientEmail: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  giftCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
    paddingTop: 12,
  },
  giftCardDate: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chevron: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.default,
  },
  fabText: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.black,
    lineHeight: 36,
  },
})
