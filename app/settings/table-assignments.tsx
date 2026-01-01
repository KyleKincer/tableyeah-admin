import { format, addDays, subDays, isToday } from 'date-fns'
import { useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Modal,
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

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useTables, useServers, useServerAssignments } from '@/lib/api/queries'
import { useSetServerAssignments } from '@/lib/api/mutations'
import { DatePicker } from '@/components/ui/DatePicker'
import type { TableInfo, Server } from '@/lib/types'

// How many servers to show inline before showing "+X more"
const MAX_INLINE_SERVERS = 4

function DateSelector({
  date,
  onDateChange,
  onOpenPicker,
}: {
  date: Date
  onDateChange: (date: Date) => void
  onOpenPicker: () => void
}) {
  const dateLabel = isToday(date) ? 'TODAY' : format(date, 'EEE, MMM d').toUpperCase()
  const [prevPressed, setPrevPressed] = useState(false)
  const [nextPressed, setNextPressed] = useState(false)
  const [datePressed, setDatePressed] = useState(false)

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDateChange(subDays(date, 1))
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDateChange(addDays(date, 1))
  }

  const handleOpenPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onOpenPicker()
  }

  return (
    <View style={styles.dateSelector}>
      <Pressable
        style={[styles.dateButton, prevPressed && styles.dateButtonPressed]}
        onPress={handlePrev}
        onPressIn={() => setPrevPressed(true)}
        onPressOut={() => setPrevPressed(false)}
        accessibilityLabel="Previous day"
        accessibilityRole="button"
      >
        <Text style={styles.dateButtonText}>{'<'}</Text>
      </Pressable>
      <Pressable
        style={[styles.dateDisplay, datePressed && styles.dateDisplayPressed]}
        onPress={handleOpenPicker}
        onPressIn={() => setDatePressed(true)}
        onPressOut={() => setDatePressed(false)}
        accessibilityLabel={`Selected date: ${format(date, 'EEEE, MMMM d, yyyy')}. Tap to open calendar`}
        accessibilityRole="button"
      >
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.dateHint}>TAP TO PICK</Text>
      </Pressable>
      <Pressable
        style={[styles.dateButton, nextPressed && styles.dateButtonPressed]}
        onPress={handleNext}
        onPressIn={() => setNextPressed(true)}
        onPressOut={() => setNextPressed(false)}
        accessibilityLabel="Next day"
        accessibilityRole="button"
      >
        <Text style={styles.dateButtonText}>{'>'}</Text>
      </Pressable>
    </View>
  )
}

interface ServerBadgeSelectableProps {
  server: Server
  isSelected: boolean
  onPress: () => void
  compact?: boolean
}

