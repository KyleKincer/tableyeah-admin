import type { SharedValue } from 'react-native-reanimated'
import type { Reservation, TableWithStatus, SeatingSettings } from '@/lib/types'

// Re-export layout types from original
export type {
  TimelineBarLayout,
  TimelineTableLayout,
  OccupancySlot,
  OccupancyTimelineResponse,
  TimelineViewProps,
  TimelineDragState,
} from '../timeline/types'

// Skia-specific types

// Viewport transform state (shared values for worklet animations)
export interface ViewportTransform {
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
}

// Gesture state
export interface GestureState {
  isPanning: SharedValue<boolean>
  isPinching: SharedValue<boolean>
}

// Skia canvas props
export interface SkiaTimelineCanvasProps {
  layouts: import('../timeline/types').TimelineTableLayout[]
  serviceStartHour: number
  serviceEndHour: number
  nowMinutes: number
  showNowLine: boolean
  selectedReservationId: number | null
  occupancySlots?: import('../timeline/types').OccupancySlot[]
  totalCapacity?: number
  onReservationPress: (reservation: Reservation) => void
  onDragStart?: (reservation: Reservation) => void
  onDragEnd?: (reservationId: number, tableId: number) => void
}

// Renderer props (used by individual rendering components)
export interface GridRendererProps {
  serviceStartHour: number
  serviceEndHour: number
  contentWidth: number
  contentHeight: number
}

export interface HourMarkersRendererProps {
  serviceStartHour: number
  serviceEndHour: number
  contentWidth: number
}

export interface TableLabelsRendererProps {
  layouts: import('../timeline/types').TimelineTableLayout[]
}

export interface ReservationBarsRendererProps {
  layouts: import('../timeline/types').TimelineTableLayout[]
  serviceStartHour: number
  serviceEndHour: number
  contentWidth: number
  selectedReservationId: number | null
  onBarPress: (reservation: Reservation) => void
}

export interface OccupancyGraphRendererProps {
  slots: import('../timeline/types').OccupancySlot[]
  maxCovers: number
  serviceStartHour: number
  serviceEndHour: number
  contentWidth: number
  nowMinutes: number
  showNowLine: boolean
}

export interface NowLineRendererProps {
  nowMinutes: number
  serviceStartHour: number
  serviceEndHour: number
  contentWidth: number
  contentHeight: number
}

// Hit test result
export interface HitTestResult {
  reservation: Reservation
  barIndex: number
  tableKey: string
}

// Drag overlay state
export interface DragOverlayState {
  isActive: SharedValue<boolean>
  reservationId: SharedValue<number | null>
  x: SharedValue<number>
  y: SharedValue<number>
  targetTableId: SharedValue<number | null>
}
