import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { differenceInMinutes, parseISO, format } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { WaitlistEntry, TableWithStatus } from '@/lib/types'

interface SeatWaitlistSheetProps {
  visible: boolean
  entry: WaitlistEntry | null
  tables: TableWithStatus[]
  onClose: () => void
  onSeat: (tableId: number) => void
  isLoading?: boolean
}

export function SeatWaitlistSheet({
  visible,
  entry,
  tables,
  onClose,
  onSeat,
  isLoading = false,
}: SeatWaitlistSheetProps) {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)

  if (!entry) return null

  const waitTime = differenceInMinutes(new Date(), parseISO(entry.created_at))
  const timeDisplay = entry.time ? format(new Date(`2000-01-01T${entry.time}`), 'h:mm a') : 'Any time'

  // Filter to only available tables that can fit the party
  const availableTables = tables.filter(
    (t) => t.status === 'available' && t.max_capacity >= entry.covers
  )

  const handleTablePress = (tableId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTableId(tableId)
  }

  const handleSeat = () => {
    if (selectedTableId === null) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onSeat(selectedTableId)
    setSelectedTableId(null)
  }

  const handleClose = () => {
    setSelectedTableId(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>SEAT FROM WAITLIST</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {/* Guest info */}
          <View style={styles.guestInfo}>
            <View style={styles.guestHeader}>
              <Text style={styles.guestName}>{entry.name}</Text>
              <View style={styles.waitTimeBadge}>
                <Text style={styles.waitTimeText}>
                  {waitTime < 60 ? `${waitTime}m` : `${Math.floor(waitTime / 60)}h ${waitTime % 60}m`} WAIT
                </Text>
              </View>
            </View>
            <View style={styles.guestDetails}>
              <View style={styles.detailBadge}>
                <Text style={styles.detailText}>{entry.covers} GUESTS</Text>
              </View>
              <View style={styles.detailBadge}>
                <Text style={styles.detailText}>{timeDisplay.toUpperCase()}</Text>
              </View>
            </View>
            {entry.notes && (
              <Text style={styles.notes} numberOfLines={2}>
                {entry.notes}
              </Text>
            )}
          </View>

          {/* Table selection */}
          <Text style={styles.label}>SELECT TABLE</Text>

          {availableTables.length === 0 ? (
            <View style={styles.noTables}>
              <Text style={styles.noTablesText}>
                No available tables for party of {entry.covers}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableGrid}
            >
              {availableTables.map((table) => (
                <Pressable
                  key={table.id}
                  style={[
                    styles.tableButton,
                    selectedTableId === table.id && styles.tableButtonSelected,
                  ]}
                  onPress={() => handleTablePress(table.id)}
                >
                  <Text
                    style={[
                      styles.tableNumber,
                      selectedTableId === table.id && styles.tableNumberSelected,
                    ]}
                  >
                    {table.table_number}
                  </Text>
                  <Text
                    style={[
                      styles.tableCapacity,
                      selectedTableId === table.id && styles.tableCapacitySelected,
                    ]}
                  >
                    {table.min_capacity === table.max_capacity
                      ? `${table.max_capacity}`
                      : `${table.min_capacity}-${table.max_capacity}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Seat button */}
          <Pressable
            style={[
              styles.seatButton,
              selectedTableId === null && styles.seatButtonDisabled,
              isLoading && styles.seatButtonLoading,
            ]}
            onPress={handleSeat}
            disabled={selectedTableId === null || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Neo.black} />
            ) : (
              <Text style={styles.seatButtonText}>
                {selectedTableId !== null
                  ? `SEAT AT TABLE ${availableTables.find((t) => t.id === selectedTableId)?.table_number}`
                  : 'SELECT A TABLE'}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    marginTop: -2,
  },
  guestInfo: {
    backgroundColor: Neo.purple + '15',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    marginBottom: 20,
  },
  guestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  waitTimeBadge: {
    backgroundColor: Neo.purple,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitTimeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  guestDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBadge: {
    backgroundColor: Neo.white,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  notes: {
    fontSize: 11,
    color: Neo.black,
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.6,
  },
  tableGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
    marginBottom: 16,
  },
  tableButton: {
    width: 70,
    height: 70,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  tableButtonSelected: {
    backgroundColor: Neo.lime,
    ...NeoShadow.default,
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  tableNumberSelected: {
    color: Neo.black,
  },
  tableCapacity: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    marginTop: 2,
  },
  tableCapacitySelected: {
    opacity: 1,
  },
  noTables: {
    backgroundColor: Neo.pink + '20',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  noTablesText: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  seatButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  seatButtonDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  seatButtonLoading: {
    backgroundColor: Neo.yellow,
  },
  seatButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
