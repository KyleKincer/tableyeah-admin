import { useCallback, useRef } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import type { Reservation } from '@/lib/types'
import type { TimelineTableLayout, TimelineBarLayout } from '../../timeline/types'

interface UseTimelineDragOptions {
  layouts: TimelineTableLayout[]
  headerHeight: number
  onDragEnd?: (reservationId: number, targetTableId: number) => void
}

// Bar info captured at drag start
export interface DragBarInfo {
  bar: TimelineBarLayout
  tableKey: string
  screenX: number
  screenY: number
  width: number
  height: number
}

export interface DragState {
  isDragging: boolean
  reservation: Reservation | null
  barInfo: DragBarInfo | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  targetTableId: number | null
  targetTableKey: string | null
  // Offset between absolute screen coords and relative view coords
  offsetX: number
  offsetY: number
}

export function useTimelineDrag({
  layouts,
  headerHeight,
  onDragEnd,
}: UseTimelineDragOptions) {
  // Shared values for smooth animations
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const isDragging = useSharedValue(false)

  // Ref to store current drag state (for JS thread access)
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    reservation: null,
    barInfo: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    targetTableId: null,
    targetTableKey: null,
    offsetX: 0,
    offsetY: 0,
  })

  // Calculate cumulative row Y positions
  const getRowYPositions = useCallback(() => {
    const positions: number[] = []
    let y = 0
    for (const layout of layouts) {
      positions.push(y)
      y += layout.rowHeight
    }
    return positions
  }, [layouts])

  // Find which table row a Y position falls into
  const findTargetTable = useCallback(
    (screenY: number, translateY: number): { tableId: number | null; tableKey: string | null } => {
      const contentY = screenY - headerHeight - translateY
      const rowYPositions = getRowYPositions()

      let cumulativeY = 0
      for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i]
        if (contentY >= cumulativeY && contentY < cumulativeY + layout.rowHeight) {
          return {
            tableId: layout.table?.id || null,
            tableKey: layout.tableKey,
          }
        }
        cumulativeY += layout.rowHeight
      }
      return { tableId: null, tableKey: null }
    },
    [layouts, headerHeight, getRowYPositions]
  )

  // Start dragging a reservation
  const startDrag = useCallback(
    (
      reservation: Reservation,
      barInfo: DragBarInfo,
      relativeX: number,
      relativeY: number,
      absoluteX: number,
      absoluteY: number
    ) => {
      const offsetX = absoluteX - relativeX
      const offsetY = absoluteY - relativeY
      dragStateRef.current = {
        isDragging: true,
        reservation,
        barInfo,
        startX: relativeX,
        startY: relativeY,
        currentX: relativeX,
        currentY: relativeY,
        targetTableId: null,
        targetTableKey: null,
        offsetX,
        offsetY,
      }
      dragX.value = relativeX
      dragY.value = relativeY
      isDragging.value = true
    },
    [dragX, dragY, isDragging]
  )

  // Update drag position (table changes only, no time changes)
  const updateDrag = useCallback(
    (absoluteX: number, absoluteY: number, translateY: number) => {
      if (!dragStateRef.current.isDragging) return

      // Convert absolute to relative using stored offset
      const relativeX = absoluteX - dragStateRef.current.offsetX
      const relativeY = absoluteY - dragStateRef.current.offsetY

      dragStateRef.current.currentX = relativeX
      dragStateRef.current.currentY = relativeY
      dragX.value = relativeX
      dragY.value = relativeY

      // Find target table (uses relative Y for hit testing)
      const { tableId, tableKey } = findTargetTable(relativeY, translateY)
      dragStateRef.current.targetTableId = tableId
      dragStateRef.current.targetTableKey = tableKey
    },
    [dragX, dragY, findTargetTable]
  )

  // End drag and trigger callback
  const endDrag = useCallback(() => {
    const state = dragStateRef.current
    if (!state.isDragging || !state.reservation) {
      isDragging.value = false
      return
    }

    const currentTableIds = state.reservation.table_ids || []
    const isNewTable = state.targetTableId !== null && !currentTableIds.includes(state.targetTableId)

    // Trigger callback if moving to a different table
    if (isNewTable && onDragEnd) {
      onDragEnd(state.reservation.id, state.targetTableId!)
    }

    // Reset state
    dragStateRef.current = {
      isDragging: false,
      reservation: null,
      barInfo: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      targetTableId: null,
      targetTableKey: null,
      offsetX: 0,
      offsetY: 0,
    }
    isDragging.value = false
  }, [isDragging, onDragEnd])

  // Cancel drag without triggering callback
  const cancelDrag = useCallback(() => {
    dragStateRef.current = {
      isDragging: false,
      reservation: null,
      barInfo: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      targetTableId: null,
      targetTableKey: null,
      offsetX: 0,
      offsetY: 0,
    }
    isDragging.value = false
  }, [isDragging])

  return {
    dragX,
    dragY,
    isDragging,
    dragStateRef,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    findTargetTable,
  }
}
