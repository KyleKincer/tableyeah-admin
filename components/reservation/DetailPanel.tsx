import { format, differenceInMinutes } from 'date-fns'
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
} from '@/lib/api/mutations'
import { TablePickerModal } from '@/components/reservation/TablePicker'
import { NotesEditModal } from '@/components/reservation/NotesEditModal'
import { ServerPickerModal } from '@/components/server/ServerPicker'

interface DetailPanelProps {
  reservationId: number | null
  onActionComplete?: () => void
}

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

function TurnTimeDisplay({ seatedAt, covers }: { seatedAt: string; covers: number }) {
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

export function DetailPanel({ reservationId, onActionComplete }: DetailPanelProps) {
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showNotesEditor, setShowNotesEditor] = useState(false)
  const [showServerPicker, setShowServerPicker] = useState(false)

  const { data: reservation, isLoading, error } = useReservation(reservationId || 0)
  const seatMutation = useSeatReservation()
  const completeMutation = useCompleteReservation()
  const cancelMutation = useCancelReservation()
  const noShowMutation = useMarkNoShow()
  const confirmMutation = useConfirmReservation()
  const unseatMutation = useUnseatReservation()
  const updateMutation = useUpdateReservation()
  const assignServerMutation = useAssignServerToReservation()

  const handleConfirm = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('CONFIRM RESERVATION', 'Mark this reservation as confirmed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'CONFIRM',
        onPress: () => {
          confirmMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to confirm reservation'),
          })
        },
      },
    ])
  }

  const handleSeat = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('SEAT GUEST', 'Mark this reservation as seated?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'SEAT',
        onPress: () => {
          seatMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to seat reservation'),
          })
        },
      },
    ])
  }

  const handleUnseat = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('UNSEAT GUEST', 'Revert this reservation back to confirmed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'UNSEAT',
        onPress: () => {
          unseatMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to unseat reservation'),
          })
        },
      },
    ])
  }

  const handleComplete = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('COMPLETE', 'Mark this reservation as completed?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'COMPLETE',
        onPress: () => {
          completeMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to complete reservation'),
          })
        },
      },
    ])
  }

  const handleCancel = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert('CANCEL RESERVATION', 'Are you sure you want to cancel this reservation?', [
      { text: 'NO', style: 'cancel' },
      {
        text: 'YES, CANCEL',
        style: 'destructive',
        onPress: () => {
          cancelMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to cancel reservation'),
          })
        },
      },
    ])
  }

  const handleNoShow = () => {
    if (!reservationId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Alert.alert('MARK NO-SHOW', 'Mark this guest as a no-show?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'MARK NO-SHOW',
        style: 'destructive',
        onPress: () => {
          noShowMutation.mutate(reservationId, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              onActionComplete?.()
            },
            onError: () => Alert.alert('ERROR', 'Failed to mark no-show'),
          })
        },
      },
    ])
  }

  const handleSaveTables = (tableIds: number[]) => {
    if (!reservationId) return
    updateMutation.mutate(
      { id: reservationId, tableIds },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update tables'),
      }
    )
  }

  const handleSaveNotes = (notes: string, adminNotes: string) => {
    if (!reservationId) return
    updateMutation.mutate(
      { id: reservationId, notes: notes || undefined, admin_notes: adminNotes || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update notes'),
      }
    )
  }

  const handleSaveServer = (serverId: number | null) => {
    if (!reservationId) return
    assignServerMutation.mutate(
      { reservationId, serverId },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to assign server'),
      }
    )
  }

  // Empty state
  if (!reservationId) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyTitle}>SELECT A RESERVATION</Text>
        <Text style={styles.emptySubtext}>Tap a reservation to view details</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Neo.black} />
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    )
  }

  if (error || !reservation) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>ERROR</Text>
        <Text style={styles.errorText}>Failed to load reservation</Text>
      </View>
    )
  }

  const time = format(new Date(`2000-01-01T${reservation.time}`), 'h:mm a')
  const tables =
    reservation.table_numbers && reservation.table_numbers.length > 0
      ? reservation.table_numbers.join(', ')
      : 'No table assigned'

  const isBooked = reservation.status === 'BOOKED'
  const isConfirmed = reservation.status === 'CONFIRMED'
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
    assignServerMutation.isPending

  const statusColor = getStatusColor(reservation.status)
  const isWalkIn = reservation.is_walk_in === true

  return (
    <View style={styles.panel}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: statusColor }]}>
          <View style={styles.headerContent}>
            <Text style={styles.guestName}>{reservation.name}</Text>
            {isWalkIn && <WalkInBadge />}
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

        {/* Guest Profile */}
        {reservation.guest && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>GUEST PROFILE</Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  emptyPanel: {
    flex: 1,
    backgroundColor: Neo.cream,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Neo.cream,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 16,
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
    marginTop: 8,
  },
  headerCard: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...NeoShadow.default,
  },
  headerContent: {
    flex: 1,
    gap: 6,
  },
  guestName: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  walkInBadge: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  walkInBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeContainer: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...NeoShadow.sm,
  },
  turnTimeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  turnTimeExpected: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  statusBadge: {
    backgroundColor: Neo.black,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 10,
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
    padding: 14,
    ...NeoShadow.sm,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Neo.black,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editTableButtonText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editNotesButtonText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notesText: {
    fontSize: 13,
    color: Neo.black,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noNotesText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.4,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  guestProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestAvatar: {
    width: 40,
    height: 40,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  guestAvatarText: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
  },
  guestProfileStats: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 3,
    opacity: 0.7,
  },
  serverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
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
    fontSize: 13,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editServerButtonText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 14,
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
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
