import type { Reservation, TableWithStatus, SeatingSettings } from '@/lib/types'

// Positioned reservation bar for rendering
export interface TimelineBarLayout {
  reservation: Reservation
  startMinutes: number
  endMinutes: number
  startPercent: number
  widthPercent: number
  laneIndex: number
  isConflict: boolean
}

// Layout for a single table row
export interface TimelineTableLayout {
  tableKey: string
  table: TableWithStatus | null // null for "Unassigned"
  bars: TimelineBarLayout[]
  laneCount: number
  rowHeight: number
  hasConflicts: boolean
}

// Occupancy data point
export interface OccupancySlot {
  time: string // "HH:MM"
  covers: number
  capacity?: number
}

// Occupancy timeline response from API
export interface OccupancyTimelineResponse {
  slots: OccupancySlot[]
  peakCovers: number
  totalCovers: number
}

// Timeline view props
export interface TimelineViewProps {
  date: string // YYYY-MM-DD
  reservations: Reservation[]
  tables: TableWithStatus[]
  seatingSettings?: SeatingSettings | null
  isLiveMode: boolean
  selectedReservationId: number | null
  onReservationPress: (reservation: Reservation) => void
  onReservationDragComplete?: (reservationId: number, targetTableId: number) => void
}

// Canvas props (with gesture state)
export interface TimelineCanvasProps {
  layouts: TimelineTableLayout[]
  serviceStartHour: number
  serviceEndHour: number
  zoomIndex: number
  scrollOffsetMinutes: number
  nowMinutes: number
  showNowLine: boolean
  selectedReservationId: number | null
  occupancySlots?: OccupancySlot[]
  onReservationPress: (reservation: Reservation) => void
  onScrollChange: (minutes: number) => void
  onZoomChange: (index: number) => void
  onDragStart?: (reservation: Reservation) => void
  onDragEnd?: (tableId: number | null) => void
}

// Table row props
export interface TimelineTableRowProps {
  layout: TimelineTableLayout
  serviceStartHour: number
  serviceEndHour: number
  zoomIndex: number
  scrollOffsetMinutes: number
  selectedReservationId: number | null
  onReservationPress: (reservation: Reservation) => void
  onDragStart?: (reservation: Reservation) => void
  isDragTarget?: boolean
}

// Reservation bar props
export interface TimelineReservationBarProps {
  bar: TimelineBarLayout
  isSelected: boolean
  onPress: () => void
  onLongPress?: () => void
}

// Zoom control handlers
export interface ZoomControlsProps {
  zoomIndex: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitAll: () => void
}

// Drag state
export interface TimelineDragState {
  isDragging: boolean
  draggingReservationId: number | null
  dragOverTableId: number | null
}
