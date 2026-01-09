import { useMemo, useCallback, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { Canvas, Group, Rect, Circle, Text as SkiaText, matchFont, Image as SkiaImage, useImage } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, runOnJS, withDecay, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { differenceInSeconds, parseISO } from 'date-fns'

import { Neo } from '@/constants/theme'
import type { TableWithStatus, FloorPlanElement } from '@/lib/types'
import type { SkFont } from '@shopify/react-native-skia'

import type { SkiaFloorPlanCanvasProps, TransformState, ServerAssignmentRecord, TableTapResult, SkiaFloorPlanCanvasRef } from './types'
import {
  REFERENCE_WIDTH,
  TABLE_NUMBER_FONT_SIZE,
  TABLE_CAPACITY_FONT_SIZE,
  BADGE_FONT_SIZE,
  ELEMENT_LABEL_FONT_SIZE,
  TABLE_MIN_WIDTH,
  TABLE_MIN_HEIGHT,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_SCALE,
} from './constants'

// Calculate table dimensions from percentage positions
function getTableDimensions(
  table: TableWithStatus,
  containerWidth: number,
  containerHeight: number
) {
  const posX = (table.position_x! / 100) * containerWidth
  const posY = (table.position_y! / 100) * containerHeight
  const scaleRef = Math.min(containerWidth, containerHeight) / REFERENCE_WIDTH
  const scaledWidth = Math.max(table.width * scaleRef, TABLE_MIN_WIDTH)
  const scaledHeight =
    table.shape === 'SQUARE' || table.shape === 'CIRCLE'
      ? scaledWidth
      : Math.max(table.height * scaleRef, TABLE_MIN_HEIGHT)
  return { posX, posY, scaledWidth, scaledHeight }
}

// Check if a point is inside a table (for hit testing)
function isPointInTable(
  x: number,
  y: number,
  table: TableWithStatus,
  containerWidth: number,
  containerHeight: number
): boolean {
  const { posX, posY, scaledWidth, scaledHeight } = getTableDimensions(
    table,
    containerWidth,
    containerHeight
  )

  const rotation = (table.rotation || 0) * (Math.PI / 180)
  const halfW = scaledWidth / 2
  const halfH = scaledHeight / 2

  // Translate point to table's local coordinate system
  const dx = x - posX
  const dy = y - posY

  // Rotate point by negative rotation to align with table
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  const shape = table.shape || 'RECTANGLE'

  switch (shape) {
    case 'CIRCLE':
      return localX * localX + localY * localY <= halfW * halfW
    case 'OVAL':
      return (localX * localX) / (halfW * halfW) + (localY * localY) / (halfH * halfH) <= 1
    case 'RECTANGLE':
    case 'SQUARE':
    case 'BAR':
    default:
      return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH
  }
}

// Clamp helper for worklets
function clamp(value: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, value))
}

// Calculate bounding box of all tables and elements
function calculateContentBounds(
  tables: TableWithStatus[],
  elements: FloorPlanElement[],
  containerWidth: number,
  containerHeight: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (tables.length === 0 && elements.length === 0) {
    return { minX: 0, minY: 0, maxX: containerWidth, maxY: containerHeight }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  // Include tables
  for (const table of tables) {
    if (table.position_x == null || table.position_y == null) continue

    const { posX, posY, scaledWidth, scaledHeight } = getTableDimensions(
      table,
      containerWidth,
      containerHeight
    )

    const halfW = scaledWidth / 2
    const halfH = scaledHeight / 2

    minX = Math.min(minX, posX - halfW)
    minY = Math.min(minY, posY - halfH)
    maxX = Math.max(maxX, posX + halfW)
    maxY = Math.max(maxY, posY + halfH)
  }

  // Include floor plan elements
  for (const element of elements) {
    if (!element.active) continue

    const posX = (element.position_x / 100) * containerWidth
    const posY = (element.position_y / 100) * containerHeight
    const scaleRef = Math.min(containerWidth, containerHeight) / REFERENCE_WIDTH
    const scaledWidth = Math.max(element.width * scaleRef, 20)
    const scaledHeight = Math.max(element.height * scaleRef, 20)

    const halfW = scaledWidth / 2
    const halfH = scaledHeight / 2

    minX = Math.min(minX, posX - halfW)
    minY = Math.min(minY, posY - halfH)
    maxX = Math.max(maxX, posX + halfW)
    maxY = Math.max(maxY, posY + halfH)
  }

  // Handle case where no valid items were found
  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: containerWidth, maxY: containerHeight }
  }

  // Add padding
  const PADDING = 40
  return {
    minX: minX - PADDING,
    minY: minY - PADDING,
    maxX: maxX + PADDING,
    maxY: maxY + PADDING,
  }
}

// Calculate transform to fit content in viewport
function calculateFitTransform(
  tables: TableWithStatus[],
  elements: FloorPlanElement[],
  containerWidth: number,
  containerHeight: number
): { scale: number; translateX: number; translateY: number } {
  const bounds = calculateContentBounds(tables, elements, containerWidth, containerHeight)
  const contentWidth = bounds.maxX - bounds.minX
  const contentHeight = bounds.maxY - bounds.minY

  // Calculate scale to fit
  const scaleX = containerWidth / contentWidth
  const scaleY = containerHeight / contentHeight
  const fitScale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE)

  // Calculate translation to center the content
  const scaledContentWidth = contentWidth * fitScale
  const scaledContentHeight = contentHeight * fitScale
  const translateX = (containerWidth - scaledContentWidth) / 2 - bounds.minX * fitScale
  const translateY = (containerHeight - scaledContentHeight) / 2 - bounds.minY * fitScale

  return { scale: fitScale, translateX, translateY }
}

