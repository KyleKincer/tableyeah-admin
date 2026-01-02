import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { differenceInMinutes, parseISO } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { DropTarget } from '@/components/dnd'
import { NeoDotsBackground } from '@/components/ui/NeoDotsBackground'
import type { TableWithStatus, TableShape, TableStatus, ServerAssignment, FloorPlanElement, FloorPlanElementType, Server, WaitlistEntry } from '@/lib/types'

// Status colors matching the Neo theme
const STATUS_COLORS: Record<TableStatus, string> = {
  available: Neo.lime,
  seated: Neo.cyan,
  upcoming: Neo.orange,
  occupied: Neo.pink,
}

// Turn time status
type TurnTimeStatus = 'green' | 'amber' | 'red'

function getTurnTimeStatus(seatedAt: string, expectedMinutes: number): TurnTimeStatus {
  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  const percentage = (elapsedMinutes / expectedMinutes) * 100

  if (percentage < 75) return 'green'
  if (percentage <= 100) return 'amber'
  return 'red'
}

function getTurnTimeColor(status: TurnTimeStatus): string {
  switch (status) {
    case 'green':
      return Neo.lime
    case 'amber':
      return Neo.yellow
    case 'red':
      return Neo.pink
  }
}

// Format turn time compactly: 45M, 1H23, 2H05, 3H
function formatTurnTime(seatedAt: string): string {
  const minutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}H${mins > 0 ? mins.toString().padStart(2, '0') : ''}`
  }
  return `${minutes}M`
}

// Element rendering helpers
const ELEMENT_LABELS: Partial<Record<FloorPlanElementType, string>> = {
  KITCHEN: 'KITCHEN',
  BAR_AREA: 'BAR',
  RESTROOM: 'WC',
  HOSTESS: 'HOST',
  ENTRANCE: 'ENTRY',
}

interface FloorPlanElementProps {
  element: FloorPlanElement
  containerWidth: number
  containerHeight: number
}

function FloorPlanElementComponent({
  element,
  containerWidth,
  containerHeight,
}: FloorPlanElementProps) {
  // Calculate position in pixels from percentage
  const posX = (element.position_x / 100) * containerWidth
  const posY = (element.position_y / 100) * containerHeight

  // Scale element size relative to container
  const scale = Math.min(containerWidth, containerHeight) / 800
  const scaledWidth = Math.max(element.width * scale, 20)
  const scaledHeight = Math.max(element.height * scale, 20)

  const getElementStyle = () => {
    const baseStyle: any = {
      position: 'absolute' as const,
      left: posX - scaledWidth / 2,
      top: posY - scaledHeight / 2,
      width: scaledWidth,
      height: scaledHeight,
      transform: [{ rotate: `${element.rotation}deg` }],
      zIndex: element.z_index,
    }

    switch (element.type) {
      case 'WALL':
      case 'DIVIDER':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: element.color || Neo.black + '60',
          backgroundColor: 'transparent',
        }
      case 'COLUMN':
        return {
          ...baseStyle,
          borderWidth: 3,
          borderColor: element.color || Neo.black,
          borderRadius: scaledWidth / 2,
          backgroundColor: 'transparent',
        }
      case 'PLANT':
        return {
          ...baseStyle,
          borderRadius: scaledWidth / 2,
          backgroundColor: (element.color || '#22C55E') + '30',
          borderWidth: 1,
          borderColor: element.color || '#22C55E',
        }
      case 'ENTRANCE':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: element.color || Neo.black,
          borderStyle: 'dashed' as const,
          backgroundColor: 'transparent',
        }
      case 'LABEL':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        }
      case 'KITCHEN':
      case 'BAR_AREA':
      case 'RESTROOM':
      case 'HOSTESS':
      case 'DECORATION':
      default:
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: element.color || Neo.black + '40',
          backgroundColor: (element.color || Neo.black) + '10',
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        }
    }
  }

  const labelText = element.label || ELEMENT_LABELS[element.type] || ''

  return (
    <View style={getElementStyle()} pointerEvents="none">
      {element.type === 'PLANT' && (
        <Text style={styles.plantIcon}>🌿</Text>
      )}
      {element.type === 'ENTRANCE' && (
        <Text style={styles.entranceIcon}>🚪</Text>
      )}
      {labelText && element.type !== 'PLANT' && element.type !== 'ENTRANCE' && (
        <Text
          style={[
            styles.elementLabel,
            element.type === 'LABEL' && styles.labelText,
          ]}
          numberOfLines={1}
        >
          {labelText}
        </Text>
      )}
    </View>
  )
}

interface TableShapeProps {
  table: TableWithStatus
  isSelected: boolean
  serverColor?: string
  onPress: () => void
  onLongPress: () => void
  containerWidth: number
  containerHeight: number
  /** If true, table fills its parent instead of positioning itself absolutely */
  fillParent?: boolean
}

function TableShapeComponent({
  table,
  isSelected,
  serverColor,
  onPress,
  onLongPress,
  containerWidth,
  containerHeight,
  fillParent = false,
}: TableShapeProps) {
  const [pressed, setPressed] = useState(false)
  const [, forceUpdate] = useState(0)

  // Update turn time every 30 seconds
  useEffect(() => {
    if (table.status !== 'seated' || !table.currentReservation?.seatedAt) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000)
    return () => clearInterval(interval)
  }, [table.status, table.currentReservation?.seatedAt])

  const statusColor = STATUS_COLORS[table.status]
  const textColor = [Neo.lime, Neo.cyan, Neo.yellow].includes(statusColor)
    ? Neo.black
    : Neo.white

  // Calculate position in pixels from percentage
  const posX = table.position_x != null ? (table.position_x / 100) * containerWidth : 0
  const posY = table.position_y != null ? (table.position_y / 100) * containerHeight : 0

  // Scale table size relative to container (assuming 800px reference width)
  const scale = Math.min(containerWidth, containerHeight) / 800
  const scaledWidth = Math.max(table.width * scale, 50)
  const scaledHeight = Math.max(table.height * scale, 40)
  const effectiveHeight = table.shape === 'SQUARE' ? scaledWidth : scaledHeight

  // Get border radius based on shape
  const getBorderRadius = () => {
    switch (table.shape) {
      case 'CIRCLE':
        return scaledWidth / 2
      case 'OVAL':
        return scaledHeight / 2
      default:
        return 0
    }
  }

  // Show info badge for seated tables
  const showInfoBadge =
    table.status === 'seated' &&
    table.currentReservation

  const turnTimeStatus = showInfoBadge && table.currentReservation?.seatedAt
    ? getTurnTimeStatus(table.currentReservation.seatedAt, 75) // Default 75 min
    : null

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onLongPress()
  }

  // Get transform for rotation + pressed state
  const getShapeTransform = () => {
    if (pressed) {
      return [
        { rotate: `${table.rotation}deg` },
        { translateX: 1 } as any,
        { translateY: 1 } as any,
      ]
    }
    return [{ rotate: `${table.rotation}deg` }]
  }

  // Extract first name from full name
  const firstName = table.currentReservation?.name?.split(' ')[0] || ''

  // In fillParent mode, render wrapper that allows badge to overflow
  // The wrapper fills the parent, shape is inside, badge is positioned below
  if (fillParent) {
    return (
      <View style={styles.tableWrapper}>
        {/* The rotated table shape */}
        <Pressable
          style={[
            styles.tableShape,
            styles.tableShapeFill,
            {
              backgroundColor: statusColor,
              borderRadius: getBorderRadius(),
              transform: getShapeTransform(),
            },
            isSelected && styles.tableSelected,
            pressed && styles.tablePressedShadow,
            serverColor && { borderColor: serverColor, borderWidth: 4 },
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityLabel={`Table ${table.table_number}, ${table.status}${table.currentReservation ? `, ${table.currentReservation.name}` : ''}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          {/* Content - counter-rotated to stay level for readability */}
          <View style={[styles.tableContent, { transform: [{ rotate: `-${table.rotation}deg` }] }]}>
            <Text style={[styles.tableNumber, { color: textColor }]}>
              {table.table_number}
            </Text>
            <Text style={[styles.tableCapacity, { color: textColor }]}>
              {table.min_capacity === table.max_capacity
                ? `${table.max_capacity}`
                : `${table.min_capacity}-${table.max_capacity}`}
            </Text>
          </View>
        </Pressable>

        {/* Info badge - absolutely positioned below, centered */}
        {showInfoBadge && (
          <View style={styles.infoBadgeContainer}>
            <View
              style={[
                styles.infoBadge,
                {
                  backgroundColor: turnTimeStatus
                    ? getTurnTimeColor(turnTimeStatus)
                    : statusColor,
                },
              ]}
            >
              <Text style={styles.infoBadgeName} numberOfLines={1}>
                {firstName}
              </Text>
              {table.currentReservation?.seatedAt && (
                <Text style={styles.infoBadgeTime}>
                  {formatTurnTime(table.currentReservation.seatedAt)}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    )
  }

  // Non-fillParent mode: position absolutely
  return (
    <View
      style={[
        styles.tableContainer,
        {
          left: posX,
          top: posY,
        },
      ]}
    >
      {/* The rotated table shape - positioned from center */}
      <Pressable
        style={[
          styles.tableShape,
          {
            position: 'absolute',
            left: -scaledWidth / 2,
            top: -effectiveHeight / 2,
            width: scaledWidth,
            height: effectiveHeight,
            backgroundColor: statusColor,
            borderRadius: getBorderRadius(),
            transform: getShapeTransform(),
          },
          isSelected && styles.tableSelected,
          pressed && styles.tablePressedShadow,
          serverColor && { borderColor: serverColor, borderWidth: 4 },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityLabel={`Table ${table.table_number}, ${table.status}${table.currentReservation ? `, ${table.currentReservation.name}` : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        {/* Content - counter-rotated to stay level for readability */}
        <View style={[styles.tableContent, { transform: [{ rotate: `-${table.rotation}deg` }] }]}>
          <Text style={[styles.tableNumber, { color: textColor }]}>
            {table.table_number}
          </Text>
          <Text style={[styles.tableCapacity, { color: textColor }]}>
            {table.min_capacity === table.max_capacity
              ? `${table.max_capacity}`
              : `${table.min_capacity}-${table.max_capacity}`}
          </Text>
        </View>
      </Pressable>

      {/* Info badge - uses screen coordinates, always below center */}
      {showInfoBadge && (
        <View
          style={[
            styles.infoBadge,
            {
              position: 'absolute',
              top: effectiveHeight / 2 + 4,
              backgroundColor: turnTimeStatus
                ? getTurnTimeColor(turnTimeStatus)
                : statusColor,
            },
          ]}
        >
          <Text style={styles.infoBadgeName} numberOfLines={1}>
            {firstName}
          </Text>
          {table.currentReservation?.seatedAt && (
            <Text style={styles.infoBadgeTime}>
              {formatTurnTime(table.currentReservation.seatedAt)}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

interface FloorPlanCanvasProps {
  tables: TableWithStatus[]
  elements?: FloorPlanElement[]
  selectedTableId: number | null
  onTablePress: (table: TableWithStatus) => void
  onTableLongPress: (table: TableWithStatus) => void
  onBackgroundPress: () => void
  serverAssignments?: Record<number, { serverId: number; serverName: string; serverColor: string }>
  mode?: 'normal' | 'walk-in' | 'seat-waitlist' | 'server-assignment'
  walkInPartySize?: number | null
  onCancelMode?: () => void
  // Server assignment props
  servers?: Server[]
  selectedServerId?: number | null
  pendingServerAssignments?: Record<number, { serverId: number; serverName: string; serverColor: string } | null>
  onSelectServer?: (serverId: number | null) => void
  onToggleTableServer?: (tableId: number) => void
  onSaveServerAssignments?: () => void
  // Waitlist seating props
  waitlistEntry?: WaitlistEntry | null
  onSeatWaitlistAtTable?: (tableId: number) => void
}

export function FloorPlanCanvas({
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
}: FloorPlanCanvasProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Filter tables that have valid positions
  const positionedTables = useMemo(
    () => tables.filter((t) => t.position_x != null && t.position_y != null),
    [tables]
  )

  // Calculate stats
  const stats = useMemo(() => {
    return {
      available: tables.filter((t) => t.status === 'available').length,
      seated: tables.filter((t) => t.status === 'seated').length,
      upcoming: tables.filter((t) => t.status === 'upcoming').length,
      seatedCovers: tables
        .filter((t) => t.status === 'seated' && t.currentReservation)
        .reduce((sum, t) => sum + (t.currentReservation?.covers || 0), 0),
    }
  }, [tables])

  const handleBackgroundPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onBackgroundPress()
  }

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

      {/* Server assignment mode bar */}
      {mode === 'server-assignment' && (
        <View style={styles.serverModeContainer}>
          <View style={styles.serverModeHeader}>
            <Text style={styles.serverModeTitle}>ASSIGN SERVERS</Text>
            <View style={styles.serverModeActions}>
              <Pressable
                style={styles.modeBarCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onCancelMode?.()
                }}
              >
                <Text style={styles.modeBarCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.serverModeSave,
                  Object.keys(pendingServerAssignments).length === 0 && styles.serverModeSaveDisabled,
                ]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  onSaveServerAssignments?.()
                }}
                disabled={Object.keys(pendingServerAssignments).length === 0}
              >
                <Text style={styles.serverModeSaveText}>SAVE</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serverPicker}
          >
            {servers.filter(s => s.active).map((server) => (
              <Pressable
                key={server.id}
                style={[
                  styles.serverChip,
                  { borderColor: server.color },
                  selectedServerId === server.id && styles.serverChipSelected,
                  selectedServerId === server.id && { backgroundColor: server.color },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onSelectServer?.(selectedServerId === server.id ? null : server.id)
                }}
              >
                <View style={[styles.serverDot, { backgroundColor: server.color }]} />
                <Text
                  style={[
                    styles.serverChipText,
                    selectedServerId === server.id && styles.serverChipTextSelected,
                  ]}
                >
                  {server.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {selectedServerId && (
            <Text style={styles.serverHint}>TAP TABLES TO ASSIGN</Text>
          )}
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

      {/* Floor plan canvas */}
      <Pressable
        style={styles.canvas}
        onPress={handleBackgroundPress}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setContainerSize({ width, height })
        }}
      >
        {/* Neo dots background pattern */}
        <NeoDotsBackground />

        {/* Floor plan elements (behind tables) */}
        {containerSize.width > 0 &&
          elements
            .filter((e) => e.active)
            .sort((a, b) => a.z_index - b.z_index)
            .map((element) => (
              <FloorPlanElementComponent
                key={`el-${element.id}`}
                element={element}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
              />
            ))}

        {/* Tables (on top of elements) */}
        {containerSize.width > 0 &&
          positionedTables.map((table) => {
            // In server-assignment mode, use pending assignments if available
            let effectiveServerColor: string | undefined = serverAssignments[table.id]?.serverColor
            if (mode === 'server-assignment' && pendingServerAssignments[table.id] !== undefined) {
              const pending = pendingServerAssignments[table.id]
              effectiveServerColor = pending?.serverColor ?? undefined
            }

            // Calculate position for DropTarget
            const scale = Math.min(containerSize.width, containerSize.height) / 800
            const posX = table.position_x != null ? (table.position_x / 100) * containerSize.width : 0
            const posY = table.position_y != null ? (table.position_y / 100) * containerSize.height : 0
            const scaledWidth = Math.max(table.width * scale, 50)
            const scaledHeight = table.shape === 'SQUARE' ? scaledWidth : Math.max(table.height * scale, 40)

            return (
              <DropTarget
                key={table.id}
                tableId={table.id}
                minCapacity={table.min_capacity}
                maxCapacity={table.max_capacity}
                isAvailable={table.status === 'available'}
                style={{
                  left: posX - scaledWidth / 2,
                  top: posY - scaledHeight / 2,
                  width: scaledWidth,
                  height: scaledHeight,
                }}
              >
                <TableShapeComponent
                  table={table}
                  isSelected={selectedTableId === table.id}
                  serverColor={effectiveServerColor}
                  fillParent={true}
                  onPress={() => {
                    if (mode === 'server-assignment' && selectedServerId) {
                      onToggleTableServer?.(table.id)
                    } else if (mode === 'seat-waitlist' && waitlistEntry && table.status === 'available') {
                      onSeatWaitlistAtTable?.(table.id)
                    } else {
                      onTablePress(table)
                    }
                  }}
                  onLongPress={() => onTableLongPress(table)}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              </DropTarget>
            )
          })}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
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
  canvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: Neo.cream,
  },
  tableShape: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  tableSelected: {
    borderWidth: 3,
    borderColor: Neo.yellow,
    ...NeoShadow.default,
    zIndex: 10,
  },
  tablePressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  tablePressedShadow: {
    ...NeoShadow.pressed,
  },
  plantIcon: {
    fontSize: 16,
  },
  entranceIcon: {
    fontSize: 14,
  },
  elementLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    opacity: 0.6,
    textAlign: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '800',
    opacity: 0.8,
  },
  tableContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableNumber: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tableCapacity: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.8,
  },
  // Styles for separated shape + badge layout
  tableWrapper: {
    flex: 1,
    overflow: 'visible',
  },
  tableShapeFill: {
    // Fill the entire parent - don't use flex since we want consistent size
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tableContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  infoBadgeContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 4,
  },
  infoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Neo.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoBadgeName: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
    maxWidth: 60,
  },
  infoBadgeTime: {
    fontSize: 9,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Neo.cream,
  },
  emptyTitle: {
    fontSize: 20,
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
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.4,
    marginTop: 16,
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.lime,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeBarContent: {
    flex: 1,
  },
  modeBarText: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  modeBarCancel: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...NeoShadow.sm,
  },
  modeBarCancelText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  serverModeContainer: {
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  serverModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '30',
  },
  serverModeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  serverModeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  serverModeSave: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...NeoShadow.sm,
  },
  serverModeSaveDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  serverModeSaveText: {
    fontSize: 10,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  serverPicker: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    backgroundColor: Neo.white,
    gap: 6,
  },
  serverChipSelected: {
    ...NeoShadow.sm,
  },
  serverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  serverChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  serverChipTextSelected: {
    color: Neo.black,
  },
  serverHint: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    opacity: 0.6,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  waitlistModeContent: {
    flex: 1,
  },
  waitlistModeName: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  waitlistModeDetails: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginTop: 2,
  },
})
