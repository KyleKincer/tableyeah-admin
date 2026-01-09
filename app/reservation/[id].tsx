import { format, differenceInMinutes } from 'date-fns'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getStatusColor } from '@/constants/theme'
import { useReservation } from '@/lib/api/queries'
import {
  useSeatReservation,
  useCompleteReservation,
  useCancelReservation,
  useMarkNoShow,
  useConfirmReservation,
  useUnseatReservation,
  useUpdateReservation,
  useAssignServerToReservation,
  useSendPaymentLink,
  useRefundReservation,
} from '@/lib/api/mutations'
import { TablePickerModal } from '@/components/reservation/TablePicker'
import { NotesEditModal } from '@/components/reservation/NotesEditModal'
import { ReservationEditModal } from '@/components/reservation/ReservationEditModal'
import { ServerPickerModal } from '@/components/server/ServerPicker'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import type { ReservationStatus, PaymentStatus } from '@/lib/types'

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

function EventBadge({ name }: { name: string }) {
  return (
    <View style={styles.eventBadge}>
      <Text style={styles.eventBadgeText}>{name}</Text>
    </View>
  )
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return Neo.lime
      case 'REQUIRES_PAYMENT':
        return Neo.yellow
      case 'PARTIALLY_REFUNDED':
        return Neo.orange
      case 'REFUNDED':
        return Neo.pink
      case 'EXPIRED':
        return '#9CA3AF'
      default:
        return Neo.white
    }
  }

  const getPaymentStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return 'PAID'
      case 'REQUIRES_PAYMENT':
        return 'PAYMENT REQUIRED'
      case 'PARTIALLY_REFUNDED':
        return 'PARTIAL REFUND'
      case 'REFUNDED':
        return 'REFUNDED'
      case 'EXPIRED':
        return 'EXPIRED'
      default:
        return status
    }
  }

  const bgColor = getPaymentStatusColor(status)
  const textColor = [Neo.lime, Neo.yellow, Neo.cyan].includes(bgColor)
    ? Neo.black
    : Neo.white

  return (
    <View style={[styles.paymentStatusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.paymentStatusBadgeText, { color: textColor }]}>
        {getPaymentStatusLabel(status)}
      </Text>
    </View>
  )
}

function TurnTimeDisplay({ seatedAt, covers }: { seatedAt: string; covers: number }) {
  // Expected turn times (in minutes) based on party size
  const getExpectedTurnTime = (partySize: number): number => {
    if (partySize <= 2) return 60
    if (partySize <= 4) return 75
    if (partySize <= 6) return 90
    return 105
  }

  const seatedTime = new Date(seatedAt)
  const now = new Date()
  const elapsedMinutes = differenceInMinutes(now, seatedTime)
  const expectedMinutes = getExpectedTurnTime(covers)
  const percentage = (elapsedMinutes / expectedMinutes) * 100

  // Color based on percentage: green < 75%, amber 75-100%, red > 100%
  const getColor = () => {
    if (percentage < 75) return Neo.lime
    if (percentage <= 100) return Neo.yellow
    return Neo.pink
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <View style={[styles.turnTimeContainer, { backgroundColor: getColor() }]}>
      <Text style={styles.turnTimeLabel}>SEATED</Text>
      <Text style={styles.turnTimeValue}>{formatTime(elapsedMinutes)}</Text>
      <Text style={styles.turnTimeExpected}>/ {formatTime(expectedMinutes)} expected</Text>
    </View>
  )
}

function NeoButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  loading?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor =
    variant === 'destructive'
      ? Neo.pink
      : variant === 'primary'
        ? Neo.lime
        : Neo.white

  return (
    <Pressable
      style={[
        styles.actionButton,
        { backgroundColor: bgColor },
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Neo.black} size="small" />
      ) : (
        <Text style={styles.actionButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { isTablet, isLandscape } = useDeviceType()
  const useSplitLayout = isTablet && isLandscape

  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showNotesEditor, setShowNotesEditor] = useState(false)
  const [showServerPicker, setShowServerPicker] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const { data: reservation, isLoading, error } = useReservation(Number(id))
  const seatMutation = useSeatReservation()
  const completeMutation = useCompleteReservation()
  const cancelMutation = useCancelReservation()
  const noShowMutation = useMarkNoShow()
  const confirmMutation = useConfirmReservation()
  const unseatMutation = useUnseatReservation()
  const updateMutation = useUpdateReservation()
  const assignServerMutation = useAssignServerToReservation()
  const sendPaymentLinkMutation = useSendPaymentLink()
  const refundMutation = useRefundReservation()

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('CONFIRM RESERVATION', 'Mark this reservation as confirmed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'CONFIRM',
        onPress: () => {
          confirmMutation.mutate(Number(id), {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            },
            onError: () => Alert.alert('ERROR', 'Failed to confirm reservation'),
          })
        },
      },
    ])
  }

  const handleSeat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('SEAT GUEST', 'Mark this reservation as seated?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'SEAT',
        onPress: () => {
          seatMutation.mutate(Number(id), {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              router.back()
            },
            onError: () => Alert.alert('ERROR', 'Failed to seat reservation'),
          })
        },
      },
    ])
  }

  const handleUnseat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('UNSEAT GUEST', 'Revert this reservation back to confirmed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'UNSEAT',
        onPress: () => {
          unseatMutation.mutate(Number(id), {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            },
            onError: () => Alert.alert('ERROR', 'Failed to unseat reservation'),
          })
        },
      },
    ])
  }

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('COMPLETE', 'Mark this reservation as completed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'COMPLETE',
        onPress: () => {
          completeMutation.mutate(Number(id), {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              router.back()
            },
            onError: () => Alert.alert('ERROR', 'Failed to complete reservation'),
          })
        },
      },
    ])
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert(
      'CANCEL RESERVATION',
      'Are you sure you want to cancel this reservation?',
      [
        { text: 'NO', style: 'cancel' },
        {
          text: 'YES, CANCEL',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(Number(id), {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                router.back()
              },
              onError: () => Alert.alert('ERROR', 'Failed to cancel reservation'),
            })
          },
        },
      ]
    )
  }

  const handleNoShow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert('MARK NO-SHOW', 'Mark this guest as a no-show?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'MARK NO-SHOW',
        style: 'destructive',
        onPress: () => {
          noShowMutation.mutate(Number(id), {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              router.back()
            },
            onError: () => Alert.alert('ERROR', 'Failed to mark no-show'),
          })
        },
      },
    ])
  }

  const handleSaveTables = (tableIds: number[]) => {
    updateMutation.mutate(
      { id: Number(id), tableIds },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update tables'),
      }
    )
  }

  const handleSaveNotes = (notes: string, adminNotes: string) => {
    updateMutation.mutate(
      { id: Number(id), notes: notes || undefined, admin_notes: adminNotes || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update notes'),
      }
    )
  }

  const handleSaveServer = (serverId: number | null) => {
    assignServerMutation.mutate(
      { reservationId: Number(id), serverId },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to assign server'),
      }
    )
  }

  const handleSaveReservationDetails = (values: {
    name: string
    date: string
    time: string
    covers: number
    email: string | null
    phone: string | null
  }) => {
    updateMutation.mutate(
      {
        id: Number(id),
        name: values.name,
        date: values.date,
        time: values.time,
        covers: values.covers,
        email: values.email,
        phone: values.phone,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update reservation'),
      }
    )
  }

  const handleSendPaymentLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'SEND PAYMENT LINK',
      'Send a payment link to the guest\'s email?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'SEND',
          onPress: () => {
            sendPaymentLinkMutation.mutate(Number(id), {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('SUCCESS', 'Payment link sent to guest')
              },
              onError: () => Alert.alert('ERROR', 'Failed to send payment link'),
            })
          },
        },
      ]
    )
  }

  const handleRefund = () => {
    if (!reservation) return

    const amountPaid = reservation.amount_total_cents || 0
    const alreadyRefunded = reservation.refunded_amount_cents || 0
    const refundable = amountPaid - alreadyRefunded

    if (refundable <= 0) {
      Alert.alert('NO REFUND AVAILABLE', 'This reservation has already been fully refunded.')
      return
    }

    const refundAmount = (refundable / 100).toFixed(2)

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert(
      'PROCESS REFUND',
      `Refund $${refundAmount} ${reservation.currency || 'USD'} to the guest?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'REFUND',
          style: 'destructive',
          onPress: () => {
            refundMutation.mutate(
              { id: Number(id), amountCents: refundable },
              {
                onSuccess: (data) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  Alert.alert(
                    'REFUND PROCESSED',
                    `$${(data.refundedAmountCents / 100).toFixed(2)} has been refunded.`
                  )
                },
                onError: () => Alert.alert('ERROR', 'Failed to process refund'),
              }
            )
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !reservation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>ERROR</Text>
            <Text style={styles.errorText}>Failed to load reservation</Text>
            <NeoButton label="GO BACK" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const time = format(new Date(`2000-01-01T${reservation.time}`), 'h:mm a')
  const tables =
    reservation.table_numbers && reservation.table_numbers.length > 0
      ? reservation.table_numbers.join(', ')
      : 'No table assigned'

  const isBooked = reservation.status === 'BOOKED'
  const isConfirmed = reservation.status === 'CONFIRMED'
  const isPending = isBooked || isConfirmed
  const isSeated = reservation.status === 'SEATED'
  const isFinal =
    reservation.status === 'COMPLETED' ||
    reservation.status === 'CANCELLED' ||
    reservation.status === 'NO_SHOW'

  const isMutating =
    seatMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    noShowMutation.isPending ||
    confirmMutation.isPending ||
    unseatMutation.isPending ||
    updateMutation.isPending ||
    assignServerMutation.isPending ||
    sendPaymentLinkMutation.isPending ||
    refundMutation.isPending

  // Event and payment info
  const isEventReservation = !!reservation?.event_id
  const hasPaymentInfo = !!reservation?.payment_status
  const isPendingPayment = reservation?.status === 'PENDING_PAYMENT'
  const canRefund =
    reservation?.payment_status === 'PAID' ||
    reservation?.payment_status === 'PARTIALLY_REFUNDED'

  const statusColor = getStatusColor(reservation.status)
  const isWalkIn = reservation.is_walk_in === true

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {useSplitLayout ? (
        // Tablet landscape: Split pane layout
        <View style={styles.splitContainer}>
          {/* Left pane: Info */}
          <ScrollView style={styles.leftPane} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={[styles.headerCard, { backgroundColor: statusColor }]}>
              <View style={styles.headerContent}>
                <Text style={styles.guestName}>{reservation.name}</Text>
                <View style={styles.headerBadges}>
                  {isWalkIn && <WalkInBadge />}
                  {isEventReservation && reservation.event_name && (
                    <EventBadge name={reservation.event_name} />
                  )}
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{reservation.status}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.card}>
              <View style={styles.detailsHeader}>
                <Text style={styles.cardTitle}>DETAILS</Text>
                {!isFinal && (
                  <Pressable
                    style={styles.editDetailsButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setShowEditModal(true)
                    }}
                  >
                    <Text style={styles.editDetailsButtonText}>EDIT</Text>
                  </Pressable>
                )}
              </View>
              <InfoRow label="TIME" value={time} />
              <InfoRow label="PARTY SIZE" value={`${reservation.covers} guests`} />
              <View style={styles.tableRow}>
                <View style={styles.tableInfo}>
                  <Text style={styles.infoLabel}>TABLE</Text>
                  <Text style={styles.infoValue}>{tables}</Text>
                </View>
                {!isFinal && (
                  <Pressable
                    style={styles.editTableButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setShowTablePicker(true)
                    }}
                  >
                    <Text style={styles.editTableButtonText}>EDIT</Text>
                  </Pressable>
                )}
              </View>
              <InfoRow label="EMAIL" value={reservation.email} />
              <InfoRow label="PHONE" value={reservation.phone} />
              <View style={styles.serverRow}>
                <View style={styles.serverInfo}>
                  <Text style={styles.infoLabel}>SERVER</Text>
                  {reservation.server ? (
                    <View style={styles.serverBadgeDisplay}>
                      <View
                        style={[styles.serverDot, { backgroundColor: reservation.server.color }]}
                      />
                      <Text style={styles.serverNameText}>{reservation.server.name}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noServerText}>Not assigned</Text>
                  )}
                </View>
                {!isFinal && (
                  <Pressable
                    style={styles.editServerButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setShowServerPicker(true)
                    }}
                  >
                    <Text style={styles.editServerButtonText}>
                      {reservation.server ? 'CHANGE' : 'ASSIGN'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.card}>
              <View style={styles.notesHeader}>
                <Text style={styles.cardTitle}>NOTES</Text>
                {!isFinal && (
                  <Pressable
                    style={styles.editNotesButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setShowNotesEditor(true)
                    }}
                  >
                    <Text style={styles.editNotesButtonText}>EDIT</Text>
                  </Pressable>
                )}
              </View>
              {reservation.notes ? (
                <Text style={styles.notesText}>{reservation.notes}</Text>
              ) : (
                <Text style={styles.noNotesText}>No guest notes</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: Neo.yellow }]}>
              <Text style={styles.cardTitle}>ADMIN NOTES</Text>
              {reservation.admin_notes ? (
                <Text style={styles.notesText}>{reservation.admin_notes}</Text>
              ) : (
                <Text style={styles.noNotesText}>No admin notes</Text>
              )}
            </View>

            {/* Payment Section for Event Reservations */}
            {hasPaymentInfo && reservation.payment_status && (
              <View style={[styles.card, { backgroundColor: Neo.white }]}>
                <Text style={styles.cardTitle}>PAYMENT</Text>
                <View style={styles.paymentHeader}>
                  <PaymentStatusBadge status={reservation.payment_status} />
                </View>
                {reservation.amount_total_cents != null && reservation.amount_total_cents > 0 && (
                  <View style={styles.paymentDetails}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>TOTAL</Text>
                      <Text style={styles.paymentValue}>
                        ${(reservation.amount_total_cents / 100).toFixed(2)}{' '}
                        {reservation.currency || 'USD'}
                      </Text>
                    </View>
                    {reservation.refunded_amount_cents != null &&
                      reservation.refunded_amount_cents > 0 && (
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>REFUNDED</Text>
                          <Text style={[styles.paymentValue, { color: Neo.pink }]}>
                            -${(reservation.refunded_amount_cents / 100).toFixed(2)}
                          </Text>
                        </View>
                      )}
                  </View>
                )}
              </View>
            )}

            {/* Guest Profile */}
            {reservation.guest && (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.push(`/guest/${reservation.guest!.id}`)
                }}
                accessibilityLabel={`View profile for ${reservation.guest.name}`}
                accessibilityRole="button"
              >
                <View style={styles.guestProfileHeader}>
                  <Text style={styles.cardTitle}>GUEST PROFILE</Text>
                  <Text style={styles.viewProfileLink}>VIEW →</Text>
                </View>
                <View style={styles.guestProfile}>
                  <View style={styles.guestAvatar}>
                    {reservation.guest.imageUrl ? (
                      <Image
                        source={{ uri: reservation.guest.imageUrl }}
                        style={styles.guestAvatarImage}
                      />
                    ) : (
                      <Text style={styles.guestAvatarText}>
                        {reservation.guest.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.guestDetails}>
                    <Text style={styles.guestProfileName}>{reservation.guest.name}</Text>
                    <Text style={styles.guestProfileStats}>
                      {reservation.guest.visitCount} visits
                      {(reservation.guest.noShowCount ?? reservation.guest.noShows ?? 0) > 0 &&
                        ` · ${reservation.guest.noShowCount ?? reservation.guest.noShows} no-shows`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </ScrollView>

          {/* Right pane: Turn time + Actions */}
          <ScrollView style={styles.rightPane} contentContainerStyle={styles.rightPaneContent}>
            {/* Turn Time for Seated Guests */}
            {isSeated && reservation.seated_at && (
              <TurnTimeDisplay seatedAt={reservation.seated_at} covers={reservation.covers} />
            )}

            {/* Payment Actions for tablet - moved here */}
            {hasPaymentInfo && reservation.payment_status && (
              <View style={styles.paymentActions}>
                {isPendingPayment && (
                  <NeoButton
                    label="SEND PAYMENT LINK"
                    onPress={handleSendPaymentLink}
                    variant="primary"
                    disabled={isMutating}
                    loading={sendPaymentLinkMutation.isPending}
                  />
                )}
                {canRefund && !isFinal && (
                  <NeoButton
                    label="PROCESS REFUND"
                    onPress={handleRefund}
                    variant="destructive"
                    disabled={isMutating}
                    loading={refundMutation.isPending}
                  />
                )}
              </View>
            )}

            {/* Actions */}
            {!isFinal && (
              <View style={styles.actions}>
                {isBooked && (
                  <>
                    <NeoButton
                      label="CONFIRM"
                      onPress={handleConfirm}
                      variant="secondary"
                      disabled={isMutating}
                      loading={confirmMutation.isPending}
                    />
                    <NeoButton
                      label="SEAT GUEST"
                      onPress={handleSeat}
                      variant="primary"
                      disabled={isMutating}
                      loading={seatMutation.isPending}
                    />
                    <NeoButton
                      label="MARK NO-SHOW"
                      onPress={handleNoShow}
                      variant="secondary"
                      disabled={isMutating}
                      loading={noShowMutation.isPending}
                    />
                    <NeoButton
                      label="CANCEL RESERVATION"
                      onPress={handleCancel}
                      variant="destructive"
                      disabled={isMutating}
                      loading={cancelMutation.isPending}
                    />
                  </>
                )}
                {isConfirmed && (
                  <>
                    <NeoButton
                      label="SEAT GUEST"
                      onPress={handleSeat}
                      variant="primary"
                      disabled={isMutating}
                      loading={seatMutation.isPending}
                    />
                    <NeoButton
                      label="MARK NO-SHOW"
                      onPress={handleNoShow}
                      variant="secondary"
                      disabled={isMutating}
                      loading={noShowMutation.isPending}
                    />
                    <NeoButton
                      label="CANCEL RESERVATION"
                      onPress={handleCancel}
                      variant="destructive"
                      disabled={isMutating}
                      loading={cancelMutation.isPending}
                    />
                  </>
                )}
                {isSeated && (
                  <>
                    <NeoButton
                      label="COMPLETE VISIT"
                      onPress={handleComplete}
                      variant="primary"
                      disabled={isMutating}
                      loading={completeMutation.isPending}
                    />
                    <NeoButton
                      label="UNSEAT"
                      onPress={handleUnseat}
                      variant="secondary"
                      disabled={isMutating}
                      loading={unseatMutation.isPending}
                    />
                    <NeoButton
                      label="MARK NO-SHOW"
                      onPress={handleNoShow}
                      variant="secondary"
                      disabled={isMutating}
                      loading={noShowMutation.isPending}
                    />
                    <NeoButton
                      label="CANCEL RESERVATION"
                      onPress={handleCancel}
                      variant="destructive"
                      disabled={isMutating}
                      loading={cancelMutation.isPending}
                    />
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        // Phone: Original stacked layout
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={[styles.headerCard, { backgroundColor: statusColor }]}>
            <View style={styles.headerContent}>
              <Text style={styles.guestName}>{reservation.name}</Text>
              <View style={styles.headerBadges}>
                {isWalkIn && <WalkInBadge />}
                {isEventReservation && reservation.event_name && (
                  <EventBadge name={reservation.event_name} />
                )}
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{reservation.status}</Text>
            </View>
          </View>

          {/* Turn Time for Seated Guests */}
          {isSeated && reservation.seated_at && (
            <TurnTimeDisplay seatedAt={reservation.seated_at} covers={reservation.covers} />
          )}

          {/* Details */}
          <View style={styles.card}>
          <View style={styles.detailsHeader}>
            <Text style={styles.cardTitle}>DETAILS</Text>
            {!isFinal && (
              <Pressable
                style={styles.editDetailsButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowEditModal(true)
                }}
              >
                <Text style={styles.editDetailsButtonText}>EDIT</Text>
              </Pressable>
            )}
          </View>
          <InfoRow label="TIME" value={time} />
          <InfoRow label="PARTY SIZE" value={`${reservation.covers} guests`} />
          <View style={styles.tableRow}>
            <View style={styles.tableInfo}>
              <Text style={styles.infoLabel}>TABLE</Text>
              <Text style={styles.infoValue}>{tables}</Text>
            </View>
            {!isFinal && (
              <Pressable
                style={styles.editTableButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowTablePicker(true)
                }}
              >
                <Text style={styles.editTableButtonText}>EDIT</Text>
              </Pressable>
            )}
          </View>
          <InfoRow label="EMAIL" value={reservation.email} />
          <InfoRow label="PHONE" value={reservation.phone} />
          <View style={styles.serverRow}>
            <View style={styles.serverInfo}>
              <Text style={styles.infoLabel}>SERVER</Text>
              {reservation.server ? (
                <View style={styles.serverBadgeDisplay}>
                  <View
                    style={[styles.serverDot, { backgroundColor: reservation.server.color }]}
                  />
                  <Text style={styles.serverNameText}>{reservation.server.name}</Text>
                </View>
              ) : (
                <Text style={styles.noServerText}>Not assigned</Text>
              )}
            </View>
            {!isFinal && (
              <Pressable
                style={styles.editServerButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowServerPicker(true)
                }}
              >
                <Text style={styles.editServerButtonText}>
                  {reservation.server ? 'CHANGE' : 'ASSIGN'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <View style={styles.notesHeader}>
            <Text style={styles.cardTitle}>NOTES</Text>
            {!isFinal && (
              <Pressable
                style={styles.editNotesButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowNotesEditor(true)
                }}
              >
                <Text style={styles.editNotesButtonText}>EDIT</Text>
              </Pressable>
            )}
          </View>
          {reservation.notes ? (
            <Text style={styles.notesText}>{reservation.notes}</Text>
          ) : (
            <Text style={styles.noNotesText}>No guest notes</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: Neo.yellow }]}>
          <Text style={styles.cardTitle}>ADMIN NOTES</Text>
          {reservation.admin_notes ? (
            <Text style={styles.notesText}>{reservation.admin_notes}</Text>
          ) : (
            <Text style={styles.noNotesText}>No admin notes</Text>
          )}
        </View>

        {/* Payment Section for Event Reservations */}
        {hasPaymentInfo && reservation.payment_status && (
          <View style={[styles.card, { backgroundColor: Neo.white }]}>
            <Text style={styles.cardTitle}>PAYMENT</Text>
            <View style={styles.paymentHeader}>
              <PaymentStatusBadge status={reservation.payment_status} />
            </View>
            {reservation.amount_total_cents != null && reservation.amount_total_cents > 0 && (
              <View style={styles.paymentDetails}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>TOTAL</Text>
                  <Text style={styles.paymentValue}>
                    ${(reservation.amount_total_cents / 100).toFixed(2)}{' '}
                    {reservation.currency || 'USD'}
                  </Text>
                </View>
                {reservation.refunded_amount_cents != null &&
                  reservation.refunded_amount_cents > 0 && (
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>REFUNDED</Text>
                      <Text style={[styles.paymentValue, { color: Neo.pink }]}>
                        -${(reservation.refunded_amount_cents / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}
              </View>
            )}
            {/* Payment Actions */}
            <View style={styles.paymentActions}>
              {isPendingPayment && (
                <NeoButton
                  label="SEND PAYMENT LINK"
                  onPress={handleSendPaymentLink}
                  variant="primary"
                  disabled={isMutating}
                  loading={sendPaymentLinkMutation.isPending}
                />
              )}
              {canRefund && !isFinal && (
                <NeoButton
                  label="PROCESS REFUND"
                  onPress={handleRefund}
                  variant="destructive"
                  disabled={isMutating}
                  loading={refundMutation.isPending}
                />
              )}
            </View>
          </View>
        )}

        {/* Guest Profile */}
        {reservation.guest && (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push(`/guest/${reservation.guest!.id}`)
            }}
            accessibilityLabel={`View profile for ${reservation.guest.name}`}
            accessibilityRole="button"
          >
            <View style={styles.guestProfileHeader}>
              <Text style={styles.cardTitle}>GUEST PROFILE</Text>
              <Text style={styles.viewProfileLink}>VIEW →</Text>
            </View>
            <View style={styles.guestProfile}>
              <View style={styles.guestAvatar}>
                {reservation.guest.imageUrl ? (
                  <Image
                    source={{ uri: reservation.guest.imageUrl }}
                    style={styles.guestAvatarImage}
                  />
                ) : (
                  <Text style={styles.guestAvatarText}>
                    {reservation.guest.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </Text>
                )}
              </View>
              <View style={styles.guestDetails}>
                <Text style={styles.guestProfileName}>{reservation.guest.name}</Text>
                <Text style={styles.guestProfileStats}>
                  {reservation.guest.visitCount} visits
                  {(reservation.guest.noShowCount ?? reservation.guest.noShows ?? 0) > 0 &&
                    ` · ${reservation.guest.noShowCount ?? reservation.guest.noShows} no-shows`}
                </Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Actions */}
        {!isFinal && (
          <View style={styles.actions}>
            {isBooked && (
              <>
                <NeoButton
                  label="CONFIRM"
                  onPress={handleConfirm}
                  variant="secondary"
                  disabled={isMutating}
                  loading={confirmMutation.isPending}
                />
                <NeoButton
                  label="SEAT GUEST"
                  onPress={handleSeat}
                  variant="primary"
                  disabled={isMutating}
                  loading={seatMutation.isPending}
                />
                <NeoButton
                  label="MARK NO-SHOW"
                  onPress={handleNoShow}
                  variant="secondary"
                  disabled={isMutating}
                  loading={noShowMutation.isPending}
                />
                <NeoButton
                  label="CANCEL RESERVATION"
                  onPress={handleCancel}
                  variant="destructive"
                  disabled={isMutating}
                  loading={cancelMutation.isPending}
                />
              </>
            )}
            {isConfirmed && (
              <>
                <NeoButton
                  label="SEAT GUEST"
                  onPress={handleSeat}
                  variant="primary"
                  disabled={isMutating}
                  loading={seatMutation.isPending}
                />
                <NeoButton
                  label="MARK NO-SHOW"
                  onPress={handleNoShow}
                  variant="secondary"
                  disabled={isMutating}
                  loading={noShowMutation.isPending}
                />
                <NeoButton
                  label="CANCEL RESERVATION"
                  onPress={handleCancel}
                  variant="destructive"
                  disabled={isMutating}
                  loading={cancelMutation.isPending}
                />
              </>
            )}
            {isSeated && (
              <>
                <NeoButton
                  label="COMPLETE VISIT"
                  onPress={handleComplete}
                  variant="primary"
                  disabled={isMutating}
                  loading={completeMutation.isPending}
                />
                <NeoButton
                  label="UNSEAT"
                  onPress={handleUnseat}
                  variant="secondary"
                  disabled={isMutating}
                  loading={unseatMutation.isPending}
                />
                <NeoButton
                  label="MARK NO-SHOW"
                  onPress={handleNoShow}
                  variant="secondary"
                  disabled={isMutating}
                  loading={noShowMutation.isPending}
                />
                <NeoButton
                  label="CANCEL RESERVATION"
                  onPress={handleCancel}
                  variant="destructive"
                  disabled={isMutating}
                  loading={cancelMutation.isPending}
                />
              </>
            )}
          </View>
        )}
        </ScrollView>
      )}

      {/* Table Picker Modal */}
      <TablePickerModal
        visible={showTablePicker}
        selectedTableIds={reservation?.table_ids || []}
        date={reservation?.date || ''}
        time={reservation?.time || ''}
        partySize={reservation?.covers || 1}
        onSave={handleSaveTables}
        onClose={() => setShowTablePicker(false)}
      />

      {/* Notes Edit Modal */}
      <NotesEditModal
        visible={showNotesEditor}
        initialNotes={reservation?.notes || ''}
        initialAdminNotes={reservation?.admin_notes || ''}
        onSave={handleSaveNotes}
        onClose={() => setShowNotesEditor(false)}
      />

      {/* Server Picker Modal */}
      <ServerPickerModal
        visible={showServerPicker}
        currentServerId={reservation?.server?.id || null}
        onSelect={handleSaveServer}
        onClose={() => setShowServerPicker(false)}
      />

      {/* Reservation Edit Modal */}
      {reservation && (
        <ReservationEditModal
          visible={showEditModal}
          initialValues={{
            name: reservation.name,
            date: reservation.date || '',
            time: reservation.time,
            covers: reservation.covers,
            email: reservation.email ?? null,
            phone: reservation.phone ?? null,
          }}
          onSave={handleSaveReservationDetails}
          onClose={() => setShowEditModal(false)}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  // Tablet split layout
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    width: '60%',
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
  },
  rightPane: {
    width: '40%',
    backgroundColor: Neo.cream,
  },
  rightPaneContent: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerCard: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...NeoShadow.lg,
  },
  headerContent: {
    flex: 1,
    gap: 8,
  },
  guestName: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  walkInBadge: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walkInBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventBadge: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paymentStatusBadge: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  paymentStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeContainer: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...NeoShadow.default,
  },
  turnTimeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeExpected: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  statusBadge: {
    backgroundColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  cardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editDetailsButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editDetailsButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  tableInfo: {
    flex: 1,
  },
  editTableButton: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editTableButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  serverInfo: {
    flex: 1,
  },
  serverBadgeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  serverDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  serverNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  noServerText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.4,
    fontStyle: 'italic',
    marginTop: 4,
  },
  editServerButton: {
    backgroundColor: Neo.blue,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editServerButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editNotesButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editNotesButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notesText: {
    fontSize: 14,
    color: Neo.black,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noNotesText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.4,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  guestProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewProfileLink: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  guestProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestAvatar: {
    width: 48,
    height: 48,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  guestAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  guestAvatarImage: {
    width: '100%',
    height: '100%',
  },
  guestDetails: {
    flex: 1,
  },
  guestProfileName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  guestProfileStats: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.7,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...NeoShadow.sm,
  },
  actionButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  errorCard: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    alignItems: 'center',
    gap: 16,
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
  paymentHeader: {
    marginBottom: 12,
  },
  paymentDetails: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black,
    paddingTop: 12,
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.7,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paymentActions: {
    gap: 12,
    marginTop: 8,
  },
})
