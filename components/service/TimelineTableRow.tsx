import { memo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { Neo, NeoBorder } from '@/constants/theme'
import { TimelineReservationBar } from './TimelineReservationBar'
import type { TimelineTableRowProps } from './timeline/types'
import {
  TABLE_LABEL_WIDTH,
  BAR_MIN_HEIGHT,
  LANE_GAP,
  ROW_PADDING,
  ZOOM_LEVELS,
  SERVICE_START_HOUR,
  SERVICE_END_HOUR,
} from './timeline/constants'

function TimelineTableRowComponent({
  layout,
  serviceStartHour,
  serviceEndHour,
  zoomIndex,
  scrollOffsetMinutes,
  selectedReservationId,
  onReservationPress,
  onDragStart,
  isDragTarget,
}: TimelineTableRowProps) {
  const { tableKey, table, bars, laneCount, rowHeight, hasConflicts } = layout

  // Calculate visible window based on zoom
  const hoursVisible = ZOOM_LEVELS[zoomIndex]
  const totalMinutes = (serviceEndHour - serviceStartHour) * 60
  const visibleMinutes = hoursVisible * 60

  // Width multiplier for zoom (full day = 100%, zoomed = larger)
  const widthMultiplier = totalMinutes / visibleMinutes

  return (
    <View
      style={[
        styles.row,
        { height: rowHeight },
        isDragTarget && styles.rowDragTarget,
      ]}
    >
      {/* Fixed table label */}
      <View style={[styles.tableLabel, hasConflicts && styles.tableLabelConflict]}>
        <Text style={styles.tableLabelText} numberOfLines={1}>
          {tableKey === 'Unassigned' ? '—' : `T${tableKey}`}
        </Text>
        {table && (
          <Text style={styles.capacityText}>
            {table.min_capacity}-{table.max_capacity}
          </Text>
        )}
      </View>

      {/* Timeline content area */}
      <View style={styles.timelineArea}>
        {/* Reservation bars */}
        {bars.map((bar) => {
          // Calculate position with zoom factor
          const left = `${bar.startPercent * widthMultiplier}%`
          const width = `${bar.widthPercent * widthMultiplier}%`

          // Vertical position based on lane
          const top = ROW_PADDING + bar.laneIndex * (BAR_MIN_HEIGHT + LANE_GAP)

          return (
            <View
              key={bar.reservation.id}
              style={[
                styles.barWrapper,
                {
                  left: left as `${number}%`,
                  width: width as `${number}%`,
                  top,
                },
              ]}
            >
              <TimelineReservationBar
                bar={bar}
                isSelected={selectedReservationId === bar.reservation.id}
                onPress={() => onReservationPress(bar.reservation)}
                onLongPress={onDragStart ? () => onDragStart(bar.reservation) : undefined}
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const TimelineTableRow = memo(TimelineTableRowComponent)

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
    backgroundColor: Neo.white,
  },
  rowDragTarget: {
    backgroundColor: Neo.lime + '30',
    borderBottomColor: Neo.lime,
    borderBottomWidth: NeoBorder.thin,
  },
  tableLabel: {
    width: TABLE_LABEL_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
    paddingHorizontal: 4,
  },
  tableLabelConflict: {
    backgroundColor: Neo.pink + '20',
  },
  tableLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  capacityText: {
    fontSize: 8,
    fontWeight: '600',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timelineArea: {
    flex: 1,
    position: 'relative',
  },
  barWrapper: {
    position: 'absolute',
    height: BAR_MIN_HEIGHT,
  },
})
