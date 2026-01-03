import { useMemo, useCallback, useState, useRef } from 'react'
import { View, StyleSheet, LayoutChangeEvent, Platform, Text as RNText, ActivityIndicator } from 'react-native'
import { Canvas, Group, Rect, Line, Text as SkiaText, Path, Skia, vec, rect, matchFont } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder } from '@/constants/theme'
import type { Reservation } from '@/lib/types'

import { useTimelineGestures } from './hooks/useTimelineGestures'
import { useTimelineDrag, type DragBarInfo } from './hooks/useTimelineDrag'
import type { SkiaTimelineCanvasProps } from './types'
import type { TimelineBarLayout } from '../timeline/types'
import {
  TABLE_LABEL_WIDTH,
  HOUR_MARKER_HEIGHT,
  OCCUPANCY_GRAPH_HEIGHT,
  BASE_HOUR_WIDTH,
  BAR_MIN_HEIGHT,
  LANE_GAP,
  ROW_PADDING,
  STATUS_BAR_COLORS,
  SHADOW_OFFSET,
  BORDER_WIDTH,
  GRID_THRESHOLDS,
  GRID_OPACITY,
} from './constants'
import { generateHourLabels } from '../timeline/utils'

// Font configuration for text rendering
const fontFamily = Platform.select({ ios: 'Menlo', default: 'monospace' })

const hourLabelFont = matchFont({
  fontFamily,
  fontSize: 10,
  fontWeight: 'bold',
})

const tableLabelFont = matchFont({
  fontFamily,
  fontSize: 11,
  fontWeight: 'bold',
})

const barLabelFont = matchFont({
  fontFamily,
  fontSize: 10,
  fontWeight: 'normal',
})

// Helper to get contrasting text color
function getTextColor(bgColor: string): string {
  const lightColors = [Neo.lime, Neo.cyan, Neo.yellow, Neo.white, Neo.cream]
  return lightColors.includes(bgColor) ? Neo.black : Neo.white
}

interface ExtendedSkiaTimelineCanvasProps extends SkiaTimelineCanvasProps {
  isSaving?: boolean
  saveError?: string | null
}

