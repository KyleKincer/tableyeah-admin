import { Neo } from '@/constants/theme'

// Reference dimensions for scaling
export const REFERENCE_WIDTH = 800

// Pan/zoom limits
export const MIN_SCALE = 0.5
export const MAX_SCALE = 3.0
export const DEFAULT_SCALE = 1.0

// Table rendering
export const TABLE_MIN_WIDTH = 50
export const TABLE_MIN_HEIGHT = 40
export const TABLE_BORDER_WIDTH = 2
export const TABLE_BORDER_WIDTH_SELECTED = 3
export const TABLE_SHADOW_OFFSET = 2
export const TABLE_SHADOW_OFFSET_PRESSED = 1

// Turn time badge
export const BADGE_HEIGHT = 18
export const BADGE_PADDING_H = 6
export const BADGE_PADDING_V = 2
export const BADGE_BORDER_WIDTH = 2
export const BADGE_MARGIN_TOP = 4
export const BADGE_SHADOW_OFFSET = 2

// Selection glow
export const SELECTION_GLOW_BLUR = 8
export const SELECTION_GLOW_SPREAD = 4

// Dot grid background
export const DOT_RADIUS = 1.5
export const DOT_SPACING = 24
export const DOT_OPACITY = '26' // ~15% opacity hex suffix

// Text styling
export const TABLE_NUMBER_FONT_SIZE = 14
export const TABLE_CAPACITY_FONT_SIZE = 10
export const BADGE_FONT_SIZE = 9
export const ELEMENT_LABEL_FONT_SIZE = 10

// Table status colors
export const TABLE_STATUS_COLORS: Record<string, string> = {
  available: Neo.lime,
  seated: Neo.cyan,
  upcoming: Neo.orange,
  occupied: Neo.pink,
}

// Turn time status colors
export const TURN_TIME_COLORS = {
  green: Neo.lime,
  amber: Neo.yellow,
  red: Neo.pink,
}

// Floor plan element styling config
export const ELEMENT_STYLES: Record<string, {
  borderWidth: number
  borderOpacity?: number
  fillOpacity?: number
  isCircle?: boolean
  dashed?: boolean
  label?: string
  textOnly?: boolean
}> = {
  WALL: { borderWidth: 2, borderOpacity: 0.6 },
  DIVIDER: { borderWidth: 2, borderOpacity: 0.6 },
  COLUMN: { borderWidth: 3, isCircle: true },
  PLANT: { borderWidth: 1, isCircle: true, fillOpacity: 0.3 },
  ENTRANCE: { borderWidth: 2, dashed: true },
  KITCHEN: { borderWidth: 2, borderOpacity: 0.4, fillOpacity: 0.1, label: 'KITCHEN' },
  BAR_AREA: { borderWidth: 2, borderOpacity: 0.4, fillOpacity: 0.1, label: 'BAR' },
  RESTROOM: { borderWidth: 2, borderOpacity: 0.4, fillOpacity: 0.1, label: 'WC' },
  HOSTESS: { borderWidth: 2, borderOpacity: 0.4, fillOpacity: 0.1, label: 'HOST' },
  LABEL: { borderWidth: 0, textOnly: true },
  DECORATION: { borderWidth: 2, borderOpacity: 0.4, fillOpacity: 0.1 },
}

// Gesture configuration
export const PAN_DECELERATION = 0.998
export const MOMENTUM_VELOCITY_FACTOR = 0.5
export const LONG_PRESS_DURATION = 400

// Animation
export const PRESSED_SCALE = 0.95
export const PRESS_ANIMATION_DURATION = 100
