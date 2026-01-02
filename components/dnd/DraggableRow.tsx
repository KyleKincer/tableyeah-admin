import React, { useCallback } from 'react'
import { View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'

import { useDragContext } from './DragProvider'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import type { DragPayload } from '@/lib/store/drag'

interface DraggableRowProps {
  children: React.ReactNode
  payload: DragPayload
  enabled?: boolean
  /** Minimum distance in pixels before drag activates (distinguishes from tap) */
  minDragDistance?: number
}

export function DraggableRow({
  children,
  payload,
  enabled = true,
  minDragDistance = 10,
}: DraggableRowProps) {
  const { isTablet, isLandscape } = useDeviceType()
  const { startDrag, updateDrag, endDrag } = useDragContext()

  // Only enable drag on tablet in landscape (split layout visible)
  const dragEnabled = enabled && isTablet && isLandscape

  // Animated values for the source row during drag
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)
  const isActive = useSharedValue(false)

  const handleDragStart = useCallback(
    (x: number, y: number) => {
      if (!dragEnabled) return
      startDrag(payload, x, y)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    },
    [dragEnabled, startDrag, payload]
  )

  const handleDragUpdate = useCallback(
    (x: number, y: number) => {
      updateDrag(x, y)
    },
    [updateDrag]
  )

  const handleDragEnd = useCallback(
    (x: number, y: number) => {
      endDrag(x, y)
    },
    [endDrag]
  )

  // Pan gesture that activates after minDistance movement
  // We only use pan for dragging - taps are handled by the child Pressable
  const panGesture = Gesture.Pan()
    .minDistance(minDragDistance)
    .onStart((e) => {
      'worklet'
      if (!dragEnabled) return

      isActive.value = true
      opacity.value = withTiming(0.4, { duration: 50 })
      scale.value = withTiming(0.98, { duration: 50 })
      runOnJS(handleDragStart)(e.absoluteX, e.absoluteY)
    })
    .onUpdate((e) => {
      'worklet'
      if (!isActive.value) return

      runOnJS(handleDragUpdate)(e.absoluteX, e.absoluteY)
    })
    .onEnd((e) => {
      'worklet'
      if (!isActive.value) return

      runOnJS(handleDragEnd)(e.absoluteX, e.absoluteY)

      isActive.value = false
      opacity.value = withTiming(1, { duration: 100 })
      scale.value = withTiming(1, { duration: 100 })
    })
    .onFinalize(() => {
      'worklet'
      if (isActive.value) {
        isActive.value = false
        opacity.value = withTiming(1, { duration: 100 })
        scale.value = withTiming(1, { duration: 100 })
      }
    })

  // Animated style for the row during drag
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  // If drag is not enabled, just render children directly (Pressable inside handles taps)
  if (!dragEnabled) {
    return <View>{children}</View>
  }

  // When drag is enabled, wrap with pan gesture but let child Pressable handle taps
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  )
}

// Wrapper that provides tap-only behavior (no drag)
export function TappableRow({
  children,
  onTap,
}: {
  children: React.ReactNode
  onTap?: () => void
}) {
  const handleTap = useCallback(() => {
    onTap?.()
  }, [onTap])

  const tapGesture = Gesture.Tap().onEnd(() => {
    'worklet'
    runOnJS(handleTap)()
  })

  return (
    <GestureDetector gesture={tapGesture}>
      <View>{children}</View>
    </GestureDetector>
  )
}