export function SkiaTimelineCanvas({
  layouts,
  serviceStartHour,
  serviceEndHour,
  nowMinutes,
  showNowLine,
  selectedReservationId,
  occupancySlots,
  totalCapacity,
  onReservationPress,
  onDragEnd,
  isSaving,
  saveError,
}: ExtendedSkiaTimelineCanvasProps) {
  // Viewport dimensions
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  // Drag state for UI rendering
  const [dragState, setDragState] = useState<{
    isDragging: boolean
    reservation: Reservation | null
    barInfo: DragBarInfo | null
    targetTableKey: string | null
    targetTableName: string | null
  }>({
    isDragging: false,
    reservation: null,
    barInfo: null,
    targetTableKey: null,
    targetTableName: null,
  })

  // Track which reservation is being pressed (waiting for long press)
  const [pressingReservationId, setPressingReservationId] = useState<number | null>(null)

  // Track touched slot in pacing chart for value display
  const [touchedSlot, setTouchedSlot] = useState<{
    time: string
    covers: number
    x: number
    y: number
  } | null>(null)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setViewportSize({ width, height })
  }, [])

  // Calculate content dimensions
  const totalHours = serviceEndHour - serviceStartHour
  const contentWidth = totalHours * BASE_HOUR_WIDTH
  const totalRowHeight = useMemo(
    () => layouts.reduce((sum, l) => sum + l.rowHeight, 0),
    [layouts]
  )
  const headerHeight = OCCUPANCY_GRAPH_HEIGHT + HOUR_MARKER_HEIGHT

  // Generate hour labels
  const hourLabels = useMemo(
    () => generateHourLabels(serviceStartHour, serviceEndHour),
    [serviceStartHour, serviceEndHour]
  )

  // Calculate max covers for occupancy graph (peak covers)
  const maxCovers = useMemo(() => {
    if (!occupancySlots || occupancySlots.length === 0) return 1
    return Math.max(...occupancySlots.map((s) => s.covers), 1)
  }, [occupancySlots])

  // Graph scale includes capacity if higher than peak (so capacity line is always visible)
  const graphScale = useMemo(() => {
    return Math.max(maxCovers, totalCapacity || 0, 1)
  }, [maxCovers, totalCapacity])

  // Set up gestures
  const { gesture: panZoomGesture, scale, translateX, translateY } = useTimelineGestures({
    contentWidth,
    contentHeight: totalRowHeight,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    headerHeight,
    tableLabelWidth: TABLE_LABEL_WIDTH,
  })

  // Set up drag functionality (table changes only, no time changes)
  const {
    dragX,
    dragY,
    isDragging: isDraggingShared,
    dragStateRef,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  } = useTimelineDrag({
    layouts,
    headerHeight,
    onDragEnd,
  })

  // Calculate NOW line position
  const serviceStartMinutes = serviceStartHour * 60
  const serviceEndMinutes = serviceEndHour * 60
  const totalServiceMinutes = serviceEndMinutes - serviceStartMinutes
  const showNow = showNowLine && nowMinutes >= serviceStartMinutes && nowMinutes <= serviceEndMinutes
  const nowX = ((nowMinutes - serviceStartMinutes) / totalServiceMinutes) * contentWidth

  // Cumulative Y positions for rows
  const rowYPositions = useMemo(() => {
    const positions: number[] = []
    let y = 0
    for (const layout of layouts) {
      positions.push(y)
      y += layout.rowHeight
    }
    return positions
  }, [layouts])

  // Store layouts ref for hit testing in gesture worklet
  const layoutsRef = useRef(layouts)
  layoutsRef.current = layouts
  const rowYPositionsRef = useRef(rowYPositions)
  rowYPositionsRef.current = rowYPositions

  // Hit test - returns the reservation and bar info at a given screen position
  const hitTestReservation = useCallback(
    (
      screenX: number,
      screenY: number,
      scaleVal: number,
      txVal: number,
      tyVal: number
    ): { reservation: Reservation; barInfo: DragBarInfo } | null => {
      const currentLayouts = layoutsRef.current
      const currentRowYPositions = rowYPositionsRef.current

      // Convert screen coordinates to content coordinates
      const contentX = (screenX - TABLE_LABEL_WIDTH - txVal) / scaleVal
      const contentY = screenY - headerHeight - tyVal

      // Find which row was tapped
      let rowIndex = -1
      let rowY = 0
      for (let i = 0; i < currentLayouts.length; i++) {
        if (contentY >= rowY && contentY < rowY + currentLayouts[i].rowHeight) {
          rowIndex = i
          break
        }
        rowY += currentLayouts[i].rowHeight
      }

      if (rowIndex < 0) return null

      const layout = currentLayouts[rowIndex]
      const relativeY = contentY - currentRowYPositions[rowIndex]

      // Check each bar in this row
      for (const bar of layout.bars) {
        const barX = (bar.startPercent / 100) * contentWidth
        const barWidth = (bar.widthPercent / 100) * contentWidth
        const barY = ROW_PADDING + bar.laneIndex * (BAR_MIN_HEIGHT + LANE_GAP)

        if (
          contentX >= barX &&
          contentX <= barX + barWidth &&
          relativeY >= barY &&
          relativeY <= barY + BAR_MIN_HEIGHT
        ) {
          // Calculate screen position of bar for drag preview
          const screenBarX = TABLE_LABEL_WIDTH + barX * scaleVal + txVal
          const screenBarY = headerHeight + currentRowYPositions[rowIndex] + barY + tyVal
          const screenBarWidth = barWidth * scaleVal

          return {
            reservation: bar.reservation,
            barInfo: {
              bar,
              tableKey: layout.tableKey,
              screenX: screenBarX,
              screenY: screenBarY,
              width: screenBarWidth,
              height: BAR_MIN_HEIGHT,
            },
          }
        }
      }
      return null
    },
    [contentWidth, headerHeight]
  )

  // Tap handler - select reservation
  const performTapHitTest = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const result = hitTestReservation(screenX, screenY, scaleVal, txVal, tyVal)
      if (result) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onReservationPress(result.reservation)
      }
    },
    [hitTestReservation, onReservationPress]
  )

  // Touch start handler - show pressing state while waiting for long press
  const performTouchStart = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const result = hitTestReservation(screenX, screenY, scaleVal, txVal, tyVal)
      if (result) {
        setPressingReservationId(result.reservation.id)
        // Light haptic to acknowledge touch
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    },
    [hitTestReservation]
  )

  // Touch end handler - clear pressing state
  const performTouchEnd = useCallback(() => {
    setPressingReservationId(null)
    setTouchedSlot(null)
  }, [])

  // Pacing chart touch handler - show slot value
  const performPacingTouch = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number) => {
      // Check if touch is in pacing graph area
      if (screenY < 0 || screenY > OCCUPANCY_GRAPH_HEIGHT || screenX < TABLE_LABEL_WIDTH) {
        setTouchedSlot(null)
        return
      }

      if (!occupancySlots || occupancySlots.length === 0) {
        setTouchedSlot(null)
        return
      }

      // Convert screen X to minutes
      const contentX = (screenX - TABLE_LABEL_WIDTH - txVal) / scaleVal
      const minutes = (contentX / contentWidth) * totalServiceMinutes + serviceStartHour * 60

      // Find which slot this falls into (30-minute slots)
      const slotDuration = 30
      for (const slot of occupancySlots) {
        const [hours, mins] = slot.time.split(':').map(Number)
        const slotStart = hours * 60 + mins
        const slotEnd = slotStart + slotDuration

        if (minutes >= slotStart && minutes < slotEnd) {
          setTouchedSlot({
            time: slot.time,
            covers: slot.covers,
            x: screenX,
            y: screenY,
          })
          return
        }
      }

      setTouchedSlot(null)
    },
    [occupancySlots, contentWidth, totalServiceMinutes, serviceStartHour]
  )

  // Long press handler - start drag
  const performLongPressHitTest = useCallback(
    (
      relativeX: number,
      relativeY: number,
      absoluteX: number,
      absoluteY: number,
      scaleVal: number,
      txVal: number,
      tyVal: number
    ) => {
      const result = hitTestReservation(relativeX, relativeY, scaleVal, txVal, tyVal)
      if (result) {
        // Clear pressing state, now we're dragging
        setPressingReservationId(null)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        startDrag(result.reservation, result.barInfo, relativeX, relativeY, absoluteX, absoluteY)
        setDragState({
          isDragging: true,
          reservation: result.reservation,
          barInfo: result.barInfo,
          targetTableKey: null,
          targetTableName: null,
        })
      }
    },
    [hitTestReservation, startDrag]
  )

  // Get table name from key
  const getTableName = useCallback(
    (tableKey: string | null): string | null => {
      if (!tableKey) return null
      const layout = layouts.find((l) => l.tableKey === tableKey)
      return layout?.table?.table_number || tableKey
    },
    [layouts]
  )

  // Update drag position and target (table only)
  const performDragUpdate = useCallback(
    (absoluteX: number, absoluteY: number, tyVal: number) => {
      updateDrag(absoluteX, absoluteY, tyVal)
      const state = dragStateRef.current
      const targetTableName = getTableName(state.targetTableKey)

      setDragState((prev) => ({
        ...prev,
        targetTableKey: state.targetTableKey,
        targetTableName,
      }))
    },
    [updateDrag, getTableName]
  )

  // End drag
  const performDragEnd = useCallback(() => {
    endDrag()
    setDragState({
      isDragging: false,
      reservation: null,
      barInfo: null,
      targetTableKey: null,
      targetTableName: null,
    })
  }, [endDrag])

  // Tap gesture for selection
  const tapGesture = Gesture.Tap().onEnd((e) => {
    'worklet'
    runOnJS(performTapHitTest)(e.x, e.y, scale.value, translateX.value, translateY.value)
  })

  // Long press gesture to start drag
  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onTouchesDown((e) => {
      'worklet'
      if (e.allTouches.length === 1) {
        const touch = e.allTouches[0]
        // Check for pacing chart touch first
        runOnJS(performPacingTouch)(touch.x, touch.y, scale.value, translateX.value)
        // Then check for reservation press
        runOnJS(performTouchStart)(touch.x, touch.y, scale.value, translateX.value, translateY.value)
      }
    })
    .onTouchesMove((e) => {
      'worklet'
      if (e.allTouches.length === 1) {
        const touch = e.allTouches[0]
        // Update pacing chart touch position
        runOnJS(performPacingTouch)(touch.x, touch.y, scale.value, translateX.value)
      }
    })
    .onStart((e) => {
      'worklet'
      runOnJS(performLongPressHitTest)(
        e.x,
        e.y,
        e.absoluteX,
        e.absoluteY,
        scale.value,
        translateX.value,
        translateY.value
      )
    })
    .onTouchesUp(() => {
      'worklet'
      runOnJS(performTouchEnd)()
    })
    .onTouchesCancelled(() => {
      'worklet'
      runOnJS(performTouchEnd)()
    })

  // Drag gesture (pan while dragging)
  const dragGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((e, stateManager) => {
      'worklet'
      if (isDraggingShared.value) {
        stateManager.activate()
      }
    })
    .onUpdate((e) => {
      'worklet'
      if (isDraggingShared.value) {
        runOnJS(performDragUpdate)(e.absoluteX, e.absoluteY, translateY.value)
      }
    })
    .onEnd(() => {
      'worklet'
      if (isDraggingShared.value) {
        runOnJS(performDragEnd)()
      }
    })

  // Compose all gestures
  const longPressAndDrag = Gesture.Simultaneous(longPressGesture, dragGesture)
  const composedGesture = Gesture.Race(
    Gesture.Exclusive(longPressAndDrag, tapGesture),
    panZoomGesture
  )

  // Get current transform values for static rendering
  const [currentTransform, setCurrentTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })

  // Update transform state from shared values (for rendering)
  const updateTransformRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useMemo(() => {
    const update = () => {
      setCurrentTransform({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      })
    }

    if (updateTransformRef.current) {
      clearInterval(updateTransformRef.current)
    }
    updateTransformRef.current = setInterval(update, 16)

    return () => {
      if (updateTransformRef.current) {
        clearInterval(updateTransformRef.current)
      }
    }
  }, [scale, translateX, translateY])

  // Generate multi-level grid lines based on zoom scale
  const gridLines = useMemo(() => {
    const lines: { minutes: number; type: 'hour' | 'half' | 'quarter'; percent: number }[] = []
    const totalMinutes = (serviceEndHour - serviceStartHour) * 60
    const currentScale = currentTransform.scale

    for (let min = 0; min <= totalMinutes; min += 15) {
      const isHour = min % 60 === 0
      const isHalf = min % 30 === 0

      // Determine if this line should be shown based on zoom level
      if (isHour) {
        lines.push({ minutes: min, type: 'hour', percent: (min / totalMinutes) * 100 })
      } else if (isHalf && currentScale >= GRID_THRESHOLDS.showHalfHour) {
        lines.push({ minutes: min, type: 'half', percent: (min / totalMinutes) * 100 })
      } else if (currentScale >= GRID_THRESHOLDS.showQuarterHour) {
        lines.push({ minutes: min, type: 'quarter', percent: (min / totalMinutes) * 100 })
      }
    }
    return lines
  }, [serviceStartHour, serviceEndHour, currentTransform.scale])

  // Generate time labels (including :30 at high zoom)
  const timeLabels = useMemo(() => {
    const labels: { minutes: number; label: string; isHour: boolean; percent: number }[] = []
    const totalMinutes = (serviceEndHour - serviceStartHour) * 60
    const currentScale = currentTransform.scale

    for (let hour = serviceStartHour; hour <= serviceEndHour; hour++) {
      const hourMinutes = (hour - serviceStartHour) * 60
      const hourLabel = hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`
      labels.push({
        minutes: hourMinutes,
        label: hourLabel,
        isHour: true,
        percent: (hourMinutes / totalMinutes) * 100,
      })

      // Add :30 labels at high zoom
      if (currentScale >= GRID_THRESHOLDS.showHalfHourLabels && hour < serviceEndHour) {
        const halfMinutes = hourMinutes + 30
        labels.push({
          minutes: halfMinutes,
          label: ':30',
          isHour: false,
          percent: (halfMinutes / totalMinutes) * 100,
        })
      }
    }
    return labels
  }, [serviceStartHour, serviceEndHour, currentTransform.scale])

  // Build stepped area paths for occupancy graph
  const occupancyPaths = useMemo(() => {
    if (!occupancySlots || occupancySlots.length === 0) {
      return { pastPath: null, futurePath: null, borderPath: null, peakInfo: null }
    }

    const graphHeight = OCCUPANCY_GRAPH_HEIGHT - 8
    const graphTop = 4
    const graphBottom = graphTop + graphHeight
    const { scale: s, translateX: tx } = currentTransform

    // Parse slot time to minutes
    const parseSlotTime = (time: string) => {
      const [hours, mins] = time.split(':').map(Number)
      return hours * 60 + mins
    }

    // Convert minutes to screen X coordinate
    const minutesToX = (minutes: number) => {
      const baseX = ((minutes - serviceStartHour * 60) / totalServiceMinutes) * contentWidth
      return TABLE_LABEL_WIDTH + baseX * s + tx
    }

    // Calculate Y for covers
    const coversToY = (covers: number) => {
      return graphBottom - (covers / graphScale) * graphHeight
    }

    // Find peak slot
    let peakSlot = occupancySlots[0]
    let peakIndex = 0
    occupancySlots.forEach((slot, i) => {
      if (slot.covers > peakSlot.covers) {
        peakSlot = slot
        peakIndex = i
      }
    })

    // Build the stepped path - split at NOW
    const nowX = minutesToX(nowMinutes)
    const slotDuration = 30 // 30-minute slots

    // Create path builder for past (before NOW)
    const pastPath = Skia.Path.Make()
    const futurePath = Skia.Path.Make()
    const borderPath = Skia.Path.Make()

    let isFirstPast = true
    let isFirstFuture = true
    let lastX = TABLE_LABEL_WIDTH
    let lastY = graphBottom

    occupancySlots.forEach((slot, i) => {
      const slotMinutes = parseSlotTime(slot.time)
      const slotEndMinutes = slotMinutes + slotDuration
      const x1 = minutesToX(slotMinutes)
      const x2 = minutesToX(slotEndMinutes)
      const y = coversToY(slot.covers)

      const slotEndBeforeNow = slotEndMinutes <= nowMinutes
      const slotStartAfterNow = slotMinutes >= nowMinutes
      const slotSpansNow = slotMinutes < nowMinutes && slotEndMinutes > nowMinutes

      if (slotEndBeforeNow || slotSpansNow) {
        // Add to past path
        if (isFirstPast) {
          pastPath.moveTo(x1, graphBottom)
          isFirstPast = false
        }
        pastPath.lineTo(x1, y)
        if (slotSpansNow) {
          pastPath.lineTo(nowX, y)
          pastPath.lineTo(nowX, graphBottom)
        } else {
          pastPath.lineTo(x2, y)
        }
      }

      if (slotStartAfterNow || slotSpansNow) {
        // Add to future path
        if (isFirstFuture) {
          const startX = slotSpansNow ? nowX : x1
          futurePath.moveTo(startX, graphBottom)
          isFirstFuture = false
        }
        const startX = slotSpansNow ? nowX : x1
        futurePath.lineTo(startX, y)
        futurePath.lineTo(x2, y)
      }

      // Border path (full outline on top)
      if (i === 0) {
        borderPath.moveTo(x1, y)
      } else {
        borderPath.lineTo(x1, y)
      }
      borderPath.lineTo(x2, y)

      lastX = x2
      lastY = y
    })

    // Close paths
    if (!isFirstPast) {
      pastPath.close()
    }
    if (!isFirstFuture) {
      futurePath.lineTo(lastX, graphBottom)
      futurePath.close()
    }

    // Peak info for annotation
    const peakMinutes = parseSlotTime(peakSlot.time)
    const peakX = minutesToX(peakMinutes + slotDuration / 2) // Center of peak slot
    const peakY = coversToY(peakSlot.covers)

    return {
      pastPath,
      futurePath,
      borderPath,
      peakInfo: {
        x: peakX,
        y: peakY,
        covers: peakSlot.covers,
      },
    }
  }, [occupancySlots, graphScale, currentTransform.scale, currentTransform.translateX, serviceStartHour, totalServiceMinutes, contentWidth, nowMinutes])

  // Animated style for drag preview
  const dragPreviewStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: dragX.value - 60,
    top: dragY.value - BAR_MIN_HEIGHT / 2 - 8,
    opacity: isDraggingShared.value ? 1 : 0,
    transform: [{ scale: isDraggingShared.value ? 1.05 : 1 }],
  }))

  // Don't render until we have dimensions
  if (viewportSize.width === 0 || viewportSize.height === 0) {
    return <View style={styles.container} onLayout={handleLayout} />
  }

  const { scale: s, translateX: tx, translateY: ty } = currentTransform

  // Get status color for dragged reservation
  const getDragPreviewColor = () => {
    if (!dragState.reservation) return Neo.blue
    return STATUS_BAR_COLORS[dragState.reservation.status] || Neo.blue
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.canvasWrapper}>
          <Canvas style={styles.canvas}>
            {/* Background */}
            <Rect x={0} y={0} width={viewportSize.width} height={viewportSize.height} color={Neo.cream} />

            {/* === FIXED LEFT COLUMN (Table Labels) === */}
            <Group clip={rect(0, headerHeight, TABLE_LABEL_WIDTH, viewportSize.height - headerHeight)}>
              <Rect
                x={0}
                y={headerHeight}
                width={TABLE_LABEL_WIDTH}
                height={viewportSize.height - headerHeight}
                color={Neo.cream}
              />

              <Group transform={[{ translateY: ty }]}>
                {layouts.map((layout, i) => {
                  const y = rowYPositions[i]
                  const centerY = headerHeight + y + layout.rowHeight / 2
                  const tableName = layout.table?.table_number || layout.tableKey
                  const tableCapacity = layout.table?.max_capacity || 0
                  const isDropTarget = dragState.isDragging && dragState.targetTableKey === layout.tableKey
                  return (
                    <Group key={layout.tableKey}>
                      {isDropTarget && (
                        <Rect
                          x={0}
                          y={headerHeight + y}
                          width={TABLE_LABEL_WIDTH}
                          height={layout.rowHeight}
                          color={Neo.lime + '60'}
                        />
                      )}
                      <SkiaText
                        x={8}
                        y={centerY + 4}
                        text={tableName}
                        font={tableLabelFont}
                        color={Neo.black}
                      />
                      {tableCapacity > 0 && (
                        <SkiaText
                          x={8}
                          y={centerY + 16}
                          text={`${tableCapacity} seats`}
                          font={barLabelFont}
                          color={Neo.black + '80'}
                        />
                      )}
                      <Line
                        p1={vec(0, headerHeight + y + layout.rowHeight)}
                        p2={vec(TABLE_LABEL_WIDTH, headerHeight + y + layout.rowHeight)}
                        color={Neo.black + '20'}
                        strokeWidth={1}
                      />
                    </Group>
                  )
                })}
              </Group>

              <Line
                p1={vec(TABLE_LABEL_WIDTH - 1, headerHeight)}
                p2={vec(TABLE_LABEL_WIDTH - 1, viewportSize.height)}
                color={Neo.black}
                strokeWidth={NeoBorder.thin}
              />
            </Group>

            {/* === FIXED HEADER === */}
            <Group
              clip={rect(TABLE_LABEL_WIDTH, 0, viewportSize.width - TABLE_LABEL_WIDTH, headerHeight)}
            >
              <Rect
                x={TABLE_LABEL_WIDTH}
                y={0}
                width={viewportSize.width - TABLE_LABEL_WIDTH}
                height={OCCUPANCY_GRAPH_HEIGHT}
                color={Neo.white}
              />
              <Rect
                x={TABLE_LABEL_WIDTH}
                y={OCCUPANCY_GRAPH_HEIGHT}
                width={viewportSize.width - TABLE_LABEL_WIDTH}
                height={HOUR_MARKER_HEIGHT}
                color={Neo.cream}
              />

              {/* Occupancy Graph - Stepped Area Chart */}
              {occupancyPaths.pastPath && (
                <Path
                  path={occupancyPaths.pastPath}
                  color={Neo.cyan + '66'}
                />
              )}
              {occupancyPaths.futurePath && (
                <Path
                  path={occupancyPaths.futurePath}
                  color={Neo.cyan + 'CC'}
                />
              )}
              {occupancyPaths.borderPath && (
                <Path
                  path={occupancyPaths.borderPath}
                  color={Neo.black}
                  style="stroke"
                  strokeWidth={2}
                />
              )}

              {/* Y-axis labels for occupancy graph */}
              {graphScale > 0 && (
                <>
                  {/* Max value at top */}
                  <SkiaText
                    x={TABLE_LABEL_WIDTH + 4}
                    y={12}
                    text={String(graphScale)}
                    font={barLabelFont}
                    color={Neo.black + '80'}
                  />
                  {/* Zero at bottom */}
                  <SkiaText
                    x={TABLE_LABEL_WIDTH + 4}
                    y={OCCUPANCY_GRAPH_HEIGHT - 4}
                    text="0"
                    font={barLabelFont}
                    color={Neo.black + '80'}
                  />
                </>
              )}

              {/* Capacity reference line */}
              {totalCapacity && totalCapacity > 0 && graphScale > 0 && (() => {
                const graphHeight = OCCUPANCY_GRAPH_HEIGHT - 8
                const graphBottom = 4 + graphHeight
                const capacityY = graphBottom - (totalCapacity / graphScale) * graphHeight
                // Only show if capacity is within visible range
                if (capacityY >= 4 && capacityY <= graphBottom) {
                  return (
                    <Line
                      p1={vec(TABLE_LABEL_WIDTH + tx, capacityY)}
                      p2={vec(TABLE_LABEL_WIDTH + contentWidth * s + tx, capacityY)}
                      color={Neo.black + '40'}
                      strokeWidth={1}
                    />
                  )
                }
                return null
              })()}

              {/* NOW line in occupancy graph */}
              {showNow && (
                <Line
                  p1={vec(TABLE_LABEL_WIDTH + nowX * s + tx, 4)}
                  p2={vec(TABLE_LABEL_WIDTH + nowX * s + tx, OCCUPANCY_GRAPH_HEIGHT)}
                  color={Neo.pink}
                  strokeWidth={2}
                />
              )}

              {/* Peak annotation */}
              {occupancyPaths.peakInfo && occupancyPaths.peakInfo.covers > 0 && (
                <SkiaText
                  x={occupancyPaths.peakInfo.x - 8}
                  y={occupancyPaths.peakInfo.y - 4}
                  text={String(occupancyPaths.peakInfo.covers)}
                  font={barLabelFont}
                  color={Neo.black}
                />
              )}

              {/* Time markers with grid lines through pacing chart */}
              {timeLabels.map(({ minutes, percent, label, isHour }) => {
                const baseX = (percent / 100) * contentWidth
                const x = TABLE_LABEL_WIDTH + baseX * s + tx
                return (
                  <Group key={`time-${minutes}`}>
                    {/* Grid line through entire header (pacing + hour markers) */}
                    <Line
                      p1={vec(x, 4)}
                      p2={vec(x, headerHeight)}
                      color={Neo.black + (isHour ? '20' : '10')}
                      strokeWidth={1}
                    />
                    <SkiaText
                      x={x + 4}
                      y={OCCUPANCY_GRAPH_HEIGHT + 14}
                      text={label}
                      font={hourLabelFont}
                      color={isHour ? Neo.black : Neo.black + '80'}
                    />
                  </Group>
                )
              })}

              <Line
                p1={vec(TABLE_LABEL_WIDTH, OCCUPANCY_GRAPH_HEIGHT)}
                p2={vec(viewportSize.width, OCCUPANCY_GRAPH_HEIGHT)}
                color={Neo.black}
                strokeWidth={NeoBorder.thin}
              />
              <Line
                p1={vec(TABLE_LABEL_WIDTH, headerHeight)}
                p2={vec(viewportSize.width, headerHeight)}
                color={Neo.black}
                strokeWidth={NeoBorder.thin}
              />
            </Group>

            {/* === SCROLLABLE CONTENT AREA === */}
            <Group
              clip={rect(
                TABLE_LABEL_WIDTH,
                headerHeight,
                viewportSize.width - TABLE_LABEL_WIDTH,
                viewportSize.height - headerHeight
              )}
            >
              {/* Table row backgrounds (render first so grid lines appear on top) */}
              {layouts.map((layout, i) => {
                const y = headerHeight + rowYPositions[i] + ty
                const scaledContentWidth = contentWidth * s
                const isDropTarget = dragState.isDragging && dragState.targetTableKey === layout.tableKey
                return (
                  <Group key={layout.tableKey}>
                    <Rect
                      x={TABLE_LABEL_WIDTH + tx}
                      y={y}
                      width={scaledContentWidth}
                      height={layout.rowHeight}
                      color={isDropTarget ? Neo.lime + '40' : Neo.white}
                    />
                    {isDropTarget && (
                      <Rect
                        x={TABLE_LABEL_WIDTH + tx}
                        y={y}
                        width={scaledContentWidth}
                        height={layout.rowHeight}
                        color={Neo.lime}
                        style="stroke"
                        strokeWidth={3}
                      />
                    )}
                    <Line
                      p1={vec(TABLE_LABEL_WIDTH + tx, y + layout.rowHeight)}
                      p2={vec(TABLE_LABEL_WIDTH + tx + scaledContentWidth, y + layout.rowHeight)}
                      color={Neo.black + '20'}
                      strokeWidth={1}
                    />
                  </Group>
                )
              })}

              {/* Grid lines (rendered after row backgrounds so they're visible) */}
              {gridLines.map(({ minutes, type, percent }) => {
                const baseX = (percent / 100) * contentWidth
                const x = TABLE_LABEL_WIDTH + baseX * s + tx
                const opacity = type === 'hour' ? GRID_OPACITY.hour
                  : type === 'half' ? GRID_OPACITY.halfHour
                  : GRID_OPACITY.quarterHour
                return (
                  <Line
                    key={`grid-${minutes}`}
                    p1={vec(x, headerHeight + ty)}
                    p2={vec(x, headerHeight + totalRowHeight + ty)}
                    color={Neo.black + opacity}
                    strokeWidth={1}
                  />
                )
              })}

              {/* Reservation bars */}
              {layouts.map((layout, layoutIdx) => {
                const rowY = headerHeight + rowYPositions[layoutIdx] + ty
                return layout.bars.map((bar) => {
                  const baseX = (bar.startPercent / 100) * contentWidth
                  const x = TABLE_LABEL_WIDTH + baseX * s + tx
                  const width = (bar.widthPercent / 100) * contentWidth * s
                  const y = rowY + ROW_PADDING + bar.laneIndex * (BAR_MIN_HEIGHT + LANE_GAP)
                  const isSelected = selectedReservationId === bar.reservation.id
                  const isDragSource =
                    dragState.isDragging && dragState.reservation?.id === bar.reservation.id
                  const isPressing = pressingReservationId === bar.reservation.id
                  const bgColor = STATUS_BAR_COLORS[bar.reservation.status] || Neo.blue
                  const textColor = getTextColor(bgColor)

                  // Format label
                  const guestName = bar.reservation.name || 'Guest'
                  const truncatedName =
                    guestName.length > 12 ? guestName.slice(0, 11) + '…' : guestName
                  const label = `${truncatedName} · ${bar.reservation.covers}`

                  // Ghost style when being dragged
                  const opacity = isDragSource ? '40' : ''
                  const finalBgColor = isDragSource ? bgColor + opacity : bgColor

                  // Pressing state: yellow border, larger shadow
                  const shadowOff = isPressing ? 6 : isSelected ? 6 : SHADOW_OFFSET
                  const borderW = isPressing ? 3 : isSelected ? 3 : BORDER_WIDTH
                  const borderColor = isDragSource
                    ? Neo.black + '40'
                    : isPressing
                    ? Neo.yellow
                    : isSelected
                    ? Neo.yellow
                    : Neo.black

                  return (
                    <Group key={bar.reservation.id}>
                      {/* Shadow - hidden when ghost, larger when pressing */}
                      {!isDragSource && (
                        <Rect
                          x={x + shadowOff}
                          y={y + shadowOff}
                          width={width}
                          height={BAR_MIN_HEIGHT}
                          color={Neo.black}
                        />
                      )}
                      {/* Pressing glow effect */}
                      {isPressing && (
                        <Rect
                          x={x - 2}
                          y={y - 2}
                          width={width + 4}
                          height={BAR_MIN_HEIGHT + 4}
                          color={Neo.yellow + '60'}
                        />
                      )}
                      {/* Fill */}
                      <Rect x={x} y={y} width={width} height={BAR_MIN_HEIGHT} color={finalBgColor} />
                      {/* Border */}
                      <Rect
                        x={x}
                        y={y}
                        width={width}
                        height={BAR_MIN_HEIGHT}
                        color={borderColor}
                        style="stroke"
                        strokeWidth={isDragSource ? 1 : borderW}
                      />
                      {/* Label - hidden when ghost */}
                      {width > 40 && !isDragSource && (
                        <SkiaText
                          x={x + 6}
                          y={y + BAR_MIN_HEIGHT / 2 + 4}
                          text={label}
                          font={barLabelFont}
                          color={textColor}
                        />
                      )}
                    </Group>
                  )
                })
              })}

              {/* NOW line */}
              {showNow &&
                (() => {
                  const nowScreenX = TABLE_LABEL_WIDTH + nowX * s + tx
                  return (
                    <Group>
                      <Line
                        p1={vec(nowScreenX, headerHeight + ty)}
                        p2={vec(nowScreenX, headerHeight + totalRowHeight + ty)}
                        color={Neo.pink}
                        strokeWidth={3}
                      />
                      <Rect
                        x={nowScreenX - 6}
                        y={headerHeight + ty - 6}
                        width={12}
                        height={12}
                        color={Neo.pink}
                        transform={[{ rotate: Math.PI / 4 }]}
                        origin={vec(nowScreenX, headerHeight + ty)}
                      />
                    </Group>
                  )
                })()}
            </Group>

            {/* === CORNER === */}
            <Rect x={0} y={0} width={TABLE_LABEL_WIDTH} height={headerHeight} color={Neo.cream} />
            <Line
              p1={vec(0, OCCUPANCY_GRAPH_HEIGHT)}
              p2={vec(TABLE_LABEL_WIDTH, OCCUPANCY_GRAPH_HEIGHT)}
              color={Neo.black}
              strokeWidth={NeoBorder.thin}
            />
            <Line
              p1={vec(0, headerHeight)}
              p2={vec(TABLE_LABEL_WIDTH, headerHeight)}
              color={Neo.black}
              strokeWidth={NeoBorder.thin}
            />
            <Line
              p1={vec(TABLE_LABEL_WIDTH - 1, 0)}
              p2={vec(TABLE_LABEL_WIDTH - 1, headerHeight)}
              color={Neo.black}
              strokeWidth={NeoBorder.thin}
            />

            {/* === PACING CHART TOOLTIP (rendered last to be on top) === */}
            {touchedSlot && (
              <Group>
                {/* Shadow */}
                <Rect
                  x={touchedSlot.x - 28}
                  y={OCCUPANCY_GRAPH_HEIGHT + 6}
                  width={60}
                  height={22}
                  color={Neo.black}
                />
                {/* Tooltip background */}
                <Rect
                  x={touchedSlot.x - 30}
                  y={OCCUPANCY_GRAPH_HEIGHT + 4}
                  width={60}
                  height={22}
                  color={Neo.yellow}
                />
                <Rect
                  x={touchedSlot.x - 30}
                  y={OCCUPANCY_GRAPH_HEIGHT + 4}
                  width={60}
                  height={22}
                  color={Neo.black}
                  style="stroke"
                  strokeWidth={2}
                />
                {/* Tooltip text */}
                <SkiaText
                  x={touchedSlot.x - 26}
                  y={OCCUPANCY_GRAPH_HEIGHT + 18}
                  text={`${touchedSlot.time} · ${touchedSlot.covers}`}
                  font={barLabelFont}
                  color={Neo.black}
                />
                {/* Vertical indicator line through entire timeline */}
                <Line
                  p1={vec(touchedSlot.x, 4)}
                  p2={vec(touchedSlot.x, viewportSize.height)}
                  color={Neo.black + '60'}
                  strokeWidth={1}
                />
              </Group>
            )}
          </Canvas>
        </View>
      </GestureDetector>

      {/* Drag preview overlay - styled like a timeline bar */}
      {dragState.isDragging && dragState.reservation && (
        <Animated.View style={[styles.dragPreview, dragPreviewStyle]} pointerEvents="none">
          <View
            style={[
              styles.dragPreviewBar,
              { backgroundColor: getDragPreviewColor(), minWidth: Math.min(dragState.barInfo?.width || 120, 160) },
            ]}
          >
            <RNText style={[styles.dragPreviewName, { color: getTextColor(getDragPreviewColor()) }]}>
              {dragState.reservation.name || 'Guest'}
            </RNText>
            <RNText style={[styles.dragPreviewDetails, { color: getTextColor(getDragPreviewColor()) }]}>
              {dragState.reservation.covers} · {dragState.reservation.time}
            </RNText>
          </View>

          {/* Target table feedback badge */}
          {dragState.targetTableName && (
            <View style={styles.targetFeedback}>
              <View style={styles.targetBadge}>
                <RNText style={styles.targetLabel}>
                  → {dragState.targetTableName}
                </RNText>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <View style={styles.savingOverlay}>
          <View style={styles.savingBadge}>
            <ActivityIndicator size="small" color={Neo.black} />
            <RNText style={styles.savingText}>SAVING...</RNText>
          </View>
        </View>
      )}

      {/* Error message */}
      {saveError && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorBadge}>
            <RNText style={styles.errorText}>{saveError}</RNText>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  dragPreview: {
    position: 'absolute',
    zIndex: 1000,
  },
  dragPreviewBar: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: Neo.black,
    shadowColor: Neo.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  dragPreviewName: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    fontWeight: 'bold',
  },
  dragPreviewDetails: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
  },
  targetFeedback: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  targetBadge: {
    backgroundColor: Neo.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: Neo.black,
  },
  targetLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: 'bold',
    color: Neo.black,
  },
  savingOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Neo.yellow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: Neo.black,
  },
  savingText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: 'bold',
    color: Neo.black,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  errorBadge: {
    backgroundColor: Neo.pink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: Neo.black,
  },
  errorText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    fontWeight: 'bold',
    color: Neo.black,
    textAlign: 'center',
  },
})
