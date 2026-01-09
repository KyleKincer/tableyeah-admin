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
import { useOrders } from '@/lib/api/queries'
import type { Order, FulfillmentStatus, OrderStatus } from '@/lib/types'
import { OrderDetailPanel } from './OrderDetailPanel'

const FULFILLMENT_FILTERS: { key: FulfillmentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'NEW', label: 'NEW' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS' },
  { key: 'READY', label: 'READY' },
  { key: 'COMPLETED', label: 'COMPLETED' },
]

function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'PAID':
      return Neo.lime
    case 'REFUNDED':
      return Neo.orange
    case 'CANCELLED':
      return Neo.pink
    case 'PENDING_PAYMENT':
      return Neo.yellow
    default:
      return Neo.cream
  }
}

function getFulfillmentColor(status: FulfillmentStatus): string {
  switch (status) {
    case 'NEW':
      return Neo.cyan
    case 'IN_PROGRESS':
      return Neo.yellow
    case 'READY':
      return Neo.lime
    case 'COMPLETED':
      return Neo.cream
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

function OrderCard({
  order,
  onPress,
  isSelected,
}: {
  order: Order
  onPress: () => void
  isSelected?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.orderCard,
        pressed && styles.orderCardPressed,
        isSelected && styles.orderCardSelected,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.orderNumber} from ${order.customerName}`}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.badgeText}>{order.status}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getFulfillmentColor(order.fulfillmentStatus) }]}>
            <Text style={styles.badgeText}>{order.fulfillmentStatus.replace('_', ' ')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <Text style={styles.customerName}>{order.customerName}</Text>
        <Text style={styles.orderMeta}>
          {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} • {formatCurrency(order.totalCents, order.currency)}
        </Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderDate}>
          {formatDate(order.createdAt, 'MMM d, h:mm a')}
        </Text>
        <Text style={styles.chevron}>→</Text>
      </View>
    </Pressable>
  )
}

export function OrdersList({ useSplitLayout }: { useSplitLayout: boolean }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FulfillmentStatus | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const { data, isLoading, refetch } = useOrders({
    search: search || undefined,
    fulfillmentStatus: filter === 'all' ? undefined : filter,
    limit: 50,
  })

  const orders = data?.orders || []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleOrderPress = (order: Order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (useSplitLayout) {
      setSelectedOrderId(order.id)
    } else {
      router.push(`/order/${order.id}` as any)
    }
  }

  const renderItem = ({ item }: { item: Order }) => (
    <OrderCard
      order={item}
      onPress={() => handleOrderPress(item)}
      isSelected={useSplitLayout && selectedOrderId === item.id}
    />
  )

  const listContent = (
    <>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders..."
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
        {FULFILLMENT_FILTERS.map((f) => {
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
      {isLoading && orders.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Neo.black} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>NO ORDERS</Text>
          <Text style={styles.emptyStateSubtext}>
            {search ? 'Try a different search' : 'Orders will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
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
    </>
  )

  if (useSplitLayout) {
    return (
      <View style={styles.splitContainer}>
        <View style={styles.listPane}>{listContent}</View>
        <View style={styles.detailPane}>
          {selectedOrderId ? (
            <OrderDetailPanel orderId={selectedOrderId} />
          ) : (
            <View style={styles.detailPlaceholder}>
              <Text style={styles.detailPlaceholderText}>SELECT AN ORDER</Text>
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
  searchContainer: {
    padding: 16,
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
  orderCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 12,
    ...NeoShadow.default,
  },
  orderCardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  orderCardSelected: {
    backgroundColor: Neo.lime,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
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
  orderDetails: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 4,
  },
  orderMeta: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
    paddingTop: 12,
  },
  orderDate: {
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
})
