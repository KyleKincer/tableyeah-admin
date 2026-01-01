import { Platform, StyleSheet, Text, View } from 'react-native'

import { Neo, NeoBorder, getPaymentModeLabel, getContrastText } from '@/constants/theme'
import type { PaymentMode, PaymentStatus } from '@/lib/types'

interface PaymentModeBadgeProps {
  mode: PaymentMode
  pricePerPersonCents?: number | null
  currency?: string
}

export function PaymentModeBadge({ mode, pricePerPersonCents, currency = 'USD' }: PaymentModeBadgeProps) {
  const label = getPaymentModeLabel(mode)
  const bgColor = mode === 'NONE' ? Neo.black + '20' : Neo.lime
  const textColor = mode === 'NONE' ? Neo.black : Neo.black

  const priceText = pricePerPersonCents
    ? ` $${(pricePerPersonCents / 100).toFixed(0)}`
    : ''

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>
        {label}{priceText}
      </Text>
    </View>
  )
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus | null | undefined
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  if (!status) return null

  let bgColor: string
  let label: string

  switch (status) {
    case 'REQUIRES_PAYMENT':
      bgColor = Neo.payment.pending
      label = 'PENDING'
      break
    case 'PAID':
      bgColor = Neo.payment.paid
      label = 'PAID'
      break
    case 'REFUNDED':
      bgColor = Neo.payment.refunded
      label = 'REFUNDED'
      break
    case 'PARTIALLY_REFUNDED':
      bgColor = Neo.payment.partial
      label = 'PARTIAL'
      break
    case 'EXPIRED':
      bgColor = Neo.payment.expired
      label = 'EXPIRED'
      break
    default:
      return null
  }

  const textColor = getContrastText(bgColor)

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
