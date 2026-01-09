import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useOrder } from '@/lib/api/queries'
import { useUpdateOrderFulfillment } from '@/lib/api/mutations'
import type { FulfillmentStatus, OrderStatus } from '@/lib/types'

const FULFILLMENT_STATUSES: FulfillmentStatus[] = ['NEW', 'IN_PROGRESS', 'READY', 'COMPLETED']

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

function FulfillmentStatusControl({
  current,
  onUpdate,
  isUpdating,
}: {
  current: FulfillmentStatus
  onUpdate: (status: FulfillmentStatus) => void
  isUpdating: boolean
}) {
  return (
    <View style={styles.fulfillmentControl}>
      <Text style={styles.fulfillmentLabel}>FULFILLMENT STATUS</Text>
      <View style={styles.fulfillmentButtons}>
        {FULFILLMENT_STATUSES.map((status) => {
          const isActive = current === status
          const isPast = FULFILLMENT_STATUSES.indexOf(status) < FULFILLMENT_STATUSES.indexOf(current)
          return (
            <Pressable
              key={status}
              style={[
                styles.fulfillmentButton,
                isActive && { backgroundColor: getFulfillmentColor(status) },
                isPast && styles.fulfillmentButtonPast,
                isUpdating && styles.fulfillmentButtonDisabled,
              ]}
              onPress={() => {
                if (!isActive && !isUpdating) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onUpdate(status)
                }
              }}
              disabled={isActive || isUpdating}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.fulfillmentButtonText,
                  isActive && styles.fulfillmentButtonTextActive,
                  isPast && styles.fulfillmentButtonTextPast,
                ]}
              >
                {status.replace('_', ' ')}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const orderId = id ? parseInt(id, 10) : null

  const { data: order, isLoading, refetch } = useOrder(orderId)
  const updateFulfillment = useUpdateOrderFulfillment()

  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleUpdateFulfillment = (status: FulfillmentStatus) => {
    if (!orderId) return

    updateFulfillment.mutate(
      { orderId, fulfillmentStatus: status },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to update status')
        },
      }
    )
  }

  if (isLoading || !order) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'ORDER',
            headerStyle: { backgroundColor: Neo.white },
            headerTintColor: Neo.black,
          }}
        />
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Neo.black} />
          </View>
        </SafeAreaView>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `ORDER #${order.orderNumber}`,
          headerStyle: { backgroundColor: Neo.white },
          headerTintColor: Neo.black,
        }}
      />
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.badgeText}>{order.status}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.orderDate}>
              {formatDate(order.createdAt, 'EEEE, MMMM d, yyyy • h:mm a')}
            </Text>
          </View>

          {/* Fulfillment Status */}
          <FulfillmentStatusControl
            current={order.fulfillmentStatus}
            onUpdate={handleUpdateFulfillment}
            isUpdating={updateFulfillment.isPending}
          />

          {/* Customer Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUSTOMER</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.customerName}>{order.customerName}</Text>
              <Text style={styles.customerDetail}>{order.customerEmail}</Text>
              {order.customerPhone && (
                <Text style={styles.customerDetail}>{order.customerPhone}</Text>
              )}
              {order.customerNotes && (
                <View style={styles.customerNotes}>
                  <Text style={styles.customerNotesLabel}>NOTES</Text>
                  <Text style={styles.customerNotesText}>{order.customerNotes}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              ITEMS ({order.items?.length || 0})
            </Text>
            <View style={styles.sectionCard}>
              {order.items?.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < (order.items?.length || 0) - 1 && styles.itemRowBorder,
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.nameSnapshot}</Text>
                    {item.variantSnapshot && (
                      <Text style={styles.itemVariant}>{item.variantSnapshot}</Text>
                    )}
                    {item.giftCardRecipientEmail && (
                      <Text style={styles.itemGiftCard}>
                        To: {item.giftCardRecipientName || item.giftCardRecipientEmail}
                      </Text>
                    )}
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(item.totalCents, order.currency)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Order Totals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOTALS</Text>
            <View style={styles.sectionCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(order.subtotalCents, order.currency)}
                </Text>
              </View>
              {order.refundedAmountCents > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: Neo.pink }]}>Refunded</Text>
                  <Text style={[styles.totalValue, { color: Neo.pink }]}>
                    -{formatCurrency(order.refundedAmountCents, order.currency)}
                  </Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelFinal}>Total</Text>
                <Text style={styles.totalValueFinal}>
                  {formatCurrency(order.totalCents, order.currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Timestamps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIMELINE</Text>
            <View style={styles.sectionCard}>
              <View style={styles.timestampRow}>
                <Text style={styles.timestampLabel}>Created</Text>
                <Text style={styles.timestampValue}>
                  {formatDate(order.createdAt, 'MMM d, h:mm a')}
                </Text>
              </View>
              {order.fulfilledAt && (
                <View style={styles.timestampRow}>
                  <Text style={styles.timestampLabel}>Fulfilled</Text>
                  <Text style={styles.timestampValue}>
                    {formatDate(order.fulfilledAt, 'MMM d, h:mm a')}
                  </Text>
                </View>
              )}
              {order.refundedAt && (
                <View style={styles.timestampRow}>
                  <Text style={[styles.timestampLabel, { color: Neo.pink }]}>Refunded</Text>
                  <Text style={[styles.timestampValue, { color: Neo.pink }]}>
                    {formatDate(order.refundedAt, 'MMM d, h:mm a')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orderDate: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fulfillmentControl: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  fulfillmentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fulfillmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  fulfillmentButton: {
    flex: 1,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fulfillmentButtonPast: {
    backgroundColor: Neo.white,
  },
  fulfillmentButtonDisabled: {
    opacity: 0.5,
  },
  fulfillmentButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fulfillmentButtonTextActive: {
    opacity: 1,
    fontWeight: '800',
  },
  fulfillmentButtonTextPast: {
    opacity: 0.3,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 13,
    color: Neo.black,
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  customerNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  customerNotesLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  customerNotesText: {
    fontSize: 13,
    color: Neo.black,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  itemVariant: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 2,
  },
  itemGiftCard: {
    fontSize: 11,
    color: Neo.purple,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRowFinal: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 13,
    color: Neo.black,
    opacity: 0.7,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
  },
  totalLabelFinal: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  totalValueFinal: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  timestampLabel: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestampValue: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
