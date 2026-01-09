import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useBilling, useConnectStatus } from '@/lib/api/queries'
import {
  useCreateCheckout,
  useCreatePortalSession,
  useStartConnectOnboarding,
} from '@/lib/api/mutations'
import type { BillingStatus } from '@/lib/types'

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getStatusColor(status: BillingStatus | null): string {
  switch (status) {
    case 'active':
      return Neo.lime
    case 'trialing':
      return Neo.cyan
    case 'past_due':
      return Neo.orange
    case 'canceled':
    case 'unpaid':
      return Neo.pink
    default:
      return Neo.cream
  }
}

function getStatusLabel(status: BillingStatus | null): string {
  switch (status) {
    case 'active':
      return 'ACTIVE'
    case 'trialing':
      return 'TRIAL'
    case 'past_due':
      return 'PAST DUE'
    case 'canceled':
      return 'CANCELED'
    case 'unpaid':
      return 'UNPAID'
    case 'incomplete':
      return 'INCOMPLETE'
    default:
      return 'NO SUBSCRIPTION'
  }
}

function StatusBadge({ status }: { status: BillingStatus | null }) {
  const bgColor = getStatusColor(status)
  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={styles.statusBadgeText}>{getStatusLabel(status)}</Text>
    </View>
  )
}

function ConnectSection({
  connectStatus,
  onConnect,
  onDashboard,
  isLoading,
}: {
  connectStatus: {
    connected: boolean
    chargesEnabled: boolean
    payoutsEnabled: boolean
    dashboardUrl: string | null
    onboardedAt: string | null
    requiresAction: boolean
  } | null
  onConnect: () => void
  onDashboard: () => void
  isLoading: boolean
}) {
  if (!connectStatus) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={Neo.black} />
      </View>
    )
  }

  return (
    <View style={styles.connectCard}>
      <View style={styles.connectHeader}>
        <View style={styles.connectInfo}>
          <Text style={styles.connectTitle}>EVENT PAYMENTS</Text>
          <Text style={styles.connectDescription}>
            Accept payments for ticketed events
          </Text>
        </View>
        {connectStatus.chargesEnabled ? (
          <View style={[styles.connectBadge, { backgroundColor: Neo.lime }]}>
            <Text style={styles.connectBadgeText}>CONNECTED</Text>
          </View>
        ) : connectStatus.connected ? (
          <View style={[styles.connectBadge, { backgroundColor: Neo.orange }]}>
            <Text style={styles.connectBadgeText}>INCOMPLETE</Text>
          </View>
        ) : (
          <View style={[styles.connectBadge, { backgroundColor: Neo.cream }]}>
            <Text style={styles.connectBadgeText}>NOT CONNECTED</Text>
          </View>
        )}
      </View>

      {connectStatus.chargesEnabled ? (
        <View style={styles.connectActive}>
          <Text style={styles.connectActiveText}>
            Stripe Connect is active. You can charge for events.
          </Text>
          {connectStatus.onboardedAt && (
            <Text style={styles.connectDate}>
              Connected since {formatDate(connectStatus.onboardedAt)}
            </Text>
          )}
        </View>
      ) : connectStatus.connected ? (
        <View style={styles.connectWarning}>
          <Text style={styles.connectWarningText}>
            Additional information required. Complete setup to accept payments.
          </Text>
        </View>
      ) : (
        <View style={styles.connectInfo}>
          <Text style={styles.connectFeatures}>
            • Charge per-person for events{'\n'}
            • Collect deposits{'\n'}
            • Automatic payouts
          </Text>
        </View>
      )}

      <View style={styles.connectActions}>
        {connectStatus.chargesEnabled ? (
          <Pressable
            style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={onDashboard}
            disabled={isLoading || !connectStatus.dashboardUrl}
          >
            <Text style={styles.secondaryButtonText}>STRIPE DASHBOARD</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.connectButton, isLoading && styles.buttonDisabled]}
            onPress={onConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Neo.black} />
            ) : (
              <Text style={styles.connectButtonText}>
                {connectStatus.connected ? 'CONTINUE SETUP' : 'CONNECT STRIPE'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

export function BillingSettings() {
  const { data: billingData, isLoading: billingLoading, refetch: refetchBilling } = useBilling()
  const { data: connectData, isLoading: connectLoading, refetch: refetchConnect } = useConnectStatus()
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const checkoutMutation = useCreateCheckout()
  const portalMutation = useCreatePortalSession()
  const connectMutation = useStartConnectOnboarding()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchBilling(), refetchConnect()])
    setRefreshing(false)
  }, [refetchBilling, refetchConnect])

  const handleStartTrial = async () => {
    setActionLoading('checkout')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    checkoutMutation.mutate(undefined, {
      onSuccess: async (data) => {
        setActionLoading(null)
        if (data.url) {
          await WebBrowser.openBrowserAsync(data.url)
          onRefresh()
        }
      },
      onError: (err: any) => {
        setActionLoading(null)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to start checkout')
      },
    })
  }

  const handleManageSubscription = async () => {
    setActionLoading('portal')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    portalMutation.mutate(undefined, {
      onSuccess: async (data) => {
        setActionLoading(null)
        if (data.url) {
          await WebBrowser.openBrowserAsync(data.url)
          onRefresh()
        }
      },
      onError: (err: any) => {
        setActionLoading(null)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to open billing portal')
      },
    })
  }

  const handleConnectStripe = async () => {
    setActionLoading('connect')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    connectMutation.mutate(undefined, {
      onSuccess: async (data) => {
        setActionLoading(null)
        if (data.url) {
          await WebBrowser.openBrowserAsync(data.url)
          onRefresh()
        }
      },
      onError: (err: any) => {
        setActionLoading(null)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to start Connect onboarding')
      },
    })
  }

  const handleOpenDashboard = async () => {
    if (connectData?.dashboardUrl) {
      await Linking.openURL(connectData.dashboardUrl)
    }
  }

  const billing = billingData?.restaurant?.billing
  const pricing = billingData?.pricing
  const organization = billingData?.organization
  const hasSubscription = billing?.status && billing.status !== 'canceled'
  const isActive = billing?.status === 'active' || billing?.status === 'trialing'

  if (billingLoading && !billingData) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Neo.black} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
      }
    >
      {/* Organization Context */}
      {organization && pricing && pricing.activeLocationCount > 1 && (
        <View style={styles.orgCard}>
          <Text style={styles.orgText}>
            <Text style={styles.orgBold}>{organization.name}</Text> billing covers{' '}
            <Text style={styles.orgBold}>
              {pricing.activeLocationCount} location
              {pricing.activeLocationCount !== 1 ? 's' : ''}
            </Text>
            .
          </Text>
        </View>
      )}

      {/* Current Plan Card */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View style={styles.planInfo}>
            <Text style={styles.planName}>TABLEYEAH PRO</Text>
            <Text style={styles.planDescription}>
              Unlimited reservations, full features
            </Text>
          </View>
          <StatusBadge status={billing?.status || null} />
        </View>

        {/* Pricing breakdown */}
        {pricing && pricing.perLocationBillingEnabled && !pricing.hasOverridePricing && (
          <View style={styles.pricingBreakdown}>
            <Text style={styles.pricingLabel}>PRICING BREAKDOWN</Text>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingItem}>Base (1 location)</Text>
              <Text style={styles.pricingValue}>{formatPrice(pricing.basePriceCents)}/mo</Text>
            </View>
            {pricing.additionalLocations > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingItem}>
                  + {pricing.additionalLocations} additional
                </Text>
                <Text style={styles.pricingValue}>
                  {formatPrice(pricing.addonPriceCents * pricing.additionalLocations)}/mo
                </Text>
              </View>
            )}
            <View style={[styles.pricingRow, styles.pricingTotal]}>
              <Text style={styles.pricingTotalLabel}>Total</Text>
              <Text style={styles.pricingTotalValue}>
                {formatPrice(pricing.totalMonthlyCents)}/mo
              </Text>
            </View>
          </View>
        )}

        {hasSubscription && (
          <View style={styles.billingDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>BILLING PERIOD</Text>
              <Text style={styles.detailValue}>
                {formatDate(billing?.currentPeriodStart || null)} -{' '}
                {formatDate(billing?.currentPeriodEnd || null)}
              </Text>
            </View>
            {billing?.paymentMethodBrand && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>PAYMENT METHOD</Text>
                <Text style={styles.detailValue}>
                  {billing.paymentMethodBrand} •••• {billing.paymentMethodLast4}
                </Text>
              </View>
            )}
          </View>
        )}

        {billing?.status === 'trialing' && billing.currentPeriodEnd && (
          <View style={styles.trialNotice}>
            <Text style={styles.trialNoticeText}>
              Your trial ends on {formatDate(billing.currentPeriodEnd)}
            </Text>
          </View>
        )}

        {billing?.cancelAtPeriodEnd && (
          <View style={styles.cancelNotice}>
            <Text style={styles.cancelNoticeText}>
              Subscription will cancel at period end
            </Text>
          </View>
        )}

        <View style={styles.planActions}>
          {isActive ? (
            <Pressable
              style={[styles.secondaryButton, actionLoading && styles.buttonDisabled]}
              onPress={handleManageSubscription}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'portal' ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.secondaryButtonText}>MANAGE SUBSCRIPTION</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.startTrialRow}>
              <Pressable
                style={[styles.primaryButton, actionLoading && styles.buttonDisabled]}
                onPress={handleStartTrial}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'checkout' ? (
                  <ActivityIndicator size="small" color={Neo.black} />
                ) : (
                  <Text style={styles.primaryButtonText}>START 14-DAY FREE TRIAL</Text>
                )}
              </Pressable>
              <Text style={styles.priceNote}>
                then {pricing ? formatPrice(pricing.totalMonthlyCents) : '$79'}/month
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Features List */}
      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>WHAT'S INCLUDED</Text>
        {[
          'Unlimited reservations',
          'Advanced floor plan editor',
          'Email confirmations & reminders',
          'Guest CRM with tags',
          'SMS notifications',
          'Custom branding',
          'Priority support',
        ].map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Stripe Connect */}
      {isActive && (
        <ConnectSection
          connectStatus={connectData || null}
          onConnect={handleConnectStripe}
          onDashboard={handleOpenDashboard}
          isLoading={actionLoading === 'connect' || connectLoading}
        />
      )}

      {/* Help */}
      <View style={styles.helpCard}>
        <Text style={styles.helpText}>
          Need help? Contact{' '}
          <Text
            style={styles.helpLink}
            onPress={() => Linking.openURL('mailto:support@tableyeah.com')}
          >
            support@tableyeah.com
          </Text>
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Neo.cream,
  },
  loadingCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    ...NeoShadow.lg,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orgCard: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 16,
  },
  orgText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orgBold: {
    fontWeight: '800',
  },
  planCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
  },
  planDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pricingBreakdown: {
    backgroundColor: Neo.cream,
    padding: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
  },
  pricingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pricingItem: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pricingValue: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pricingTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  pricingTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pricingTotalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  billingDetails: {
    padding: 16,
    gap: 12,
  },
  detailItem: {},
  detailLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Neo.black,
  },
  trialNotice: {
    backgroundColor: Neo.cyan,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  trialNoticeText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cancelNotice: {
    backgroundColor: Neo.orange,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  cancelNoticeText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  planActions: {
    padding: 16,
    backgroundColor: Neo.cream,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  startTrialRow: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  secondaryButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  priceNote: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  featuresCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    marginRight: 12,
  },
  featureText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  connectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
  },
  connectInfo: {
    flex: 1,
    marginRight: 12,
  },
  connectTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
  },
  connectDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  connectBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectActive: {
    padding: 16,
  },
  connectActiveText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectDate: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectWarning: {
    backgroundColor: Neo.orange + '30',
    padding: 16,
    margin: 12,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  connectWarningText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectFeatures: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.7,
    lineHeight: 18,
    padding: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectActions: {
    padding: 16,
    backgroundColor: Neo.cream,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  connectButton: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  connectButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  helpCard: {
    padding: 16,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  helpLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
})
