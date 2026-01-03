import { Neo } from '@/constants/theme'

// Re-export from original constants for layout calculations
export {
  SERVICE_START_HOUR,
  SERVICE_END_HOUR,
  TOTAL_SERVICE_MINUTES,
  ROW_HEIGHT,
  ROW_MIN_HEIGHT,
  BAR_HEIGHT,
  BAR_MIN_HEIGHT,
  LANE_GAP,
  ROW_PADDING,
  TABLE_LABEL_WIDTH,
  HOUR_MARKER_HEIGHT,
  OCCUPANCY_GRAPH_HEIGHT,
  OCCUPANCY_SLOT_MINUTES,
  STATUS_BAR_COLORS,
  FADED_OPACITY,
  COMPLETED_OPACITY,
  NOW_LINE_WIDTH,
  NOW_MARKER_SIZE,
  LONG_PRESS_DURATION,
} from '../timeline/constants'

// Skia-specific constants
export const MIN_SCALE = 0.5
export const MAX_SCALE = 3.0
export const DEFAULT_SCALE = 1.0

// Base width per hour at scale 1.0 (in pixels)
export const BASE_HOUR_WIDTH = 120

// Neo-brutalist styling
export const SHADOW_OFFSET = 4
export const BORDER_WIDTH = 2
export const SELECTED_BORDER_WIDTH = 3
export const SELECTED_SHADOW_OFFSET = 6

// Text styling
export const BAR_FONT_SIZE = 10
export const HOUR_FONT_SIZE = 10
export const TABLE_LABEL_FONT_SIZE = 11
export const CAPACITY_FONT_SIZE = 8
export const COVERS_FONT_SIZE = 9

// Header heights (combined for occupancy + hour markers)
export const HEADER_HEIGHT = 60 + 32 // OCCUPANCY_GRAPH_HEIGHT + HOUR_MARKER_HEIGHT

// Status colors with proper text contrast
export const STATUS_TEXT_COLORS: Record<string, string> = {
  PENDING_PAYMENT: Neo.white,
  BOOKED: Neo.white,
  CONFIRMED: Neo.black,
  SEATED: Neo.black,
  COMPLETED: Neo.white,
  CANCELLED: Neo.black,
  NO_SHOW: Neo.white,
}

// Grid line opacity and thresholds
export const GRID_LINE_OPACITY = 0.1

// Zoom thresholds for showing different grid levels
export const GRID_THRESHOLDS = {
  showHalfHour: 0.75,    // Show 30-min lines at scale >= 0.75
  showQuarterHour: 1.5,  // Show 15-min lines at scale >= 1.5
  showHalfHourLabels: 1.5, // Show :30 labels at scale >= 1.5
}

// Grid line opacity by type (hex suffix)
export const GRID_OPACITY = {
  hour: '33',        // ~20%
  halfHour: '1A',    // ~10%
  quarterHour: '0F', // ~6%
}

// Gesture configuration
export const PAN_DECELERATION = 0.998
export const MOMENTUM_VELOCITY_FACTOR = 0.5
