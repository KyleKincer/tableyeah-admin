import { useCallback } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  useSharedValue,
  withDecay,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } from '../constants'

function clamp(value: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, value))
}

interface UseTimelineGesturesOptions {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
  headerHeight: number
  tableLabelWidth: number
}

export function useTimelineGestures({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  headerHeight,
  tableLabelWidth,
}: UseTimelineGesturesOptions) {
  // Transform state - scale only affects horizontal (X) dimension
  const scale = useSharedValue(DEFAULT_SCALE)
  const savedScale = useSharedValue(DEFAULT_SCALE)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  // Gesture state
  const isPanning = useSharedValue(false)
  const isPinching = useSharedValue(false)

  // Focal point for horizontal zoom (zoom toward pinch center X)
  const focalX = useSharedValue(0)

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Calculate clamped horizontal translation bounds (affected by scale)
  const clampTranslateX = useCallback(
    (tx: number, s: number) => {
      'worklet'
      const scaledWidth = contentWidth * s
      const availableWidth = viewportWidth - tableLabelWidth
      if (scaledWidth <= availableWidth) {
        return 0 // Content fits, no scrolling needed
      }
      const minX = availableWidth - scaledWidth
      return clamp(tx, minX, 0)
    },
    [contentWidth, viewportWidth, tableLabelWidth]
  )

  // Calculate clamped vertical translation bounds (NOT affected by scale - fixed row heights)
  const clampTranslateY = useCallback(
    (ty: number) => {
      'worklet'
      const availableHeight = viewportHeight - headerHeight
      if (contentHeight <= availableHeight) {
        return 0 // Content fits, no scrolling needed
      }
      const minY = availableHeight - contentHeight
      return clamp(ty, minY, 0)
    },
    [contentHeight, viewportHeight, headerHeight]
  )

  // Pinch gesture for HORIZONTAL-ONLY zooming
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet'
      isPinching.value = true
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
      // Focal point X relative to content area
      focalX.value = e.focalX - tableLabelWidth
      runOnJS(triggerHaptic)()
    })
    .onUpdate((e) => {
      'worklet'
      const newScale = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE)

      // Zoom toward focal point (horizontal only)
      const scaleChange = newScale / savedScale.value

      // Calculate new X translation to keep focal point stationary
      const newTranslateX =
        savedTranslateX.value - (focalX.value - savedTranslateX.value) * (scaleChange - 1)

      scale.value = newScale
      translateX.value = clampTranslateX(newTranslateX, newScale)
      // Y translation is NOT affected by zoom
    })
    .onEnd(() => {
      'worklet'
      isPinching.value = false
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
    })

  // Pan gesture for scrolling
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      'worklet'
      isPanning.value = true
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      'worklet'
      translateX.value = clampTranslateX(
        savedTranslateX.value + e.translationX,
        scale.value
      )
      // Y scrolling is independent of scale
      translateY.value = clampTranslateY(
        savedTranslateY.value + e.translationY
      )
    })
    .onEnd((e) => {
      'worklet'
      isPanning.value = false

      // Momentum scrolling with decay
      const scaledWidth = contentWidth * scale.value
      const availableWidth = viewportWidth - tableLabelWidth
      const availableHeight = viewportHeight - headerHeight

      const minX = scaledWidth > availableWidth ? availableWidth - scaledWidth : 0
      // Y bounds are NOT affected by scale
      const minY = contentHeight > availableHeight ? availableHeight - contentHeight : 0

      translateX.value = withDecay({
        velocity: e.velocityX,
        clamp: [minX, 0],
        deceleration: 0.998,
      })
      translateY.value = withDecay({
        velocity: e.velocityY,
        clamp: [minY, 0],
        deceleration: 0.998,
      })
    })

  // Combine gestures (pan and pinch can happen simultaneously)
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture)

  return {
    gesture: composedGesture,
    scale,
    translateX,
    translateY,
    isPanning,
    isPinching,
  }
}
