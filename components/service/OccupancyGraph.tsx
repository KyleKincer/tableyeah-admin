import { memo, useMemo } from 'react'
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg'

import { Neo, NeoBorder } from '@/constants/theme'
import { minutesToPercent, timeToMinutes, formatHour } from './timeline/utils'
import {
  OCCUPANCY_GRAPH_HEIGHT,
  TABLE_LABEL_WIDTH,
} from './timeline/constants'

interface OccupancySlot {
  time: string
  covers: number
}

interface OccupancyGraphProps {
  slots: OccupancySlot[]
  serviceStartHour: number
  serviceEndHour: number
  zoomIndex: number
  nowMinutes: number
  showNowLine: boolean
  height?: number
}

function OccupancyGraphComponent({
  slots,
  serviceStartHour,
  serviceEndHour,
  zoomIndex,
  nowMinutes,
  showNowLine,
  height = OCCUPANCY_GRAPH_HEIGHT,
}: OccupancyGraphProps) {
  const { width: screenWidth } = useWindowDimensions()

  // Calculate dimensions - graph shows full day overview (no zoom)
  const graphWidth = screenWidth - TABLE_LABEL_WIDTH - 16 // padding
  const graphHeight = height - 16 // padding for label

  // Find max covers for scaling
  const maxCovers = useMemo(() => {
    return Math.max(...slots.map((s) => s.covers), 1)
  }, [slots])

  // Calculate bar positions - evenly distributed across full width
  const bars = useMemo(() => {
    if (slots.length === 0) return []

    const slotWidth = graphWidth / slots.length
    const barPadding = 1

    return slots.map((slot, i) => {
      const barHeight = (slot.covers / maxCovers) * (graphHeight - 12)
      const x = i * slotWidth + barPadding
      const width = Math.max(slotWidth - barPadding * 2, 2)
      const y = graphHeight - barHeight

      return {
        x,
        y,
        width,
        height: barHeight,
        covers: slot.covers,
        time: slot.time,
      }
    })
  }, [slots, graphWidth, graphHeight, maxCovers])

  // Calculate NOW line position - based on full width
  const nowX = useMemo(() => {
    const percent = minutesToPercent(nowMinutes, serviceStartHour, serviceEndHour)
    return (percent / 100) * graphWidth
  }, [nowMinutes, serviceStartHour, serviceEndHour, graphWidth])

  // Check if NOW is within service hours
  const serviceStartMinutes = serviceStartHour * 60
  const serviceEndMinutes = serviceEndHour * 60
  const showNow =
    showNowLine && nowMinutes >= serviceStartMinutes && nowMinutes <= serviceEndMinutes

  return (
    <View style={[styles.container, { height }]}>
      {/* Max covers label */}
      <View style={styles.labelContainer}>
        <Text style={styles.maxLabel}>{maxCovers}</Text>
        <Text style={styles.minLabel}>0</Text>
      </View>

      {/* SVG graph */}
      <View style={styles.graphContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          {/* Background grid line at 50% */}
          <Line
            x1={0}
            y1={graphHeight / 2}
            x2={graphWidth}
            y2={graphHeight / 2}
            stroke={Neo.black + '15'}
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Bars */}
          {bars.map((bar, i) => (
            <Rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={Neo.cyan}
              stroke={Neo.black}
              strokeWidth={1}
            />
          ))}

          {/* NOW line */}
          {showNow && (
            <Line
              x1={nowX}
              y1={0}
              x2={nowX}
              y2={graphHeight}
              stroke={Neo.pink}
              strokeWidth={2}
            />
          )}
        </Svg>
      </View>
    </View>
  )
}

export const OccupancyGraph = memo(OccupancyGraphComponent)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  labelContainer: {
    width: TABLE_LABEL_WIDTH - 8,
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  maxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
  },
  minLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '40',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
  },
  graphContainer: {
    flex: 1,
    overflow: 'hidden',
  },
})
