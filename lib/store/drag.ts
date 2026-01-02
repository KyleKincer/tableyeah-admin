import { create } from 'zustand'
import type { Reservation, WaitlistEntry } from '@/lib/types'

// Types of items that can be dragged
export type DragPayload =
  | { type: 'reservation'; reservation: Reservation }
  | { type: 'waitlist'; entry: WaitlistEntry }
  | { type: 'walk-in'; partySize: number | null } // null = ask after drop

export interface DropZone {
  tableId: number
  bounds: { x: number; y: number; width: number; height: number }
  minCapacity: number
  maxCapacity: number
  isAvailable: boolean
}

interface DragState {
  // Drag state
  isDragging: boolean
  dragPayload: DragPayload | null
  dragSource: 'list' | 'waitlist' | 'walk-in-button' | null

  // Current drag position (for overlay positioning)
  dragPosition: { x: number; y: number }

  // Current table being hovered
  overTableId: number | null

  // Drop zone registry
  dropZones: Map<number, DropZone>
}

interface DragActions {
  // Start dragging
  startDrag: (payload: DragPayload, source: DragState['dragSource']) => void

  // Update drag position
  updateDragPosition: (x: number, y: number) => void

  // Update hovered table
  setOverTableId: (tableId: number | null) => void

  // End dragging
  endDrag: () => void

  // Cancel dragging
  cancelDrag: () => void

  // Register drop zone
  registerDropZone: (zone: DropZone) => void

  // Unregister drop zone
  unregisterDropZone: (tableId: number) => void

  // Clear all drop zones
  clearDropZones: () => void
}

type DragStore = DragState & DragActions

const initialState: DragState = {
  isDragging: false,
  dragPayload: null,
  dragSource: null,
  dragPosition: { x: 0, y: 0 },
  overTableId: null,
  dropZones: new Map(),
}

export const useDragStore = create<DragStore>((set, get) => ({
  ...initialState,

  startDrag: (payload, source) =>
    set({
      isDragging: true,
      dragPayload: payload,
      dragSource: source,
      overTableId: null,
    }),

  updateDragPosition: (x, y) =>
    set({
      dragPosition: { x, y },
    }),

  setOverTableId: (tableId) =>
    set({
      overTableId: tableId,
    }),

  endDrag: () =>
    set({
      isDragging: false,
      dragPayload: null,
      dragSource: null,
      overTableId: null,
    }),

  cancelDrag: () =>
    set({
      isDragging: false,
      dragPayload: null,
      dragSource: null,
      dragPosition: { x: 0, y: 0 },
      overTableId: null,
    }),

  registerDropZone: (zone) => {
    const { dropZones } = get()
    const newZones = new Map(dropZones)
    newZones.set(zone.tableId, zone)
    set({ dropZones: newZones })
  },

  unregisterDropZone: (tableId) => {
    const { dropZones } = get()
    const newZones = new Map(dropZones)
    newZones.delete(tableId)
    set({ dropZones: newZones })
  },

  clearDropZones: () =>
    set({
      dropZones: new Map(),
    }),
}))

// Helper to get party size from drag payload
export function getPartySizeFromPayload(payload: DragPayload): number {
  switch (payload.type) {
    case 'reservation':
      return payload.reservation.covers
    case 'waitlist':
      return payload.entry.covers
    case 'walk-in':
      return payload.partySize ?? 0
  }
}

// Helper to get guest name from drag payload
export function getGuestNameFromPayload(payload: DragPayload): string {
  switch (payload.type) {
    case 'reservation':
      return payload.reservation.name
    case 'waitlist':
      return payload.entry.name
    case 'walk-in':
      return 'Walk-in'
  }
}

// Validate if a drop is valid
export function validateDrop(
  payload: DragPayload,
  zone: DropZone
): { valid: boolean; warning?: string } {
  if (!zone.isAvailable) {
    return { valid: false, warning: 'Table is occupied' }
  }

  const partySize = getPartySizeFromPayload(payload)

  // Walk-in without party size set is always valid (will prompt after drop)
  if (payload.type === 'walk-in' && payload.partySize === null) {
    return { valid: true }
  }

  if (partySize > zone.maxCapacity) {
    return {
      valid: true, // Allow but warn
      warning: `Party of ${partySize} exceeds capacity (${zone.maxCapacity})`,
    }
  }

  if (partySize < zone.minCapacity) {
    return {
      valid: true, // Allow but warn
      warning: `Small party for this table (min ${zone.minCapacity})`,
    }
  }

  return { valid: true }
}
