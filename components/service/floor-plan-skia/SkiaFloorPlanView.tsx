import { useCallback, useMemo, useState } from 'react'
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder } from '@/constants/theme'
import type { TableWithStatus, FloorPlanElement } from '@/lib/types'

import { SkiaFloorPlanCanvas } from './SkiaFloorPlanCanvas'
import { ServerAssignmentPill } from './ServerAssignmentPill'
import type { SkiaFloorPlanViewProps, FloorPlanStats, ServerAssignmentRecord } from './types'

export function SkiaFloorPlanView({
  tables,
  elements = [],
  selectedTableId,
  onTablePress,
  onTableLongPress,
  onBackgroundPress,
  serverAssignments = {},
  mode = 'normal',
  walkInPartySize,
  onCancelMode,
  servers = [],
  selectedServerId,
  pendingServerAssignments = {},
  onSelectServer,
  onToggleTableServer,
  onSaveServerAssignments,
  waitlistEntry,
  onSeatWaitlistAtTable,
}: SkiaFloorPlanViewProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [pressedTableId, setPressedTableId] = useState<number | null>(null)

  // Filter tables that have valid positions
  const positionedTables = useMemo(
    () => tables.filter((t) => t.position_x != null && t.position_y != null),
    [tables]
  )

  // Calculate stats
  const stats: FloorPlanStats = useMemo(() => {
    return {
      available: tables.filter((t) => t.status === 'available').length,
      seated: tables.filter((t) => t.status === 'seated').length,
      upcoming: tables.filter((t) => t.status === 'upcoming').length,
      seatedCovers: tables
        .filter((t) => t.status === 'seated' && t.currentReservation)
        .reduce((sum, t) => sum + (t.currentReservation?.covers || 0), 0),
    }
  }, [tables])

  // Handle layout to get container dimensions
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setContainerSize({ width, height })
  }, [])

  // Handle table tap with mode-aware logic
  const handleTableTap = useCallback(
    (table: TableWithStatus) => {
      if (mode === 'server-assignment' && selectedServerId) {
        onToggleTableServer?.(table.id)
      } else if (mode === 'seat-waitlist' && waitlistEntry && table.status === 'available') {
        onSeatWaitlistAtTable?.(table.id)
      } else {
        onTablePress(table)
      }
    },
    [mode, selectedServerId, waitlistEntry, onToggleTableServer, onSeatWaitlistAtTable, onTablePress]
  )

  // Handle pressed state
  const handlePressIn = useCallback((tableId: number) => {
    setPressedTableId(tableId)
  }, [])

  const handlePressOut = useCallback(() => {
    setPressedTableId(null)
  }, [])

  // Empty state
  if (positionedTables.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>NO FLOOR PLAN</Text>
        <Text style={styles.emptySubtext}>
          Tables don't have positions configured.
        </Text>
        <Text style={styles.emptyHint}>
          Configure the floor plan in the web app.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Walk-in mode indicator bar */}
      {mode === 'walk-in' && walkInPartySize && (
        <View style={styles.modeBar}>
          <View style={styles.modeBarContent}>
            <Text style={styles.modeBarText}>
              SEATING {walkInPartySize} {walkInPartySize === 1 ? 'GUEST' : 'GUESTS'} — TAP A TABLE
            </Text>
          </View>
          <Pressable
            style={styles.modeBarCancel}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onCancelMode?.()
            }}
          >
            <Text style={styles.modeBarCancelText}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/* Waitlist seating mode bar */}
      {mode === 'seat-waitlist' && waitlistEntry && (
        <View style={styles.modeBar}>
          <View style={styles.waitlistModeContent}>
            <Text style={styles.waitlistModeName}>{waitlistEntry.name}</Text>
            <Text style={styles.waitlistModeDetails}>
              {waitlistEntry.covers} GUESTS · TAP A TABLE
            </Text>
          </View>
          <Pressable
            style={styles.modeBarCancel}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onCancelMode?.()
            }}
          >
            <Text style={styles.modeBarCancelText}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={[styles.statBadge, { backgroundColor: Neo.lime }]}>
          <Text style={styles.statText}>{stats.available} OPEN</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: Neo.cyan }]}>
          <Text style={styles.statText}>
            {stats.seated} SEATED · {stats.seatedCovers} COV
          </Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: Neo.orange }]}>
          <Text style={styles.statText}>{stats.upcoming} SOON</Text>
        </View>
      </View>

      {/* Skia Canvas */}
      <View style={styles.canvasContainer} onLayout={handleLayout}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <SkiaFloorPlanCanvas
            tables={positionedTables}
            elements={elements.filter((e) => e.active)}
            selectedTableId={selectedTableId}
            pressedTableId={pressedTableId}
            serverAssignments={serverAssignments as Record<number, ServerAssignmentRecord>}
            mode={mode}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            transform={{ scale: 1, translateX: 0, translateY: 0 }}
            onTableTap={handleTableTap}
            onTableLongPress={onTableLongPress}
            onBackgroundTap={onBackgroundPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            selectedServerId={selectedServerId}
            pendingServerAssignments={pendingServerAssignments as Record<number, ServerAssignmentRecord | null>}
          />
        )}

        {/* Server Assignment Pill - show in normal and server-assignment modes */}
        {(mode === 'normal' || mode === 'server-assignment') && servers.length > 0 && (
          <ServerAssignmentPill
            servers={servers}
            selectedServerId={selectedServerId ?? null}
            pendingAssignmentsCount={
              selectedServerId
                ? (() => {
                    // Count tables assigned to this server (existing + pending changes)
                    let count = 0
                    const pendingTableIds = new Set(Object.keys(pendingServerAssignments).map(Number))

                    // Count existing assignments not overridden by pending
                    Object.entries(serverAssignments).forEach(([tableIdStr, assignment]) => {
                      const tableId = Number(tableIdStr)
                      if (!pendingTableIds.has(tableId) && assignment?.serverId === selectedServerId) {
                        count++
                      }
                    })

                    // Count pending assignments to this server
                    Object.values(pendingServerAssignments).forEach((assignment) => {
                      if (assignment?.serverId === selectedServerId) {
                        count++
                      }
                    })

                    return count
                  })()
                : 0
            }
            hasChanges={Object.keys(pendingServerAssignments).length > 0}
            onSelectServer={onSelectServer ?? (() => {})}
            onSave={onSaveServerAssignments ?? (() => {})}
            onCancel={onCancelMode ?? (() => {})}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  canvasContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Neo.cream,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptySubtext: {
    fontSize: 14,
    color: Neo.black,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.5,
    textAlign: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.white,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  statText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Neo.lime,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  modeBarContent: {
    flex: 1,
  },
  modeBarText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  modeBarCancel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Neo.white,
    borderWidth: 2,
    borderColor: Neo.black,
  },
  modeBarCancelText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  waitlistModeContent: {
    flex: 1,
  },
  waitlistModeName: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  waitlistModeDetails: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