function ServerBadgeSelectable({ server, isSelected, onPress, compact }: ServerBadgeSelectableProps) {
  const textColor = getContrastText(server.color)

  return (
    <Pressable
      style={[
        styles.serverBadge,
        compact && styles.serverBadgeCompact,
        { backgroundColor: server.color },
        isSelected && styles.serverBadgeSelected,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      accessibilityLabel={`${server.name}${isSelected ? ', selected' : ''}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.serverBadgeText, compact && styles.serverBadgeTextCompact, { color: textColor }]}>
        {server.name}
      </Text>
      {isSelected && <Text style={[styles.serverBadgeCheck, { color: textColor }]}>*</Text>}
    </Pressable>
  )
}

interface ServerPickerModalProps {
  visible: boolean
  servers: Server[]
  selectedServerId: number | null
  onSelect: (serverId: number) => void
  onClose: () => void
}

function ServerPickerModal({ visible, servers, selectedServerId, onSelect, onClose }: ServerPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderText}>SELECT SERVER</Text>
          </View>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent}>
            {servers.map((server) => {
              const isSelected = selectedServerId === server.id
              const textColor = getContrastText(server.color)
              return (
                <Pressable
                  key={server.id}
                  style={[
                    styles.modalServerRow,
                    isSelected && styles.modalServerRowSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSelect(server.id)
                    onClose()
                  }}
                >
                  <View style={[styles.modalServerBadge, { backgroundColor: server.color }]}>
                    <Text style={[styles.modalServerInitials, { color: textColor }]}>
                      {server.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.modalServerName}>{server.name}</Text>
                  {isSelected && <Text style={styles.modalCheckmark}>*</Text>}
                </Pressable>
              )
            })}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>CANCEL</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

interface TableCardProps {
  table: TableInfo
  assignedServer: { serverId: number; serverName: string; serverColor: string } | null
  isAssigning: boolean
  onPress: () => void
}

function TableCard({ table, assignedServer, isAssigning, onPress }: TableCardProps) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.tableCard,
        assignedServer && { borderColor: assignedServer.serverColor },
        pressed && styles.tableCardPressed,
        isAssigning && styles.tableCardAssigning,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`Table ${table.table_number}, ${assignedServer ? `assigned to ${assignedServer.serverName}` : 'no server assigned'}`}
      accessibilityRole="button"
    >
      <Text style={styles.tableNumber}>{table.table_number}</Text>
      <Text style={styles.tableCapacity}>{table.min_capacity}-{table.max_capacity}</Text>
      {assignedServer ? (
        <View style={[styles.tableServerBadge, { backgroundColor: assignedServer.serverColor }]}>
          <Text style={[styles.tableServerName, { color: getContrastText(assignedServer.serverColor) }]}>
            {assignedServer.serverName.substring(0, 3).toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={styles.tableNoServer}>
          <Text style={styles.tableNoServerText}>—</Text>
        </View>
      )}
    </Pressable>
  )
}

export default function TableAssignmentsScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)
  const [showServerPicker, setShowServerPicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const dateString = format(selectedDate, 'yyyy-MM-dd')

  const { data: tablesData, isLoading: tablesLoading, refetch: refetchTables } = useTables()
  const { data: serversData, isLoading: serversLoading, refetch: refetchServers } = useServers()
  const { data: assignmentsData, isLoading: assignmentsLoading, refetch: refetchAssignments } = useServerAssignments(dateString)
  const setAssignments = useSetServerAssignments()

  const tables = tablesData?.tables || []
  const servers = (serversData?.servers || []).filter((s) => s.active)
  const assignmentsByTable = assignmentsData?.assignmentsByTable || {}

  // Split servers into inline and overflow
  const inlineServers = servers.slice(0, MAX_INLINE_SERVERS)
  const overflowCount = Math.max(0, servers.length - MAX_INLINE_SERVERS)
  const hasOverflow = overflowCount > 0

  // Check if selected server is in overflow
  const selectedServerInOverflow = selectedServerId !== null &&
    !inlineServers.some((s) => s.id === selectedServerId)
  const selectedServer = servers.find((s) => s.id === selectedServerId)

  // Group tables by zone
  const tablesByZone = useMemo(() => {
    const grouped: Record<string, { zoneName: string; zoneColor: string; tables: TableInfo[] }> = {}
    for (const table of tables) {
      if (!grouped[table.zone_key]) {
        grouped[table.zone_key] = {
          zoneName: table.zone_display_name,
          zoneColor: table.zone_color,
          tables: [],
        }
      }
      grouped[table.zone_key].tables.push(table)
    }
    for (const zone of Object.values(grouped)) {
      zone.tables.sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }))
    }
    return grouped
  }, [tables])

  const isLoading = tablesLoading || serversLoading || assignmentsLoading

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchTables(), refetchServers(), refetchAssignments()])
    setRefreshing(false)
  }

  const handleServerPress = (serverId: number) => {
    if (selectedServerId === serverId) {
      setSelectedServerId(null)
    } else {
      setSelectedServerId(serverId)
    }
  }

  const handleTablePress = (tableId: number) => {
    if (!selectedServerId) return

    const currentAssignment = assignmentsByTable[tableId]
    let newServerId: number | null

    if (currentAssignment?.serverId === selectedServerId) {
      newServerId = null
    } else {
      newServerId = selectedServerId
    }

    // Light haptic - optimistic update makes it feel instant
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    setAssignments.mutate({
      date: dateString,
      assignments: [{ tableId, serverId: newServerId }],
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <DateSelector
          date={selectedDate}
          onDateChange={setSelectedDate}
          onOpenPicker={() => setShowDatePicker(true)}
        />

        {/* Server selection bar */}
        <View style={styles.serverBarContainer}>
          <Text style={styles.serverBarLabel}>
            {selectedServerId ? 'TAP TABLES TO ASSIGN:' : 'SELECT A SERVER:'}
          </Text>
          <View style={styles.serverBar}>
            {servers.length === 0 ? (
              <Text style={styles.noServersText}>No active servers</Text>
            ) : (
              <>
                {/* Show selected server from overflow first if applicable */}
                {selectedServerInOverflow && selectedServer && (
                  <ServerBadgeSelectable
                    server={selectedServer}
                    isSelected={true}
                    onPress={() => handleServerPress(selectedServer.id)}
                    compact
                  />
                )}
                {/* Inline servers */}
                {inlineServers.map((server) => (
                  <ServerBadgeSelectable
                    key={server.id}
                    server={server}
                    isSelected={selectedServerId === server.id}
                    onPress={() => handleServerPress(server.id)}
                    compact
                  />
                ))}
                {/* More button */}
                {hasOverflow && (
                  <Pressable
                    style={styles.moreButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowServerPicker(true)
                    }}
                    accessibilityLabel={`${overflowCount} more servers`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.moreButtonText}>+{overflowCount}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          {selectedServerId && (
            <Pressable
              style={styles.doneButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setSelectedServerId(null)
              }}
              accessibilityLabel="Done assigning"
              accessibilityRole="button"
            >
              <Text style={styles.doneButtonText}>DONE</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Neo.black}
          />
        }
      >
        {isLoading && !tablesData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        ) : tables.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO TABLES</Text>
            <Text style={styles.emptyText}>Tables need to be configured in the web dashboard</Text>
          </View>
        ) : (
          Object.entries(tablesByZone).map(([zoneKey, { zoneName, zoneColor, tables: zoneTables }]) => (
            <View key={zoneKey} style={styles.zoneSection}>
              <View style={[styles.zoneHeader, { backgroundColor: zoneColor }]}>
                <Text style={[styles.zoneTitle, { color: getContrastText(zoneColor) }]}>
                  {zoneName}
                </Text>
                <Text style={[styles.zoneCount, { color: getContrastText(zoneColor) }]}>
                  {zoneTables.length} {zoneTables.length === 1 ? 'TABLE' : 'TABLES'}
                </Text>
              </View>
              <View style={styles.tableGrid}>
                {zoneTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    assignedServer={assignmentsByTable[table.id] || null}
                    isAssigning={selectedServerId !== null}
                    onPress={() => handleTablePress(table.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />

      <ServerPickerModal
        visible={showServerPicker}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelect={handleServerPress}
        onClose={() => setShowServerPicker(false)}
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
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateButton: {
    width: 44,
    height: 44,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  dateButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
  },
  dateDisplay: {
    minWidth: 140,
    alignItems: 'center',
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...NeoShadow.sm,
  },
  dateDisplayPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  dateText: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateHint: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  serverBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  serverBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noServersText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    gap: 4,
  },
  serverBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serverBadgeSelected: {
    borderWidth: NeoBorder.default,
    ...NeoShadow.sm,
  },
  serverBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverBadgeTextCompact: {
    fontSize: 10,
  },
  serverBadgeCheck: {
    fontSize: 14,
    fontWeight: '900',
  },
  moreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderStyle: 'dashed',
  },
  moreButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  doneButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    ...NeoShadow.sm,
  },
  doneButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 16,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  zoneSection: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  zoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  zoneCount: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.8,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  tableCard: {
    width: 72,
    height: 72,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tableCardPressed: {
    backgroundColor: Neo.yellow + '40',
  },
  tableCardAssigning: {
    borderStyle: 'dashed',
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableCapacity: {
    fontSize: 9,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableServerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Neo.black,
    marginTop: 2,
  },
  tableServerName: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableNoServer: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tableNoServerText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    ...NeoShadow.lg,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.blue,
  },
  modalHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 350,
  },
  modalContent: {
    padding: 12,
    gap: 8,
  },
  modalServerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    gap: 12,
  },
  modalServerRowSelected: {
    backgroundColor: Neo.lime + '30',
    borderWidth: NeoBorder.default,
  },
  modalServerBadge: {
    width: 40,
    height: 40,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalServerInitials: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalServerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  modalCheckmark: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
  },
  modalCloseButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
  },
  modalCloseButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