// Font configuration
const fontFamily = Platform.select({ ios: 'Menlo', default: 'monospace' })

const tableNumberFont = matchFont({
  fontFamily,
  fontSize: TABLE_NUMBER_FONT_SIZE,
  fontWeight: 'bold',
})

const capacityFont = matchFont({
  fontFamily,
  fontSize: TABLE_CAPACITY_FONT_SIZE,
  fontWeight: 'normal',
})

const badgeFont = matchFont({
  fontFamily,
  fontSize: BADGE_FONT_SIZE,
  fontWeight: 'bold',
})

// Larger fonts for redesigned turn time badge
const badgeNameFont = matchFont({
  fontFamily,
  fontSize: 13,
  fontWeight: '800',
})

const badgeTimeFont = matchFont({
  fontFamily,
  fontSize: 14,
  fontWeight: '800',
})

// Small font for tag indicators on tables
const tagIndicatorFont = matchFont({
  fontFamily,
  fontSize: 10,
  fontWeight: '800',
})

const elementLabelFont = matchFont({
  fontFamily,
  fontSize: ELEMENT_LABEL_FONT_SIZE,
  fontWeight: 'normal',
})

export const SkiaFloorPlanCanvas = forwardRef<SkiaFloorPlanCanvasRef, SkiaFloorPlanCanvasProps>(
  function SkiaFloorPlanCanvas({
    tables,
    elements,
    selectedTableId,
    pressedTableId,
    serverAssignments,
    mode,
    containerWidth,
    containerHeight,
    onTableTap,
    onTableLongPress,
    onBackgroundTap,
    onPressIn,
    onPressOut,
    selectedServerId,
    pendingServerAssignments,
    highlightedTableIds = [],
    currentTime,
  }, ref) {
  // Filter tables with valid positions
  const positionedTables = useMemo(
    () => tables.filter((t) => t.position_x != null && t.position_y != null),
    [tables]
  )

  // Create set of highlighted table IDs for efficient lookup
  const highlightedSet = useMemo(
    () => new Set(highlightedTableIds),
    [highlightedTableIds]
  )

  // Filter active elements
  const activeElements = useMemo(
    () => elements.filter((e) => e.active),
    [elements]
  )

  // Refs for tables and elements (used in callbacks)
  const tablesRef = useRef(positionedTables)
  tablesRef.current = positionedTables
  const elementsRef = useRef(activeElements)
  elementsRef.current = activeElements

  // Content dimensions
  const contentWidth = containerWidth
  const contentHeight = containerHeight

  // Calculate initial fit transform
  const initialFit = useMemo(
    () => calculateFitTransform(positionedTables, activeElements, containerWidth, containerHeight),
    [positionedTables, activeElements, containerWidth, containerHeight]
  )

  // Transform shared values for pan/zoom
  const scale = useSharedValue(initialFit.scale)
  const translateX = useSharedValue(initialFit.translateX)
  const translateY = useSharedValue(initialFit.translateY)
  const savedScale = useSharedValue(initialFit.scale)
  const savedTranslateX = useSharedValue(initialFit.translateX)
  const savedTranslateY = useSharedValue(initialFit.translateY)
  const focalX = useSharedValue(0)
  const focalY = useSharedValue(0)

  // Track if initial fit has been applied
  const hasInitialized = useRef(false)

  // Current transform state for rendering (polled from shared values)
  const [currentTransform, setCurrentTransform] = useState<TransformState>({
    scale: initialFit.scale,
    translateX: initialFit.translateX,
    translateY: initialFit.translateY,
  })

  // Highlight pulse animation (0 to 1, repeating)
  const highlightPulse = useSharedValue(0)
  const [pulseValue, setPulseValue] = useState(0)

  // Start/stop pulse animation when highlights change
  useEffect(() => {
    if (highlightedTableIds.length > 0) {
      // Start pulsing animation
      highlightPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1 // infinite
      )
    } else {
      // Stop animation
      highlightPulse.value = withTiming(0, { duration: 200 })
    }
  }, [highlightedTableIds.length > 0])

  // Apply initial fit on first render and when content changes significantly
  useEffect(() => {
    if (!hasInitialized.current && (positionedTables.length > 0 || activeElements.length > 0)) {
      const fit = calculateFitTransform(positionedTables, activeElements, containerWidth, containerHeight)
      scale.value = fit.scale
      translateX.value = fit.translateX
      translateY.value = fit.translateY
      savedScale.value = fit.scale
      savedTranslateX.value = fit.translateX
      savedTranslateY.value = fit.translateY
      hasInitialized.current = true
    }
  }, [positionedTables, activeElements, containerWidth, containerHeight, scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY])

  // Poll transform and animation values at 60fps for rendering
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTransform({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      })
      setPulseValue(highlightPulse.value)
    }, 16)
    return () => clearInterval(interval)
  }, [scale, translateX, translateY, highlightPulse])

  // Hit test function - takes transform values as parameters
  // Returns table with its screen position for action card positioning
  const performHitTest = useCallback(
    (
      screenX: number,
      screenY: number,
      scaleVal: number,
      txVal: number,
      tyVal: number
    ): TableTapResult | null => {
      // Convert screen to content coordinates
      const contentX = (screenX - txVal) / scaleVal
      const contentY = (screenY - tyVal) / scaleVal

      // Check tables in reverse order (top tables first)
      for (let i = tablesRef.current.length - 1; i >= 0; i--) {
        const table = tablesRef.current[i]
        if (isPointInTable(contentX, contentY, table, contentWidth, contentHeight)) {
          // Calculate table's center position in screen coordinates
          const { posX, posY } = getTableDimensions(table, contentWidth, contentHeight)
          const tableScreenX = posX * scaleVal + txVal
          const tableScreenY = posY * scaleVal + tyVal
          return { table, screenX: tableScreenX, screenY: tableScreenY }
        }
      }
      return null
    },
    [contentWidth, contentHeight]
  )

  // Tap handler - receives transform values from worklet
  const handleTapHitTest = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const result = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (result) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onTableTap(result)
      } else {
        onBackgroundTap()
      }
    },
    [performHitTest, onTableTap, onBackgroundTap]
  )

  // Long press handler
  const handleLongPressHitTest = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const result = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (result) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onTableLongPress(result.table)
      }
    },
    [performHitTest, onTableLongPress]
  )

  // Touch start handler (for press visual feedback)
  const handleTouchStart = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const result = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (result) {
        onPressIn(result.table.id)
      }
    },
    [performHitTest, onPressIn]
  )

  // Touch end handler
  const handleTouchEnd = useCallback(() => {
    onPressOut()
  }, [onPressOut])

  // Reset to fit-to-content (called from double-tap)
  const resetToFit = useCallback(() => {
    const fit = calculateFitTransform(tablesRef.current, elementsRef.current, containerWidth, containerHeight)
    const timingConfig = { duration: 300, easing: Easing.out(Easing.cubic) }

    scale.value = withTiming(fit.scale, timingConfig)
    translateX.value = withTiming(fit.translateX, timingConfig)
    translateY.value = withTiming(fit.translateY, timingConfig)
    savedScale.value = fit.scale
    savedTranslateX.value = fit.translateX
    savedTranslateY.value = fit.translateY

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [containerWidth, containerHeight, scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY])

  // Zoom to center a specific table (for phone auto-zoom)
  const zoomToTable = useCallback((tableId: number, targetScale: number = 1.5) => {
    const table = tablesRef.current.find(t => t.id === tableId)
    if (!table) return

    const { posX, posY } = getTableDimensions(table, contentWidth, contentHeight)

    // Clamp target scale
    const newScale = clamp(targetScale, MIN_SCALE, MAX_SCALE)

    // Calculate translation to center the table on screen
    const targetTx = containerWidth / 2 - posX * newScale
    const targetTy = containerHeight / 2 - posY * newScale

    // Calculate scaled content bounds for clamping
    const scaledWidth = contentWidth * newScale
    const scaledHeight = contentHeight * newScale

    // Clamp translations to keep content visible
    let clampedTx = targetTx
    let clampedTy = targetTy

    if (scaledWidth <= containerWidth) {
      clampedTx = (containerWidth - scaledWidth) / 2
    } else {
      const minX = containerWidth - scaledWidth
      clampedTx = clamp(targetTx, minX, 0)
    }

    if (scaledHeight <= containerHeight) {
      clampedTy = (containerHeight - scaledHeight) / 2
    } else {
      const minY = containerHeight - scaledHeight
      clampedTy = clamp(targetTy, minY, 0)
    }

    // Animate with smooth timing
    const timingConfig = { duration: 300, easing: Easing.out(Easing.cubic) }
    scale.value = withTiming(newScale, timingConfig)
    translateX.value = withTiming(clampedTx, timingConfig)
    translateY.value = withTiming(clampedTy, timingConfig)

    // Update saved values for gesture continuity
    savedScale.value = newScale
    savedTranslateX.value = clampedTx
    savedTranslateY.value = clampedTy
  }, [contentWidth, contentHeight, containerWidth, containerHeight, scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY])

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    zoomToTable,
    resetView: resetToFit,
  }), [zoomToTable, resetToFit])

  // Track last tap time for manual double-tap detection
  const lastTapTime = useSharedValue(0)
  const lastTapX = useSharedValue(0)
  const lastTapY = useSharedValue(0)

  // Handle tap with manual double-tap detection (no delay!)
  const handleTapWithDoubleTapCheck = useCallback(
    (x: number, y: number, scaleVal: number, txVal: number, tyVal: number, tapTime: number, prevTapTime: number, prevX: number, prevY: number) => {
      const timeDiff = tapTime - prevTapTime
      const distance = Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2)

      // Double tap: within 300ms and 50px of last tap
      if (timeDiff < 300 && distance < 50) {
        resetToFit()
      } else {
        // Single tap - immediate!
        const result = performHitTest(x, y, scaleVal, txVal, tyVal)
        if (result) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onTableTap(result)
        } else {
          onBackgroundTap()
        }
      }
    },
    [resetToFit, performHitTest, onTableTap, onBackgroundTap]
  )

  // Single tap gesture - fires IMMEDIATELY
  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet'
      const now = Date.now()
      const prevTime = lastTapTime.value
      const prevX = lastTapX.value
      const prevY = lastTapY.value

      lastTapTime.value = now
      lastTapX.value = e.x
      lastTapY.value = e.y

      runOnJS(handleTapWithDoubleTapCheck)(
        e.x, e.y,
        scale.value, translateX.value, translateY.value,
        now, prevTime, prevX, prevY
      )
    })

  // Long press gesture
  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart((e) => {
      'worklet'
      runOnJS(handleLongPressHitTest)(e.x, e.y, scale.value, translateX.value, translateY.value)
    })

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Pan gesture for scrolling
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      'worklet'
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      'worklet'
      const scaledWidth = contentWidth * scale.value
      const scaledHeight = contentHeight * scale.value

      // Calculate bounds
      let newTx = savedTranslateX.value + e.translationX
      let newTy = savedTranslateY.value + e.translationY

      // Clamp X
      if (scaledWidth <= containerWidth) {
        newTx = (containerWidth - scaledWidth) / 2
      } else {
        const minX = containerWidth - scaledWidth
        newTx = clamp(newTx, minX, 0)
      }

      // Clamp Y
      if (scaledHeight <= containerHeight) {
        newTy = (containerHeight - scaledHeight) / 2
      } else {
        const minY = containerHeight - scaledHeight
        newTy = clamp(newTy, minY, 0)
      }

      translateX.value = newTx
      translateY.value = newTy
    })
    .onEnd((e) => {
      'worklet'
      const scaledWidth = contentWidth * scale.value
      const scaledHeight = contentHeight * scale.value

      // Calculate bounds for decay
      const minX = scaledWidth > containerWidth ? containerWidth - scaledWidth : (containerWidth - scaledWidth) / 2
      const maxX = scaledWidth > containerWidth ? 0 : (containerWidth - scaledWidth) / 2
      const minY = scaledHeight > containerHeight ? containerHeight - scaledHeight : (containerHeight - scaledHeight) / 2
      const maxY = scaledHeight > containerHeight ? 0 : (containerHeight - scaledHeight) / 2

      // Apply momentum with decay
      translateX.value = withDecay({
        velocity: e.velocityX,
        clamp: [minX, maxX],
        deceleration: 0.998,
      })
      translateY.value = withDecay({
        velocity: e.velocityY,
        clamp: [minY, maxY],
        deceleration: 0.998,
      })
    })

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet'
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
      focalX.value = e.focalX
      focalY.value = e.focalY
      runOnJS(triggerHaptic)()
    })
    .onUpdate((e) => {
      'worklet'
      const newScale = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE)
      const scaleChange = newScale / savedScale.value

      // Calculate new translations to keep focal point stationary
      const newTranslateX =
        savedTranslateX.value - (focalX.value - savedTranslateX.value) * (scaleChange - 1)
      const newTranslateY =
        savedTranslateY.value - (focalY.value - savedTranslateY.value) * (scaleChange - 1)

      scale.value = newScale

      // Clamp translations
      const scaledWidth = contentWidth * newScale
      const scaledHeight = contentHeight * newScale

      if (scaledWidth <= containerWidth) {
        translateX.value = (containerWidth - scaledWidth) / 2
      } else {
        const minX = containerWidth - scaledWidth
        translateX.value = clamp(newTranslateX, minX, 0)
      }

      if (scaledHeight <= containerHeight) {
        translateY.value = (containerHeight - scaledHeight) / 2
      } else {
        const minY = containerHeight - scaledHeight
        translateY.value = clamp(newTranslateY, minY, 0)
      }
    })
    .onEnd(() => {
      'worklet'
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  // Compose gestures:
  // - Pan and pinch happen simultaneously
  // - Tap fires immediately (double tap detected manually via timing)
  // - Long press runs simultaneously with tap
  const panZoomGesture = Gesture.Simultaneous(panGesture, pinchGesture)
  const composedGesture = Gesture.Race(
    Gesture.Simultaneous(tapGesture, longPressGesture),
    panZoomGesture
  )

  // Get effective server assignments (pending or saved)
  const getServerColor = useCallback(
    (tableId: number): string | undefined => {
      if (pendingServerAssignments && tableId in pendingServerAssignments) {
        const pending = pendingServerAssignments[tableId]
        return pending?.serverColor
      }
      return serverAssignments[tableId]?.serverColor
    },
    [serverAssignments, pendingServerAssignments]
  )

  // Don't render until we have valid dimensions
  if (containerWidth === 0 || containerHeight === 0) {
    return null
  }

  const { scale: s, translateX: tx, translateY: ty } = currentTransform

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          {/* Background */}
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} color={Neo.cream} />

          {/* Transformed content */}
          <Group transform={[{ translateX: tx }, { translateY: ty }, { scale: s }]}>
            {/* Dot grid background */}
            <Group>
              {useMemo(() => {
                const dots: React.ReactNode[] = []
                const DOT_SPACING = 24
                const DOT_RADIUS = 1.5

                for (let x = 0; x <= contentWidth; x += DOT_SPACING) {
                  for (let y = 0; y <= contentHeight; y += DOT_SPACING) {
                    dots.push(
                      <Circle
                        key={`dot-${x}-${y}`}
                        cx={x}
                        cy={y}
                        r={DOT_RADIUS}
                        color={Neo.black + '26'}
                      />
                    )
                  }
                }
                return dots
              }, [contentWidth, contentHeight])}
            </Group>

            {/* Floor plan elements (rendered behind tables) */}
            <Group>
              {useMemo(() => {
                const sortedElements = [...elements].sort((a, b) => a.z_index - b.z_index)
                return sortedElements.map((element) => (
                  <ElementRenderer
                    key={`element-${element.id}`}
                    element={element}
                    containerWidth={contentWidth}
                    containerHeight={contentHeight}
                    font={elementLabelFont}
                  />
                ))
              }, [elements, contentWidth, contentHeight])}
            </Group>

            {/* Tables (unselected first, then selected/highlighted) */}
            <Group>
              {positionedTables
                .filter((t) => t.id !== selectedTableId && !highlightedSet.has(t.id))
                .map((table) => (
                  <TableRenderer
                    key={`table-${table.id}`}
                    table={table}
                    isSelected={false}
                    isHighlighted={false}
                    highlightPulse={0}
                    isPressed={pressedTableId === table.id}
                    serverColor={getServerColor(table.id)}
                    containerWidth={contentWidth}
                    containerHeight={contentHeight}
                    fonts={{ tableNumber: tableNumberFont, capacity: capacityFont }}
                  />
                ))}
              {/* Highlighted tables (from list selection) */}
              {positionedTables
                .filter((t) => highlightedSet.has(t.id) && t.id !== selectedTableId)
                .map((table) => (
                  <TableRenderer
                    key={`table-${table.id}`}
                    table={table}
                    isSelected={false}
                    isHighlighted={true}
                    highlightPulse={pulseValue}
                    isPressed={pressedTableId === table.id}
                    serverColor={getServerColor(table.id)}
                    containerWidth={contentWidth}
                    containerHeight={contentHeight}
                    fonts={{ tableNumber: tableNumberFont, capacity: capacityFont }}
                  />
                ))}
              {/* Selected table on top */}
              {selectedTableId &&
                positionedTables
                  .filter((t) => t.id === selectedTableId)
                  .map((table) => (
                    <TableRenderer
                      key={`table-${table.id}`}
                      table={table}
                      isSelected={true}
                      isHighlighted={highlightedSet.has(table.id)}
                      highlightPulse={pulseValue}
                      isPressed={pressedTableId === table.id}
                      serverColor={getServerColor(table.id)}
                      containerWidth={contentWidth}
                      containerHeight={contentHeight}
                      fonts={{ tableNumber: tableNumberFont, capacity: capacityFont }}
                    />
                  ))}
            </Group>

            {/* Turn time badges */}
            <Group>
              {positionedTables
                .filter((t) => t.status === 'seated' && t.currentReservation?.seatedAt)
                .map((table) => (
                  <BadgeRenderer
                    key={`badge-${table.id}`}
                    table={table}
                    containerWidth={contentWidth}
                    containerHeight={contentHeight}
                    currentTime={currentTime}
                  />
                ))}
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  )
})

