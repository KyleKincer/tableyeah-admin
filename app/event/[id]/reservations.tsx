import { format } from 'date-fns'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
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

import { Neo, NeoBorder, NeoShadow, getStatusColor, getContrastText } from '@/constants/theme'
import { useEventReservations } from '@/lib/api/queries'
import { PaymentStatusBadge } from '@/components/event/PaymentBadge'
import type { EventReservation, ReservationStatus } from '@/lib/types'

function formatCurrency(cents: number, currency = 'USD'): string {
  return `$${(cents / 100).toFixed(2)}`
}

function SummaryCard({
  title,
  value,
  color = Neo.white,
}: {
  title: string
  value: string
  color?: string
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: color }]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
    </View>
  )
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const bgColor = getStatusColor(status)
  const textColor = getContrastText(bgColor)

  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusBadgeText, { color: textColor }]}>{status}</Text>
    </View>
  )
}

function ReservationRow({
  reservation,
  onPress,
}: {
  reservation: EventReservation
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)

  const timeslotTime = reservation.timeslotStartTime
    ? format(new Date(reservation.timeslotStartTime), 'h:mm a')
    : null

  return (
    <Pressable
      style={[styles.reservationRow, pressed && styles.reservationRowPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={styles.reservationMain}>
        <View style={styles.reservationHeader}>
          <Text style={styles.reservationName} numberOfLines={1}>{reservation.name}</Text>
          <StatusBadge status={reservation.status} />
        </View>
        <View style={styles.reservationMeta}>
          <Text style={styles.reservationMetaText}>
            {reservation.covers} {reservation.covers === 1 ? 'guest' : 'guests'}
            {timeslotTime && ` · ${timeslotTime}`}
          </Text>
        </View>
        {reservation.email && (
          <Text style={styles.reservationEmail} numberOfLines={1}>{reservation.email}</Text>
        )}
      </View>
      <View style={styles.reservationPayment}>
        <PaymentStatusBadge status={reservation.paymentStatus} />
        {reservation.amountTotalCents && reservation.amountTotalCents > 0 && (
          <Text style={styles.amountText}>
            {formatCurrency(reservation.amountTotalCents, reservation.currency || 'USD')}
          </Text>
        )}
        {reservation.refundedAmountCents && reservation.refundedAmountCents > 0 && (
          <Text style={styles.refundedText}>
            -{formatCurrency(reservation.refundedAmountCents)}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

export default function EventReservationsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = parseInt(id, 10)

  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useEventReservations(eventId)

  const reservations = data?.reservations || []
  const summary = data?.summary

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleReservationPress = (reservation: EventReservation) => {
    router.push(`/reservation/${reservation.id}`)
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Neo.black} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Revenue Summary */}
      {summary && (
        <View style={styles.summaryContainer}>
          <SummaryCard
            title="COLLECTED"
            value={formatCurrency(summary.totalCollected)}
            color={Neo.lime}
          />
          <SummaryCard
            title="REFUNDED"
            value={formatCurrency(summary.totalRefunded)}
            color={Neo.pink}
          />
          <SummaryCard
            title="NET"
            value={formatCurrency(summary.netRevenue)}
            color={Neo.cyan}
          />
        </View>
      )}

      {/* Stats Row */}
      {summary && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.paidReservations}</Text>
            <Text style={styles.statLabel}>PAID</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.pendingPayments}</Text>
            <Text style={styles.statLabel}>PENDING</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.refundedReservations}</Text>
            <Text style={styles.statLabel}>REFUNDED</Text>
          </View>
        </View>
      )}

      {/* Reservations List */}
      {reservations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO RESERVATIONS</Text>
          <Text style={styles.emptySubtext}>No reservations have been made for this event yet</Text>
        </View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ReservationRow
              reservation={item}
              onPress={() => handleReservationPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  summaryCard: {
    flex: 1,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Neo.black + '30',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    marginTop: 2,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  reservationRow: {
    flexDirection: 'row',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  reservationRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  reservationMain: {
    flex: 1,
    padding: 14,
  },
  reservationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reservationName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationMeta: {
    marginTop: 6,
  },
  reservationMetaText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationEmail: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationPayment: {
    borderLeftWidth: NeoBorder.thin,
    borderLeftColor: Neo.black,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    gap: 4,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refundedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Neo.pink,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  emptySubtext: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
})
