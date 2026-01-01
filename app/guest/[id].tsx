import { format, parseISO } from 'date-fns'
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
import { useGuest } from '@/lib/api/queries'
import { useUpdateGuest, useAddGuestTag, useRemoveGuestTag } from '@/lib/api/mutations'
import { GuestNotesEditModal } from '@/components/guest/GuestNotesEditModal'
import { GuestEditModal } from '@/components/guest/GuestEditModal'
import { GuestTagsEditModal } from '@/components/guest/GuestTagsEditModal'
import type { GuestReservation, ReservationStatus } from '@/lib/types'

function StatusBadge({ status }: { status: ReservationStatus }) {
  const bgColor = getStatusColor(status)
  const isLight = [Neo.lime, Neo.cyan, Neo.yellow].includes(bgColor)

  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusBadgeText, { color: isLight ? Neo.black : Neo.white }]}>
        {status.replace('_', ' ')}
      </Text>
    </View>
  )
}

function ReservationRow({
  reservation,
  onPress,
}: {
  reservation: GuestReservation
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)

  // Parse the full datetime or handle walk-ins
  let dateStr = ''
  let timeStr = ''

  if (reservation.reservationTime) {
    try {
      const dt = parseISO(reservation.reservationTime)
      dateStr = format(dt, 'MMM d')
      timeStr = format(dt, 'h:mm a')
    } catch {
      dateStr = '—'
      timeStr = reservation.isWalkIn ? 'Walk-in' : '—'
    }
  } else {
    dateStr = '—'
    timeStr = reservation.isWalkIn ? 'Walk-in' : '—'
  }

  return (
    <Pressable
      style={[styles.reservationRow, pressed && styles.reservationRowPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`Reservation on ${dateStr} at ${timeStr}, ${reservation.covers} guests, ${reservation.status}`}
      accessibilityRole="button"
    >
      {/* Date & Time */}
      <View style={styles.reservationDateTime}>
        <Text style={styles.reservationDate}>{dateStr}</Text>
        <Text style={styles.reservationTime}>{timeStr}</Text>
      </View>

      {/* Status */}
      <StatusBadge status={reservation.status} />

      {/* Party Size */}
      <View style={styles.partySizeBox}>
        <Text style={styles.partySizeNumber}>{reservation.covers}</Text>
      </View>

      {/* Tables (if any) */}
      {reservation.tableNumbers.length > 0 && (
        <View style={styles.tablesBadge}>
          <Text style={styles.tablesText}>{reservation.tableNumbers.join(', ')}</Text>
        </View>
      )}
    </Pressable>
  )
}

export default function GuestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [showNotesEditor, setShowNotesEditor] = useState(false)
  const [showGuestEditor, setShowGuestEditor] = useState(false)
  const [showTagsEditor, setShowTagsEditor] = useState(false)

  const { data, isLoading, error } = useGuest(Number(id))
  const updateMutation = useUpdateGuest()
  const addTagMutation = useAddGuestTag()
  const removeTagMutation = useRemoveGuestTag()

  const handleSaveNotes = (notes: string) => {
    updateMutation.mutate(
      { id: Number(id), notes: notes || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update notes'),
      }
    )
  }

  const handleSaveGuestInfo = (name: string, phone: string) => {
    updateMutation.mutate(
      { id: Number(id), name, phone: phone || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to update guest'),
      }
    )
  }

  const handleAddTag = (tagOptionId: number) => {
    addTagMutation.mutate(
      { guestId: Number(id), tagOptionId },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to add tag'),
      }
    )
  }

  const handleRemoveTag = (tagOptionId: number) => {
    removeTagMutation.mutate(
      { guestId: Number(id), tagOptionId },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: () => Alert.alert('ERROR', 'Failed to remove tag'),
      }
    )
  }

  const handleReservationPress = (reservation: GuestReservation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/reservation/${reservation.id}`)
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

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>ERROR</Text>
            <Text style={styles.errorText}>Failed to load guest</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>GO BACK</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const { guest, reservations, stats } = data

  const initials = guest.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const hasWarning = stats.noShows > 0

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={[styles.avatar, hasWarning && styles.avatarWarning]}>
            {guest.imageUrl ? (
              <Image source={{ uri: guest.imageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.guestName}>{guest.name}</Text>
            <Text style={styles.guestEmail}>{guest.email}</Text>
            {guest.phone && <Text style={styles.guestPhone}>{guest.phone}</Text>}
          </View>
          <Pressable
            style={styles.headerEditButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setShowGuestEditor(true)
            }}
            accessibilityLabel="Edit guest info"
            accessibilityRole="button"
          >
            <Text style={styles.headerEditButtonText}>EDIT</Text>
          </Pressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Neo.cyan }]}>
            <Text style={styles.statValue}>{stats.totalVisits}</Text>
            <Text style={styles.statLabel}>VISITS</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Neo.lime }]}>
            <Text style={styles.statValue}>{stats.totalCovers}</Text>
            <Text style={styles.statLabel}>COVERS</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: stats.noShows > 0 ? Neo.pink : Neo.white },
            ]}
          >
            <Text style={styles.statValue}>{stats.noShows}</Text>
            <Text style={styles.statLabel}>NO-SHOWS</Text>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.card}>
          <View style={styles.tagsHeader}>
            <Text style={styles.cardTitle}>TAGS</Text>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setShowTagsEditor(true)
              }}
              accessibilityLabel="Edit tags"
              accessibilityRole="button"
            >
              <Text style={styles.editButtonText}>EDIT</Text>
            </Pressable>
          </View>
          {guest.tags && guest.tags.length > 0 ? (
            <View style={styles.tagsContainer}>
              {guest.tags.map((tag) => (
                <View
                  key={tag.id}
                  style={[styles.tagBadge, { backgroundColor: tag.color || Neo.purple }]}
                >
                  {tag.icon && <Text style={styles.tagIcon}>{tag.icon}</Text>}
                  <Text
                    style={[
                      styles.tagLabel,
                      {
                        color: [Neo.lime, Neo.cyan, Neo.yellow].includes(tag.color)
                          ? Neo.black
                          : Neo.white,
                      },
                    ]}
                  >
                    {tag.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noNotesText}>No tags</Text>
          )}
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <View style={styles.notesHeader}>
            <Text style={styles.cardTitle}>NOTES</Text>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setShowNotesEditor(true)
              }}
              accessibilityLabel="Edit notes"
              accessibilityRole="button"
            >
              <Text style={styles.editButtonText}>EDIT</Text>
            </Pressable>
          </View>
          {guest.notes ? (
            <Text style={styles.notesText}>{guest.notes}</Text>
          ) : (
            <Text style={styles.noNotesText}>No notes</Text>
          )}
        </View>

        {/* Reservation History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RESERVATION HISTORY</Text>
          {reservations.length === 0 ? (
            <Text style={styles.noNotesText}>No reservations yet</Text>
          ) : (
            <View style={styles.reservationsList}>
              {reservations.map((reservation) => (
                <ReservationRow
                  key={reservation.uuid}
                  reservation={reservation}
                  onPress={() => handleReservationPress(reservation)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Notes Edit Modal */}
      <GuestNotesEditModal
        visible={showNotesEditor}
        initialNotes={guest.notes || ''}
        onSave={handleSaveNotes}
        onClose={() => setShowNotesEditor(false)}
      />

      {/* Guest Edit Modal */}
      <GuestEditModal
        visible={showGuestEditor}
        initialName={guest.name}
        initialPhone={guest.phone || ''}
        onSave={handleSaveGuestInfo}
        onClose={() => setShowGuestEditor(false)}
      />

      {/* Tags Edit Modal */}
      <GuestTagsEditModal
        visible={showTagsEditor}
        currentTags={guest.tags || []}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onClose={() => setShowTagsEditor(false)}
      />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerCard: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...NeoShadow.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarWarning: {
    backgroundColor: Neo.orange,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerEditButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  headerEditButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 22,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  guestEmail: {
    fontSize: 12,
    color: Neo.black,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  guestPhone: {
    fontSize: 12,
    color: Neo.black,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
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
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  tagIcon: {
    fontSize: 12,
  },
  tagLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
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
  reservationsList: {
    gap: 8,
  },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    gap: 10,
    ...NeoShadow.sm,
  },
  reservationRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  reservationDateTime: {
    minWidth: 60,
  },
  reservationDate: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reservationTime: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  partySizeBox: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partySizeNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tablesBadge: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  tablesText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
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
  backButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...NeoShadow.sm,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