// ============================================================================
// Sub-components
// ============================================================================

interface TableRendererProps {
  table: TableWithStatus
  isSelected: boolean
  isHighlighted: boolean
  highlightPulse: number
  isPressed: boolean
  serverColor?: string
  containerWidth: number
  containerHeight: number
  fonts: { tableNumber: SkFont; capacity: SkFont }
}

function TableRenderer({
  table,
  isSelected,
  isHighlighted,
  highlightPulse,
  isPressed,
  serverColor,
  containerWidth,
  containerHeight,
  fonts,
}: TableRendererProps) {
  const { posX, posY, scaledWidth, scaledHeight } = useMemo(
    () => getTableDimensions(table, containerWidth, containerHeight),
    [table, containerWidth, containerHeight]
  )

  const rotation = table.rotation || 0
  const shape = table.shape || 'RECTANGLE'

  // Colors
  const STATUS_COLORS: Record<string, string> = {
    available: Neo.lime,
    seated: Neo.cyan,
    upcoming: Neo.orange,
    occupied: Neo.pink,
  }
  const fillColor = STATUS_COLORS[table.status] || Neo.lime
  const lightColors = [Neo.lime, Neo.cyan, Neo.yellow, Neo.white, Neo.cream]
  const textColor = lightColors.includes(fillColor) ? Neo.black : Neo.white
  const shadowOffset = isPressed ? 1 : 2
  const pressScale = isPressed ? 0.95 : 1

  // Border sizes (using layered fills approach)
  const blackBorderSize = 2
  const serverRingSize = 4
  const selectionRingSize = 3
  const highlightRingSize = 4

  const halfW = scaledWidth / 2
  const halfH = scaledHeight / 2

  // Calculate outer sizes for each layer
  const blackOuterW = halfW + blackBorderSize
  const blackOuterH = halfH + blackBorderSize
  const serverOuterW = blackOuterW + serverRingSize
  const serverOuterH = blackOuterH + serverRingSize
  const selectionOuterW = (serverColor ? serverOuterW : blackOuterW) + selectionRingSize
  const selectionOuterH = (serverColor ? serverOuterH : blackOuterH) + selectionRingSize
  const highlightOuterW = (serverColor ? serverOuterW : blackOuterW) + highlightRingSize
  const highlightOuterH = (serverColor ? serverOuterH : blackOuterH) + highlightRingSize

  const isCircular = shape === 'CIRCLE'

  return (
    <Group
      transform={[
        { translateX: posX },
        { translateY: posY },
        { rotate: (rotation * Math.PI) / 180 },
        { scale: pressScale },
      ]}
    >
      {/* Highlight glow - pulsing cyan background (for list selection) */}
      {isHighlighted && !isSelected && (() => {
        // Animate glow size and opacity based on pulse (0 to 1)
        const glowExpand = 4 + highlightPulse * 6 // 4 to 10 extra pixels
        const glowOpacity = Math.round(0x40 + highlightPulse * 0x30).toString(16).padStart(2, '0') // 40 to 70 hex
        const glowRadius = highlightOuterW + glowExpand
        const glowRadiusH = highlightOuterH + glowExpand
        return (
          <>
            {isCircular ? (
              <Circle cx={0} cy={0} r={glowRadius} color={Neo.cyan + glowOpacity} />
            ) : (
              <Rect
                x={-glowRadius}
                y={-glowRadiusH}
                width={glowRadius * 2}
                height={glowRadiusH * 2}
                color={Neo.cyan + glowOpacity}
              />
            )}
          </>
        )
      })()}

      {/* Highlight ring fill (cyan ring for list selection) */}
      {isHighlighted && !isSelected && (
        <>
          {isCircular ? (
            <Circle cx={0} cy={0} r={highlightOuterW} color={Neo.cyan} />
          ) : (
            <Rect
              x={-highlightOuterW}
              y={-highlightOuterH}
              width={highlightOuterW * 2}
              height={highlightOuterH * 2}
              color={Neo.cyan}
            />
          )}
        </>
      )}

      {/* Selection glow - soft background */}
      {isSelected && (
        <>
          {isCircular ? (
            <Circle cx={0} cy={0} r={selectionOuterW + 6} color={Neo.yellow + '50'} />
          ) : (
            <Rect
              x={-selectionOuterW - 6}
              y={-selectionOuterH - 6}
              width={(selectionOuterW + 6) * 2}
              height={(selectionOuterH + 6) * 2}
              color={Neo.yellow + '50'}
            />
          )}
        </>
      )}

      {/* Selection ring fill (outermost when selected) */}
      {isSelected && (
        <>
          {isCircular ? (
            <Circle cx={0} cy={0} r={selectionOuterW} color={Neo.yellow} />
          ) : (
            <Rect
              x={-selectionOuterW}
              y={-selectionOuterH}
              width={selectionOuterW * 2}
              height={selectionOuterH * 2}
              color={Neo.yellow}
            />
          )}
        </>
      )}

      {/* Server assignment ring fill */}
      {serverColor && (
        <>
          {isCircular ? (
            <Circle cx={0} cy={0} r={serverOuterW} color={serverColor} />
          ) : (
            <Rect
              x={-serverOuterW}
              y={-serverOuterH}
              width={serverOuterW * 2}
              height={serverOuterH * 2}
              color={serverColor}
            />
          )}
        </>
      )}

      {/* Black border fill */}
      {isCircular ? (
        <Circle cx={0} cy={0} r={blackOuterW} color={Neo.black} />
      ) : (
        <Rect
          x={-blackOuterW}
          y={-blackOuterH}
          width={blackOuterW * 2}
          height={blackOuterH * 2}
          color={Neo.black}
        />
      )}

      {/* Shadow - offset from the table */}
      {isCircular ? (
        <Circle cx={shadowOffset} cy={shadowOffset} r={halfW} color={Neo.black} />
      ) : (
        <Rect
          x={-halfW + shadowOffset}
          y={-halfH + shadowOffset}
          width={scaledWidth}
          height={scaledHeight}
          color={Neo.black}
        />
      )}

      {/* Status color fill (the table itself) */}
      {isCircular ? (
        <Circle cx={0} cy={0} r={halfW} color={fillColor} />
      ) : (
        <Rect x={-halfW} y={-halfH} width={scaledWidth} height={scaledHeight} color={fillColor} />
      )}

      {/* Tag indicators in top-left corner */}
      {table.currentReservation && (
        <TagIndicators
          tags={table.currentReservation.tags}
          guestTags={table.currentReservation.guestTags}
          tableHalfW={halfW}
          tableHalfH={halfH}
          rotation={rotation}
        />
      )}

      {/* Counter-rotate for text */}
      <Group transform={[{ rotate: (-rotation * Math.PI) / 180 }]}>
        <TableText text={table.table_number} font={fonts.tableNumber} color={textColor} y={4} />
        <TableText
          text={
            table.min_capacity === table.max_capacity
              ? `${table.max_capacity}`
              : `${table.min_capacity}-${table.max_capacity}`
          }
          font={fonts.capacity}
          color={textColor}
          y={16}
        />
      </Group>
    </Group>
  )
}

