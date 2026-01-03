import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { Canvas, Group, Rect, Circle, Text as SkiaText, matchFont } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, runOnJS, withDecay, withTiming, Easing } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { differenceInMinutes, parseISO } from 'date-fns'

import { Neo } from '@/constants/theme'
import type { TableWithStatus, FloorPlanElement } from '@/lib/types'
import type { SkFont } from '@shopify/react-native-skia'

import type { SkiaFloorPlanCanvasProps, TransformState, ServerAssignmentRecord } from './types'
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

const elementLabelFont = matchFont({
  fontFamily,
  fontSize: ELEMENT_LABEL_FONT_SIZE,
  fontWeight: 'normal',
})

export function SkiaFloorPlanCanvas({
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
}: SkiaFloorPlanCanvasProps) {
  // Filter tables with valid positions
  const positionedTables = useMemo(
    () => tables.filter((t) => t.position_x != null && t.position_y != null),
    [tables]
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

  // Poll transform values at 60fps for rendering
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTransform({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      })
    }, 16)
    return () => clearInterval(interval)
  }, [scale, translateX, translateY])

  // Hit test function - takes transform values as parameters
  const performHitTest = useCallback(
    (
      screenX: number,
      screenY: number,
      scaleVal: number,
      txVal: number,
      tyVal: number
    ): TableWithStatus | null => {
      // Convert screen to content coordinates
      const contentX = (screenX - txVal) / scaleVal
      const contentY = (screenY - tyVal) / scaleVal

      // Check tables in reverse order (top tables first)
      for (let i = tablesRef.current.length - 1; i >= 0; i--) {
        const table = tablesRef.current[i]
        if (isPointInTable(contentX, contentY, table, contentWidth, contentHeight)) {
          return table
        }
      }
      return null
    },
    [contentWidth, contentHeight]
  )

  // Tap handler - receives transform values from worklet
  const handleTapHitTest = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const table = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (table) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onTableTap(table)
      } else {
        onBackgroundTap()
      }
    },
    [performHitTest, onTableTap, onBackgroundTap]
  )

  // Long press handler
  const handleLongPressHitTest = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const table = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (table) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onTableLongPress(table)
      }
    },
    [performHitTest, onTableLongPress]
  )

  // Touch start handler (for press visual feedback)
  const handleTouchStart = useCallback(
    (screenX: number, screenY: number, scaleVal: number, txVal: number, tyVal: number) => {
      const table = performHitTest(screenX, screenY, scaleVal, txVal, tyVal)
      if (table) {
        onPressIn(table.id)
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
        const table = performHitTest(x, y, scaleVal, txVal, tyVal)
        if (table) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onTableTap(table)
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

            {/* Tables (unselected first, then selected) */}
            <Group>
              {positionedTables
                .filter((t) => t.id !== selectedTableId)
                .map((table) => (
                  <TableRenderer
                    key={`table-${table.id}`}
                    table={table}
                    isSelected={false}
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
                    font={badgeFont}
                  />
                ))}
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface TableRendererProps {
  table: TableWithStatus
  isSelected: boolean
  isPressed: boolean
  serverColor?: string
  containerWidth: number
  containerHeight: number
  fonts: { tableNumber: SkFont; capacity: SkFont }
}

function TableRenderer({
  table,
  isSelected,
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

  const halfW = scaledWidth / 2
  const halfH = scaledHeight / 2

  // Calculate outer sizes for each layer
  const blackOuterW = halfW + blackBorderSize
  const blackOuterH = halfH + blackBorderSize
  const serverOuterW = blackOuterW + serverRingSize
  const serverOuterH = blackOuterH + serverRingSize
  const selectionOuterW = (serverColor ? serverOuterW : blackOuterW) + selectionRingSize
  const selectionOuterH = (serverColor ? serverOuterH : blackOuterH) + selectionRingSize

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
  font: SkFont
}

function BadgeRenderer({ table, containerWidth, containerHeight, font }: BadgeRendererProps) {
  if (!table.currentReservation?.seatedAt) return null

  const { posX, posY, scaledHeight } = useMemo(() => {
    const dims = getTableDimensions(table, containerWidth, containerHeight)
    return { posX: dims.posX, posY: dims.posY, scaledHeight: dims.scaledHeight }
  }, [table, containerWidth, containerHeight])

  const seatedAt = table.currentReservation.seatedAt
  const expectedMinutes = 75
  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  const percentage = (elapsedMinutes / expectedMinutes) * 100

  let bgColor = Neo.lime
  if (percentage >= 75 && percentage <= 100) {
    bgColor = Neo.yellow
  } else if (percentage > 100) {
    bgColor = Neo.pink
  }

  const firstName = table.currentReservation.name?.split(' ')[0] || ''
  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}H${mins > 0 ? mins.toString().padStart(2, '0') : ''}`
    }
    return `${minutes}M`
  }
  const timeText = formatTime(elapsedMinutes)
  const labelText = firstName ? `${firstName} ${timeText}` : timeText

  const textWidth = font.measureText(labelText).width
  const BADGE_PADDING_H = 6
  const BADGE_HEIGHT = 18
  const BADGE_MARGIN_TOP = 4
  const badgeWidth = textWidth + BADGE_PADDING_H * 2
  const badgeX = posX - badgeWidth / 2
  const badgeY = posY + scaledHeight / 2 + BADGE_MARGIN_TOP

  return (
    <Group>
      <Rect x={badgeX + 2} y={badgeY + 2} width={badgeWidth} height={BADGE_HEIGHT} color={Neo.black} />
      <Rect x={badgeX} y={badgeY} width={badgeWidth} height={BADGE_HEIGHT} color={bgColor} />
      <Rect
        x={badgeX}
        y={badgeY}
        width={badgeWidth}
        height={BADGE_HEIGHT}
        color={Neo.black}
        style="stroke"
        strokeWidth={2}
      />
      <SkiaText x={badgeX + BADGE_PADDING_H} y={badgeY + BADGE_HEIGHT - 5} text={labelText} font={font} color={Neo.black} />
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
