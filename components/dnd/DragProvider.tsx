import React, { createContext, useContext, useCallback, useRef } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import {
  useDragStore,
  type DragPayload,
  type DropZone,
  getGuestNameFromPayload,
  getPartySizeFromPayload,
  validateDrop,
} from '@/lib/store/drag'
import { useServiceStore } from '@/lib/store/service'
import { Text } from 'react-native'

interface DragContextValue {
  isDragging: boolean
  startDrag: (payload: DragPayload, startX: number, startY: number) => void
  updateDrag: (x: number, y: number) => void
  endDrag: (x: number, y: number) => void
  registerDropZone: (zone: DropZone) => void
  unregisterDropZone: (tableId: number) => void
}

const DragContext = createContext<DragContextValue | null>(null)

export function useDragContext() {
  const context = useContext(DragContext)
  if (!context) {
    throw new Error('useDragContext must be used within a DragProvider')
  }
  return context
}

interface DragProviderProps {
  children: React.ReactNode
  onDrop?: (tableId: number, payload: DragPayload) => void
  enabled?: boolean
}

export function DragProvider({
  children,
  onDrop,
  enabled = true,
}: DragProviderProps) {
  const {
    isDragging,
    dragPayload,
    overTableId,
    dropZones,
    startDrag: storeStartDrag,
    updateDragPosition,
    setOverTableId,
    endDrag,
    cancelDrag,
    registerDropZone,
    unregisterDropZone,
  } = useDragStore()

  const { clearSelection } = useServiceStore()

  // Animated values for overlay position
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const dragScale = useSharedValue(0)
  const dragOpacity = useSharedValue(0)

  // Track if we've started a successful drag
  const isDraggingRef = useRef(false)

  // Create refs to access current values in gesture callbacks
  const dropZonesRef = useRef(dropZones)
  const overTableIdRef = useRef(overTableId)
  dropZonesRef.current = dropZones
  overTableIdRef.current = overTableId

  // Find which drop zone the current position is over
  const findDropZone = useCallback(
    (x: number, y: number): number | null => {
      for (const [tableId, zone] of dropZonesRef.current) {
        if (
          x >= zone.bounds.x &&
          x <= zone.bounds.x + zone.bounds.width &&
          y >= zone.bounds.y &&
          y <= zone.bounds.y + zone.bounds.height
        ) {
          return tableId
        }
      }
      return null
    },
    []
  )

  const handleDragStart = useCallback(
    (payload: DragPayload, x: number, y: number) => {
      if (!enabled) return

      isDraggingRef.current = true
      clearSelection() // Clear any selection when starting drag
      storeStartDrag(payload, 'list')
      dragX.value = x
      dragY.value = y
      dragScale.value = withSpring(1, { damping: 20, stiffness: 400 })
      dragOpacity.value = withTiming(1, { duration: 50 })
    },
    [enabled, clearSelection, storeStartDrag, dragX, dragY, dragScale, dragOpacity]
  )

  const handleDragUpdate = useCallback(
    (x: number, y: number) => {
      if (!isDraggingRef.current) return

      // Update overlay position
      dragX.value = x
      dragY.value = y
      updateDragPosition(x, y)

      // Find drop zone
      const tableId = findDropZone(x, y)
      if (tableId !== overTableIdRef.current) {
        setOverTableId(tableId)
        overTableIdRef.current = tableId
        if (tableId !== null) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }
    },
    [dragX, dragY, updateDragPosition, findDropZone, setOverTableId]
  )

  const handleDragEnd = useCallback(
    (x: number, y: number) => {
      if (!isDraggingRef.current) return

      const tableId = findDropZone(x, y)
      const payload = dragPayload

      // Animate out quickly
      dragScale.value = withTiming(0.9, { duration: 50 })
      dragOpacity.value = withTiming(0, { duration: 50 })

      isDraggingRef.current = false

      if (tableId !== null && payload) {
        const zone = dropZonesRef.current.get(tableId)
        if (zone) {
          const validation = validateDrop(payload, zone)
          if (validation.valid) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onDrop?.(tableId, payload)
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          }
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
      }

      endDrag()
    },
    [dragPayload, findDropZone, onDrop, dragScale, dragOpacity, endDrag]
  )

  const handleDragCancel = useCallback(() => {
    if (!isDraggingRef.current) return

    dragScale.value = withTiming(0.9, { duration: 50 })
    dragOpacity.value = withTiming(0, { duration: 50 })
    isDraggingRef.current = false
    cancelDrag()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
  }, [dragScale, dragOpacity, cancelDrag])

  // Overlay animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - 100 }, // Center the overlay (assuming 200px width)
      { translateY: dragY.value - 25 }, // Offset above finger
      { scale: dragScale.value },
      { rotate: '2deg' }, // Slight tilt for "lifted" feel
    ],
    opacity: dragOpacity.value,
  }))

  const contextValue: DragContextValue = {
    isDragging,
    startDrag: handleDragStart,
    updateDrag: handleDragUpdate,
    endDrag: handleDragEnd,
    registerDropZone,
    unregisterDropZone,
  }

  return (
    <DragContext.Provider value={contextValue}>
      <View style={styles.container}>
        {children}

        {/* Drag overlay - rendered at root level */}
        {isDragging && dragPayload && (
          <Animated.View style={[styles.dragOverlay, overlayStyle]} pointerEvents="none">
            <DragOverlayContent payload={dragPayload} />
          </Animated.View>
        )}
      </View>
    </DragContext.Provider>
  )
}

function DragOverlayContent({ payload }: { payload: DragPayload }) {
  const name = getGuestNameFromPayload(payload)
  const partySize = getPartySizeFromPayload(payload)

  return (
    <View style={styles.overlayCard}>
      <Text style={styles.overlayName} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.overlayBadge}>
        <Text style={styles.overlayBadgeText}>
          {payload.type === 'walk-in' && partySize === 0
            ? 'WALK-IN'
            : `${partySize} GUESTS`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragOverlay: {
    position: 'absolute',
    zIndex: 9999,
    width: 200,
  },
  overlayCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...NeoShadow.lg,
  },
  overlayName: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  overlayBadge: {
    backgroundColor: Neo.lime,
    borderWidth: 1,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  overlayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
