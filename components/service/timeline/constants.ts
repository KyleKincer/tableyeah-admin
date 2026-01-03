import { Neo } from '@/constants/theme'

// Zoom levels: number of hours visible at each zoom level
export const ZOOM_LEVELS = [3, 4, 5, 6, 8, 10, 13]
export const DEFAULT_ZOOM_INDEX = 1 // 4 hours visible by default

// Service hours (can be overridden by restaurant settings)
export const SERVICE_START_HOUR = 10 // 10 AM
export const SERVICE_END_HOUR = 23 // 11 PM
export const TOTAL_SERVICE_MINUTES = (SERVICE_END_HOUR - SERVICE_START_HOUR) * 60 // 780 minutes

// Layout dimensions
export const ROW_HEIGHT = 52
export const ROW_MIN_HEIGHT = 52
export const BAR_HEIGHT = 38
export const BAR_MIN_HEIGHT = 38
export const LANE_GAP = 4
export const ROW_PADDING = 6
export const TABLE_LABEL_WIDTH = 60
export const HOUR_MARKER_HEIGHT = 32

// Occupancy graph
export const OCCUPANCY_GRAPH_HEIGHT = 60
export const OCCUPANCY_SLOT_MINUTES = 30 // 30-minute slots

// Status colors for timeline bars (using Neo palette)
export const STATUS_BAR_COLORS: Record<string, string> = {
  PENDING_PAYMENT: Neo.purple,
  BOOKED: Neo.blue,
  CONFIRMED: Neo.lime,
  SEATED: Neo.cyan,
  COMPLETED: '#6B7280', // gray
  CANCELLED: '#9CA3AF', // lighter gray
  NO_SHOW: Neo.orange,
}

// Opacity for faded states
export const FADED_OPACITY = 0.5
export const COMPLETED_OPACITY = 0.7

// Now line
export const NOW_LINE_WIDTH = 3
export const NOW_MARKER_SIZE = 12

// Gesture thresholds
export const LONG_PRESS_DURATION = 300 // ms
export const ZOOM_VELOCITY_THRESHOLD = 0.5
