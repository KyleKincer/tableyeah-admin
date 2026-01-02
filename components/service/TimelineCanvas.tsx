import { useCallback, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
  runOnJS,
} from 'react-native-reanimated'
import Svg, { Rect, Line } from 'react-native-svg'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder } from '@/constants/theme'
import { TimelineReservationBar } from './TimelineReservationBar'
import { generateHourLabels, minutesToPercent } from './timeline/utils'
import type { TimelineCanvasProps, TimelineTableLayout, TimelineBarLayout } from './timeline/types'
import type { Reservation } from '@/lib/types'
import {
  TABLE_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
  HOUR_MARKER_HEIGHT,
  BAR_MIN_HEIGHT,
  LANE_GAP,
  ROW_PADDING,
  OCCUPANCY_GRAPH_HEIGHT,
} from './timeline/constants'

interface OccupancySlot {
  time: string
  covers: number
}

// Minimum and maximum scale factors
const MIN_SCALE = 0.5 // Show more hours (zoomed out)
const MAX_SCALE = 3.0 // Show fewer hours (zoomed in)
const DEFAULT_SCALE = 1.0

// Base width per hour at scale 1.0
const BASE_HOUR_WIDTH = 120

export function TimelineCanvas({
  layouts,
  serviceStartHour,
  serviceEndHour,
  zoomIndex, // Not used anymore - using smooth scale
  scrollOffsetMinutes,
  nowMinutes,
  showNowLine,
  selectedReservationId,
  occupancySlots,
  onReservationPress,
  onScrollChange,
  onZoomChange,
  onDragStart,
  onDragEnd,
}: TimelineCanvasProps) {
  const scrollViewRef = useRef<ScrollView>(null)
  const verticalScrollRef = useRef<ScrollView>(null)

  // Scale factor for smooth zooming (shared value for animations)
  const scale = useSharedValue(DEFAULT_SCALE)
  const savedScale = useSharedValue(DEFAULT_SCALE)

  // React state for scale (for non-animated components like SVG)
  const [currentScale, setCurrentScale] = useState(DEFAULT_SCALE)

  // Calculate total hours and content width
  const totalHours = serviceEndHour - serviceStartHour
  const hourLabels = useMemo(
    () => generateHourLabels(serviceStartHour, serviceEndHour),
    [serviceStartHour, serviceEndHour]
  )

  // Calculate max covers for occupancy graph scaling
  const maxCovers = useMemo(() => {
    if (!occupancySlots || occupancySlots.length === 0) return 1
    return Math.max(...occupancySlots.map((s) => s.covers), 1)
  }, [occupancySlots])

  // Haptic feedback helper
  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Update React state for scale (called from worklet)
  const updateScaleState = useCallback((newScale: number) => {
    setCurrentScale(newScale)
  }, [])

  // Pinch gesture for smooth zooming
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet'
      savedScale.value = scale.value
      runOnJS(triggerLightHaptic)()
    })
    .onUpdate((e) => {
      'worklet'
      const newScale = savedScale.value * e.scale
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
      // Sync to React state for SVG components
      runOnJS(updateScaleState)(scale.value)
    })
    .onEnd(() => {
      'worklet'
      savedScale.value = scale.value
    })

  // Animated style for content width based on scale
  const animatedContentStyle = useAnimatedStyle(() => ({
    width: totalHours * BASE_HOUR_WIDTH * scale.value,
  }))

  // Calculate NOW line position
  const serviceStartMinutes = serviceStartHour * 60
  const serviceEndMinutes = serviceEndHour * 60
  const showNow =
    showNowLine && nowMinutes >= serviceStartMinutes && nowMinutes <= serviceEndMinutes

  // Calculate total height for rows
  const totalRowHeight = layouts.reduce((sum, l) => sum + l.rowHeight, 0)

  return (
    <View style={styles.container}>
      {/* Fixed left column with table labels */}
      <View style={styles.leftColumn}>
        {/* Occupancy graph label area */}
        {occupancySlots && occupancySlots.length > 0 && (
          <View style={styles.occupancyLabelArea}>
            <Text style={styles.occupancyMaxLabel}>{maxCovers}</Text>
            <Text style={styles.occupancyMinLabel}>0</Text>
          </View>
        )}

        {/* Empty corner for hour markers */}
        <View style={styles.cornerSpacer} />

        {/* Table labels - vertically scrollable */}
        <ScrollView
          ref={verticalScrollRef}
          style={styles.tableLabelsScroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {layouts.map((layout) => (
            <View
              key={layout.tableKey}
              style={[styles.tableLabel, { height: layout.rowHeight }]}
            >
              <Text style={styles.tableLabelText} numberOfLines={1}>
                {layout.tableKey === 'Unassigned' ? '—' : layout.tableKey}
              </Text>
              {layout.table && (
                <Text style={styles.capacityText}>
                  {layout.table.min_capacity}-{layout.table.max_capacity}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable content area (horizontal + vertical) */}
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.scrollContainer}>
          {/* Horizontal scroll for timeline */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            bounces={true}
            decelerationRate="normal"
          >
            <View>
              {/* Occupancy graph - synced with timeline */}
              {occupancySlots && occupancySlots.length > 0 && (
                <Animated.View style={[styles.occupancyGraphRow, animatedContentStyle]}>
                  <OccupancyGraphInline
                    slots={occupancySlots}
                    maxCovers={maxCovers}
                    serviceStartHour={serviceStartHour}
                    serviceEndHour={serviceEndHour}
                    nowMinutes={nowMinutes}
                    showNowLine={showNowLine}
                    contentWidth={totalHours * BASE_HOUR_WIDTH * currentScale}
                  />
                </Animated.View>
              )}

              {/* Hour markers - scroll horizontally with content */}
              <Animated.View style={[styles.hourMarkersRow, animatedContentStyle]}>
                {hourLabels.map(({ hour, label, percent }) => (
                  <View
                    key={hour}
                    style={[
                      styles.hourMarker,
                      {
                        left: `${percent}%` as `${number}%`,
                      },
                    ]}
                  >
                    <Text style={styles.hourMarkerText}>{label}</Text>
                  </View>
                ))}
              </Animated.View>

              {/* Vertical scroll for table rows */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  // Sync vertical scroll with table labels
                  verticalScrollRef.current?.scrollTo({
                    y: e.nativeEvent.contentOffset.y,
                    animated: false,
                  })
                }}
              >
                <Animated.View style={[styles.rowsContainer, animatedContentStyle]}>
                  {/* Grid lines for hours */}
                  <View style={styles.gridLines}>
                    {hourLabels.map(({ hour, percent }) => (
                      <View
                        key={hour}
                        style={[
                          styles.gridLine,
                          { left: `${percent}%` as `${number}%` },
                        ]}
                      />
                    ))}
                  </View>

                  {/* Table rows with reservation bars */}
                  {layouts.map((layout) => (
                    <TableRow
                      key={layout.tableKey}
                      layout={layout}
                      serviceStartHour={serviceStartHour}
                      serviceEndHour={serviceEndHour}
                      selectedReservationId={selectedReservationId}
                      onReservationPress={onReservationPress}
                      onDragStart={onDragStart}
                    />
                  ))}

                  {/* NOW line */}
                  {showNow && (
                    <View
                      style={[
                        styles.nowLine,
                        {
                          left: `${((nowMinutes - serviceStartMinutes) / (serviceEndMinutes - serviceStartMinutes)) * 100}%` as `${number}%`,
                          height: totalRowHeight,
                        },
                      ]}
                    >
                      <View style={styles.nowMarker} />
                    </View>
                  )}
                </Animated.View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </GestureDetector>
    </View>
  )
}

// Inline occupancy graph component
function OccupancyGraphInline({
  slots,
  maxCovers,
  serviceStartHour,
  serviceEndHour,
  nowMinutes,
  showNowLine,
  contentWidth,
}: {
  slots: OccupancySlot[]
  maxCovers: number
  serviceStartHour: number
  serviceEndHour: number
  nowMinutes: number
  showNowLine: boolean
  contentWidth: number
}) {
  const totalMinutes = (serviceEndHour - serviceStartHour) * 60
  const serviceStartMinutes = serviceStartHour * 60
  const serviceEndMinutes = serviceEndHour * 60
  const graphHeight = OCCUPANCY_GRAPH_HEIGHT - 8 // padding

  // Check if NOW is within service hours
  const showNow =
    showNowLine && nowMinutes >= serviceStartMinutes && nowMinutes <= serviceEndMinutes
  const nowX = ((nowMinutes - serviceStartMinutes) / totalMinutes) * contentWidth

  // Calculate slot width in pixels (30 minutes per slot)
  const slotWidthPx = (30 / totalMinutes) * contentWidth

  return (
    <View style={styles.occupancyGraphContainer}>
      <Svg width={contentWidth} height={graphHeight}>
        {/* Background grid line at 50% */}
        <Line
          x1={0}
          y1={graphHeight / 2}
          x2={contentWidth}
          y2={graphHeight / 2}
          stroke={Neo.black + '15'}
          strokeWidth={1}
          strokeDasharray="4,4"
        />

        {/* Bars - positioned by time in pixels */}
        {slots.map((slot, i) => {
          const slotMinutes = parseInt(slot.time.split(':')[0]) * 60 + parseInt(slot.time.split(':')[1])
          const x = ((slotMinutes - serviceStartMinutes) / totalMinutes) * contentWidth
          const barHeight = (slot.covers / maxCovers) * (graphHeight - 4)
          const y = graphHeight - barHeight

          if (slot.covers === 0) return null

          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={Math.max(slotWidthPx - 2, 2)}
              height={barHeight}
              fill={Neo.cyan}
              stroke={Neo.black}
              strokeWidth={1}
            />
          )
        })}

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
  )
}

// Separate component for table row to avoid re-renders
function TableRow({
  layout,
  serviceStartHour,
  serviceEndHour,
  selectedReservationId,
  onReservationPress,
  onDragStart,
}: {
  layout: TimelineTableLayout
  serviceStartHour: number
  serviceEndHour: number
  selectedReservationId: number | null
  onReservationPress: (res: Reservation) => void
  onDragStart?: (res: Reservation) => void
}) {
  const totalMinutes = (serviceEndHour - serviceStartHour) * 60
  const serviceStartMinutes = serviceStartHour * 60

  return (
    <View style={[styles.tableRow, { height: layout.rowHeight }]}>
      {layout.bars.map((bar) => {
        // Calculate position based on actual start/end minutes
        const leftPercent = ((bar.startMinutes - serviceStartMinutes) / totalMinutes) * 100
        const widthPercent = ((bar.endMinutes - bar.startMinutes) / totalMinutes) * 100
        const top = ROW_PADDING + bar.laneIndex * (BAR_MIN_HEIGHT + LANE_GAP)

        return (
          <View
            key={bar.reservation.id}
            style={[
              styles.barWrapper,
              {
                left: `${leftPercent}%` as `${number}%`,
                width: `${widthPercent}%` as `${number}%`,
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Neo.cream,
  },
  leftColumn: {
    width: TABLE_LABEL_WIDTH,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
    zIndex: 10,
  },
  cornerSpacer: {
    height: HOUR_MARKER_HEIGHT,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.cream,
  },
  occupancyLabelArea: {
    height: OCCUPANCY_GRAPH_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.white,
  },
  occupancyMaxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
  },
  occupancyMinLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '40',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
  },
  occupancyGraphRow: {
    height: OCCUPANCY_GRAPH_HEIGHT,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.white,
  },
  occupancyGraphContainer: {
    flex: 1,
    paddingVertical: 4,
  },
  tableLabelsScroll: {
    flex: 1,
  },
  tableLabel: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
    paddingHorizontal: 4,
    backgroundColor: Neo.cream,
  },
  tableLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityText: {
    fontSize: 8,
    fontWeight: '600',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scrollContainer: {
    flex: 1,
  },
  hourMarkersRow: {
    height: HOUR_MARKER_HEIGHT,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.cream,
    position: 'relative',
  },
  hourMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    transform: [{ translateX: -12 }],
  },
  hourMarkerText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowsContainer: {
    position: 'relative',
    minHeight: '100%',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Neo.black + '10',
  },
  tableRow: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
    backgroundColor: Neo.white,
  },
  barWrapper: {
    position: 'absolute',
    height: BAR_MIN_HEIGHT,
    zIndex: 1,
  },
  nowLine: {
    position: 'absolute',
    top: 0,
    width: 3,
    backgroundColor: Neo.pink,
    zIndex: 100,
    alignItems: 'center',
  },
  nowMarker: {
    width: 12,
    height: 12,
    backgroundColor: Neo.pink,
    borderWidth: 2,
    borderColor: Neo.black,
    transform: [{ rotate: '45deg' }, { translateY: -6 }],
  },
})