// Tag indicator badges for table corners
interface TagIndicatorsProps {
  tags: import('@/lib/types').ReservationTag[] | null
  guestTags: import('@/lib/types').GuestTag[] | null
  tableHalfW: number
  tableHalfH: number
  rotation: number
}

function TagIndicators({ tags, guestTags, tableHalfW, tableHalfH, rotation }: TagIndicatorsProps) {
  const hasDietary = tags?.some(t => t.type === 'DIETARY')
  const hasOccasion = tags?.some(t => t.type === 'OCCASION')
  const firstGuestTag = guestTags?.[0]

  if (!hasDietary && !hasOccasion && !firstGuestTag) return null

  const INDICATOR_SIZE = 16
  const INDICATOR_GAP = 2
  const CORNER_OFFSET = 4

  // Position in top-left corner of table
  const startX = -tableHalfW - CORNER_OFFSET
  const startY = -tableHalfH - CORNER_OFFSET - INDICATOR_SIZE

  // Calculate x positions for each indicator
  let index = 0
  const dietaryX = hasDietary ? (index++) * (INDICATOR_SIZE + INDICATOR_GAP) : 0
  const occasionX = hasOccasion ? (index++) * (INDICATOR_SIZE + INDICATOR_GAP) : 0
  const guestTagX = firstGuestTag ? index * (INDICATOR_SIZE + INDICATOR_GAP) : 0

  return (
    <Group transform={[{ rotate: (-rotation * Math.PI) / 180 }]}>
      {/* Dietary indicator - pink with ! */}
      {hasDietary && (
        <Group>
          <Rect
            x={startX + dietaryX}
            y={startY}
            width={INDICATOR_SIZE}
            height={INDICATOR_SIZE}
            color={Neo.black}
          />
          <Rect
            x={startX + dietaryX + 1}
            y={startY + 1}
            width={INDICATOR_SIZE - 2}
            height={INDICATOR_SIZE - 2}
            color={Neo.pink}
          />
          <SkiaText
            x={startX + dietaryX + 5}
            y={startY + 12}
            text="!"
            font={tagIndicatorFont}
            color={Neo.white}
          />
        </Group>
      )}

      {/* Occasion indicator - yellow with * (star) */}
      {hasOccasion && (
        <Group>
          <Rect
            x={startX + occasionX}
            y={startY}
            width={INDICATOR_SIZE}
            height={INDICATOR_SIZE}
            color={Neo.black}
          />
          <Rect
            x={startX + occasionX + 1}
            y={startY + 1}
            width={INDICATOR_SIZE - 2}
            height={INDICATOR_SIZE - 2}
            color={Neo.yellow}
          />
          <SkiaText
            x={startX + occasionX + 4}
            y={startY + 12}
            text="*"
            font={tagIndicatorFont}
            color={Neo.black}
          />
        </Group>
      )}

      {/* First guest tag - custom color with first letter of label */}
      {firstGuestTag && (
        <Group>
          <Rect
            x={startX + guestTagX}
            y={startY}
            width={INDICATOR_SIZE}
            height={INDICATOR_SIZE}
            color={Neo.black}
          />
          <Rect
            x={startX + guestTagX + 1}
            y={startY + 1}
            width={INDICATOR_SIZE - 2}
            height={INDICATOR_SIZE - 2}
            color={firstGuestTag.color}
          />
          <SkiaText
            x={startX + guestTagX + 4}
            y={startY + 12}
            text={firstGuestTag.label.charAt(0).toUpperCase()}
            font={tagIndicatorFont}
            color={Neo.black}
          />
        </Group>
      )}
    </Group>
  )
}

