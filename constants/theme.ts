import { Platform, StyleSheet } from 'react-native'

// Neo-Brutalism Color Palette
export const Neo = {
  // Primary accent colors
  yellow: '#FFE600',
  lime: '#C8FF00',
  cyan: '#00FFFF',
  pink: '#FF6B9D',
  orange: '#e65d0e',
  purple: '#A855F7',
  blue: '#3B82F6',

  // Neutrals
  black: '#0A0A0A',
  white: '#FAFAFA',
  cream: '#FFF8E7',

  // Status colors (for reservations)
  status: {
    booked: '#3B82F6', // blue
    confirmed: '#C8FF00', // lime
    seated: '#00FFFF', // cyan
    completed: '#6B7280', // gray
    cancelled: '#FF6B9D', // pink
    noShow: '#e65d0e', // orange
  },

  // Waitlist status colors
  waitlist: {
    waiting: '#3B82F6', // blue - actively waiting
    notified: '#C8FF00', // lime - guest notified
    converted: '#00FFFF', // cyan - seated (converted to reservation)
    expired: '#6B7280', // gray - timed out
    cancelled: '#FF6B9D', // pink - cancelled
  },

  // Payment status colors
  payment: {
    pending: '#FFE600', // yellow - requires payment
    paid: '#C8FF00', // lime - paid
    refunded: '#FF6B9D', // pink - refunded
    partial: '#e65d0e', // orange - partially refunded
    expired: '#6B7280', // gray - expired
  },
}

// Shadow configurations for neo-brutalism offset effect
export const NeoShadow = {
  sm: {
    shadowColor: Neo.black,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  default: {
    shadowColor: Neo.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  lg: {
    shadowColor: Neo.black,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  pressed: {
    shadowColor: Neo.black,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
}

// Border configurations
export const NeoBorder = {
  thin: 2,
  default: 3,
  thick: 4,
}

// Legacy color system for compatibility
const tintColorLight = Neo.black
const tintColorDark = Neo.yellow

export const Colors = {
  light: {
    text: Neo.black,
    background: Neo.cream,
    tint: tintColorLight,
    icon: Neo.black,
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Neo.white,
    background: Neo.black,
    tint: tintColorDark,
    icon: Neo.white,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    // Bold display font - using system bold
    display: 'System',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: 'normal',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    display: "'Syne', system-ui, sans-serif",
  },
})

// Common neo-brutalism styles
export const NeoStyles = StyleSheet.create({
  // Cards
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
    ...NeoShadow.default,
  },
  cardSmall: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderRadius: 0,
    ...NeoShadow.sm,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
    ...NeoShadow.sm,
  },
  buttonSecondary: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
    ...NeoShadow.sm,
  },
  buttonDestructive: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
    ...NeoShadow.sm,
  },
  buttonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },

  // Inputs
  input: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Tags/Badges
  tag: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // Typography
  textDisplay: {
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  textMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  textLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },

  // Screen background
  screenBackground: {
    backgroundColor: Neo.cream,
  },
})

// Helper to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'BOOKED':
    case 'PENDING_PAYMENT':
      return Neo.status.booked
    case 'CONFIRMED':
      return Neo.status.confirmed
    case 'SEATED':
      return Neo.status.seated
    case 'COMPLETED':
      return Neo.status.completed
    case 'CANCELLED':
      return Neo.status.cancelled
    case 'NO_SHOW':
      return Neo.status.noShow
    default:
      return Neo.status.completed
  }
}

// Helper to get contrasting text color for a background
export function getContrastText(bgColor: string): string {
  // For bright colors like lime, cyan, yellow - use black text
  if ([Neo.lime, Neo.cyan, Neo.yellow, Neo.white, Neo.cream].includes(bgColor)) {
    return Neo.black
  }
  return Neo.white
}

// Helper to get waitlist status color
export function getWaitlistStatusColor(status: string): string {
  switch (status) {
    case 'WAITING':
      return Neo.waitlist.waiting
    case 'NOTIFIED':
      return Neo.waitlist.notified
    case 'CONVERTED':
      return Neo.waitlist.converted
    case 'EXPIRED':
      return Neo.waitlist.expired
    case 'CANCELLED':
      return Neo.waitlist.cancelled
    default:
      return Neo.waitlist.waiting
  }
}

// Helper to get payment status color
export function getPaymentStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'REQUIRES_PAYMENT':
      return Neo.payment.pending
    case 'PAID':
      return Neo.payment.paid
    case 'REFUNDED':
      return Neo.payment.refunded
    case 'PARTIALLY_REFUNDED':
      return Neo.payment.partial
    case 'EXPIRED':
      return Neo.payment.expired
    default:
      return Neo.black + '40'
  }
}

// Helper to get payment mode display label
export function getPaymentModeLabel(mode: string): string {
  switch (mode) {
    case 'NONE':
      return 'FREE'
    case 'PREPAY_PER_PERSON':
      return 'PREPAY'
    case 'DEPOSIT_PER_PERSON':
      return 'DEPOSIT'
    default:
      return mode
  }
}
