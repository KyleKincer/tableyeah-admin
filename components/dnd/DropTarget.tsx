import React, { useEffect, useRef, useCallback } from 'react'
import { View, LayoutChangeEvent } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated'

import { Neo } from '@/constants/theme'
import { useDragContext } from './DragProvider'
import { useDragStore, validateDrop, type DropZone } from '@/lib/store/drag'

interface DropTargetProps {
  children: React.ReactNode
  tableId: number
  minCapacity: number
  maxCapacity: number
  isAvailable: boolean
  // Position and size for absolutely positioned tables
  style?: {
    left: number
    top: number
    width: number
    height: number
  }
  onDrop?: () => void
}

export function DropTarget({
  children,
  tableId,
  minCapacity,
  maxCapacity,
  isAvailable,
  style,
  onDrop,
}: DropTargetProps) {
  const { registerDropZone, unregisterDropZone } = useDragContext()
  const { isDragging, overTableId, dragPayload } = useDragStore()
  const viewRef = useRef<View>(null)

  // Is this table currently being hovered?
  const isHovered = overTableId === tableId

  // Validate drop if dragging
  const validation = isDragging && dragPayload
    ? validateDrop(dragPayload, {
        tableId,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        minCapacity,
        maxCapacity,
        isAvailable,
      })
    : { valid: false }

  const isEligible = isDragging && isAvailable
  const hasWarning = validation.valid && validation.warning

  // Animated values
  const scale = useSharedValue(1)
  const borderWidth = useSharedValue(2)
  const glowOpacity = useSharedValue(0)

  // Update animations based on hover state
  useEffect(() => {
    if (isHovered && isEligible) {
      scale.value = withSpring(1.05, { damping: 20, stiffness: 400 })
      borderWidth.value = withTiming(4, { duration: 50 })
      glowOpacity.value = withTiming(1, { duration: 50 })
    } else if (isDragging && isEligible) {
      scale.value = withSpring(1, { damping: 20, stiffness: 400 })
      borderWidth.value = withTiming(2, { duration: 50 })
      glowOpacity.value = withTiming(0.3, { duration: 50 })
    } else {
      scale.value = withSpring(1, { damping: 20, stiffness: 400 })
      borderWidth.value = withTiming(2, { duration: 50 })
      glowOpacity.value = withTiming(0, { duration: 50 })
    }
  }, [isHovered, isEligible, isDragging, scale, borderWidth, glowOpacity])

  // Register drop zone on layout - measure absolute position on screen
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      // Use setTimeout to ensure layout is complete before measuring
      setTimeout(() => {
        viewRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            registerDropZone({
              tableId,
              bounds: { x, y, width, height },
              minCapacity,
              maxCapacity,
              isAvailable,
            })
          }
        })
      }, 100)
    },
    [tableId, minCapacity, maxCapacity, isAvailable, registerDropZone]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterDropZone(tableId)
    }
  }, [tableId, unregisterDropZone])

  // Re-register when availability changes
  useEffect(() => {
    const timer = setTimeout(() => {
      viewRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          registerDropZone({
            tableId,
            bounds: { x, y, width, height },
            minCapacity,
            maxCapacity,
            isAvailable,
          })
        }
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [isAvailable, tableId, minCapacity, maxCapacity, registerDropZone])

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Determine overlay color based on state
  const getOverlayColor = () => {
    if (!isDragging) return 'transparent'
    if (!isAvailable) return 'rgba(0, 0, 0, 0.3)' // Dim unavailable tables
    if (isHovered) {
      return hasWarning
        ? 'rgba(230, 93, 14, 0.3)' // Orange for warning
        : 'rgba(200, 255, 0, 0.3)' // Lime for valid
    }
    if (isEligible) {
      return 'rgba(200, 255, 0, 0.1)' // Subtle lime for eligible
    }
    return 'transparent'
  }

  // If style prop provided, use absolute positioning
  // overflow: visible allows info badges to render below the table
  const containerStyles = style
    ? {
        position: 'absolute' as const,
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        overflow: 'visible' as const,
      }
    : undefined

  return (
    <View
      ref={viewRef}
      onLayout={handleLayout}
      collapsable={false}
      style={containerStyles}
    >
      <Animated.View style={[containerStyle, { flex: 1, overflow: 'visible' }]}>
        {children}
        {/* Overlay for visual feedback */}
        {isDragging && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: getOverlayColor(),
              borderWidth: isHovered ? 3 : 0,
              borderColor: hasWarning ? Neo.orange : Neo.lime,
              pointerEvents: 'none',
            }}
          />
        )}
      </Animated.View>
    </View>
  )
}