interface TableTextProps {
  text: string
  font: SkFont
  color: string
  y: number
}

function TableText({ text, font, color, y }: TableTextProps) {
  const width = font.measureText(text).width
  return <SkiaText x={-width / 2} y={y} text={text} font={font} color={color} />
}

interface BadgeRendererProps {
  table: TableWithStatus
  containerWidth: number
  containerHeight: number
  currentTime?: Date
}

function BadgeRenderer({ table, containerWidth, containerHeight, currentTime }: BadgeRendererProps) {
  if (!table.currentReservation?.seatedAt) return null

  // Load guest image if available
  const guestImageUrl = table.currentReservation.guestImageUrl
  const guestImage = useImage(guestImageUrl || undefined)
  const hasPhoto = !!guestImage

  const { posX, posY, scaledHeight } = useMemo(() => {
    const dims = getTableDimensions(table, containerWidth, containerHeight)
    return { posX: dims.posX, posY: dims.posY, scaledHeight: dims.scaledHeight }
  }, [table, containerWidth, containerHeight])

  // Use currentTime prop if available, otherwise use current time
  const now = currentTime || new Date()
  const seatedAt = table.currentReservation.seatedAt
  const expectedMinutes = 75
  const elapsedSeconds = differenceInSeconds(now, parseISO(seatedAt))
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const percentage = (elapsedMinutes / expectedMinutes) * 100

  // Color coding: lime (on track), yellow (75-100% done), pink (overtime)
  let bgColor = Neo.lime
  let isOvertime = false
  if (percentage >= 75 && percentage <= 100) {
    bgColor = Neo.yellow
  } else if (percentage > 100) {
    bgColor = Neo.pink
    isOvertime = true
  }

  // Get first name, truncate if too long
  const fullName = table.currentReservation.name || ''
  const firstName = fullName.split(' ')[0] || ''
  const displayName = firstName.length > 8 ? firstName.slice(0, 7) + '…' : firstName

  // Format time with seconds - MM:SS or H:MM:SS
  const formatTime = (totalSeconds: number) => {
    const absSeconds = Math.abs(totalSeconds)
    const hours = Math.floor(absSeconds / 3600)
    const minutes = Math.floor((absSeconds % 3600) / 60)
    const seconds = absSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const timeText = formatTime(elapsedSeconds)

  // Badge dimensions
  const PHOTO_SIZE = 28
  const BADGE_PADDING_H = 8
  const BADGE_PADDING_V = 4
  const BADGE_MARGIN_TOP = 6
  const PHOTO_MARGIN = 6

  // Measure text widths
  const nameWidth = badgeNameFont.measureText(displayName).width
  const timeWidth = badgeTimeFont.measureText(timeText).width
  const textWidth = Math.max(nameWidth, timeWidth)

  // Badge width includes photo if present
  const contentWidth = hasPhoto ? PHOTO_SIZE + PHOTO_MARGIN + textWidth : textWidth
  const badgeWidth = contentWidth + BADGE_PADDING_H * 2

  // Height: single row with photo, or two-line without
  const lineHeight = 14
  const badgeHeight = hasPhoto
    ? PHOTO_SIZE + BADGE_PADDING_V * 2
    : lineHeight * 2 + BADGE_PADDING_V * 2

  const badgeX = posX - badgeWidth / 2
  const badgeY = posY + scaledHeight / 2 + BADGE_MARGIN_TOP

  // Photo position (left side, vertically centered)
  const photoX = badgeX + BADGE_PADDING_H
  const photoY = badgeY + BADGE_PADDING_V

  // Text positions - right of photo if present, otherwise centered
  const textAreaX = hasPhoto ? photoX + PHOTO_SIZE + PHOTO_MARGIN : badgeX + BADGE_PADDING_H
  const textAreaWidth = hasPhoto ? textWidth : contentWidth

  // With photo: name and time stacked in smaller area to right of photo
  // Without photo: name on top, time below, centered
  const nameX = hasPhoto
    ? textAreaX
    : posX - nameWidth / 2
  const nameY = hasPhoto
    ? badgeY + BADGE_PADDING_V + 11
    : badgeY + BADGE_PADDING_V + lineHeight - 2
  const timeX = hasPhoto
    ? textAreaX
    : posX - timeWidth / 2
  const timeY = hasPhoto
    ? badgeY + BADGE_PADDING_V + 24
    : badgeY + BADGE_PADDING_V + lineHeight * 2 - 2

  return (
    <Group>
      {/* Shadow */}
      <Rect
        x={badgeX + 3}
        y={badgeY + 3}
        width={badgeWidth}
        height={badgeHeight}
        color={Neo.black}
      />
      {/* Background */}
      <Rect
        x={badgeX}
        y={badgeY}
        width={badgeWidth}
        height={badgeHeight}
        color={bgColor}
      />
      {/* Border */}
      <Rect
        x={badgeX}
        y={badgeY}
        width={badgeWidth}
        height={badgeHeight}
        color={Neo.black}
        style="stroke"
        strokeWidth={2}
      />
      {/* Overtime indicator stripe */}
      {isOvertime && (
        <Rect
          x={badgeX}
          y={badgeY}
          width={4}
          height={badgeHeight}
          color={Neo.black}
        />
      )}
      {/* Guest photo */}
      {hasPhoto && guestImage && (
        <>
          {/* Photo border/frame */}
          <Rect
            x={photoX - 1}
            y={photoY - 1}
            width={PHOTO_SIZE + 2}
            height={PHOTO_SIZE + 2}
            color={Neo.black}
          />
          <SkiaImage
            image={guestImage}
            x={photoX}
            y={photoY}
            width={PHOTO_SIZE}
            height={PHOTO_SIZE}
            fit="cover"
          />
        </>
      )}
      {/* Name text */}
      <SkiaText
        x={nameX}
        y={nameY}
        text={displayName}
        font={badgeNameFont}
        color={Neo.black}
      />
      {/* Time text */}
      <SkiaText
        x={timeX}
        y={timeY}
        text={timeText}
        font={badgeTimeFont}
        color={Neo.black}
      />
    </Group>
  )
}

interface ElementRendererProps {
  element: FloorPlanElement
  containerWidth: number
  containerHeight: number
  font: SkFont
}

function ElementRenderer({ element, containerWidth, containerHeight, font }: ElementRendererProps) {
  const { posX, posY, scaledWidth, scaledHeight } = useMemo(() => {
    const pX = (element.position_x / 100) * containerWidth
    const pY = (element.position_y / 100) * containerHeight
    const scaleRef = Math.min(containerWidth, containerHeight) / REFERENCE_WIDTH
    const sW = Math.max(element.width * scaleRef, 20)
    const sH = Math.max(element.height * scaleRef, 20)
    return { posX: pX, posY: pY, scaledWidth: sW, scaledHeight: sH }
  }, [element, containerWidth, containerHeight])

  const rotation = element.rotation || 0
  const color = element.color || Neo.black
  const halfW = scaledWidth / 2
  const halfH = scaledHeight / 2

  const ELEMENT_LABELS: Record<string, string> = {
    KITCHEN: 'KITCHEN',
    BAR_AREA: 'BAR',
    RESTROOM: 'WC',
    HOSTESS: 'HOST',
    ENTRANCE: 'ENTRY',
  }
  const labelText = element.label || ELEMENT_LABELS[element.type] || ''

  switch (element.type) {
    case 'WALL':
    case 'DIVIDER':
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }, { rotate: (rotation * Math.PI) / 180 }]}>
          <Rect x={-halfW} y={-halfH} width={scaledWidth} height={scaledHeight} color={color + '99'} style="stroke" strokeWidth={2} />
        </Group>
      )

    case 'COLUMN':
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }]}>
          <Circle cx={0} cy={0} r={scaledWidth / 2} color={color} style="stroke" strokeWidth={3} />
        </Group>
      )

    case 'PLANT':
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }]}>
          <Circle cx={0} cy={0} r={scaledWidth / 2} color={(color || '#22C55E') + '4D'} />
          <Circle cx={0} cy={0} r={scaledWidth / 2} color={color || '#22C55E'} style="stroke" strokeWidth={1} />
        </Group>
      )

    case 'ENTRANCE':
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }, { rotate: (rotation * Math.PI) / 180 }]}>
          <Rect x={-halfW} y={-halfH} width={scaledWidth} height={scaledHeight} color={color + '80'} style="stroke" strokeWidth={2} />
        </Group>
      )

    case 'LABEL':
      if (!labelText) return null
      const labelWidth = font.measureText(labelText).width
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }]}>
          <SkiaText x={-labelWidth / 2} y={4} text={labelText} font={font} color={Neo.black + 'CC'} />
        </Group>
      )

    case 'KITCHEN':
    case 'BAR_AREA':
    case 'RESTROOM':
    case 'HOSTESS':
    case 'DECORATION':
    default:
      return (
        <Group transform={[{ translateX: posX }, { translateY: posY }, { rotate: (rotation * Math.PI) / 180 }]}>
          <Rect x={-halfW} y={-halfH} width={scaledWidth} height={scaledHeight} color={color + '1A'} />
          <Rect x={-halfW} y={-halfH} width={scaledWidth} height={scaledHeight} color={color + '66'} style="stroke" strokeWidth={2} />
          {labelText && (
            <Group transform={[{ rotate: (-rotation * Math.PI) / 180 }]}>
              <SkiaText x={-font.measureText(labelText).width / 2} y={4} text={labelText} font={font} color={Neo.black + '99'} />
            </Group>
          )}
        </Group>
      )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
})
