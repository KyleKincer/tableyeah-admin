import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getPaymentModeLabel } from '@/constants/theme'
import { useEventPayment } from '@/lib/api/queries'
import { useUpdateEventPayment } from '@/lib/api/mutations'
import type { PaymentMode } from '@/lib/types'

const PAYMENT_MODES: { key: PaymentMode; label: string; description: string }[] = [
  { key: 'NONE', label: 'FREE', description: 'No payment required' },
  { key: 'PREPAY_PER_PERSON', label: 'PREPAY', description: 'Full payment per person required' },
  { key: 'DEPOSIT_PER_PERSON', label: 'DEPOSIT', description: 'Deposit per person required' },
]

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function PaymentModeOption({
  mode,
  label,
  description,
  isSelected,
  onSelect,
}: {
  mode: PaymentMode
  label: string
  description: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Pressable
      style={[styles.modeOption, isSelected && styles.modeOptionSelected]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onSelect()
      }}
    >
      <View style={styles.modeRadio}>
        {isSelected && <View style={styles.modeRadioInner} />}
      </View>
      <View style={styles.modeInfo}>
        <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>{label}</Text>
        <Text style={styles.modeDescription}>{description}</Text>
      </View>
    </Pressable>
  )
}

export default function PricingScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = parseInt(id, 10)

  const [refreshing, setRefreshing] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('NONE')
  const [pricePerPerson, setPricePerPerson] = useState('')
  const [depositPerPerson, setDepositPerPerson] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [refundPolicy, setRefundPolicy] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const { data, isLoading, refetch } = useEventPayment(eventId)
  const updatePayment = useUpdateEventPayment()

  // Initialize form with fetched data
  useEffect(() => {
    if (data?.event) {
      setPaymentMode(data.event.paymentMode)
      setPricePerPerson(data.event.pricePerPersonCents ? String(data.event.pricePerPersonCents / 100) : '')
      setDepositPerPerson(data.event.depositPerPersonCents ? String(data.event.depositPerPersonCents / 100) : '')
      setCurrency(data.event.currency)
      setRefundPolicy(data.event.refundPolicyMd || '')
      setHasChanges(false)
    }
  }, [data])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode)
    setHasChanges(true)
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const priceInCents = pricePerPerson ? Math.round(parseFloat(pricePerPerson) * 100) : null
    const depositInCents = depositPerPerson ? Math.round(parseFloat(depositPerPerson) * 100) : null

    updatePayment.mutate(
      {
        eventId,
        paymentMode,
        pricePerPersonCents: paymentMode === 'PREPAY_PER_PERSON' ? priceInCents : null,
        depositPerPersonCents: paymentMode === 'DEPOSIT_PER_PERSON' ? depositInCents : null,
        currency,
        refundPolicyMd: refundPolicy.trim() || null,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setHasChanges(false)
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update pricing')
        },
      }
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Neo.black} />
        </View>
      </SafeAreaView>
    )
  }

  const showStripeWarning = paymentMode !== 'NONE' && !data?.connectEnabled

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
        }
      >
        {/* Payment Mode Selection */}
        <SectionHeader title="PAYMENT MODE" />
        <View style={styles.modesContainer}>
          {PAYMENT_MODES.map((mode) => (
            <PaymentModeOption
              key={mode.key}
              mode={mode.key}
              label={mode.label}
              description={mode.description}
              isSelected={paymentMode === mode.key}
              onSelect={() => handleModeChange(mode.key)}
            />
          ))}
        </View>

        {/* Stripe Warning */}
        {showStripeWarning && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>STRIPE NOT CONNECTED</Text>
            <Text style={styles.warningText}>
              Paid events require Stripe Connect to be set up. Go to Settings in the web dashboard to connect your Stripe account.
            </Text>
          </View>
        )}

        {/* Price Configuration */}
        {paymentMode === 'PREPAY_PER_PERSON' && (
          <>
            <SectionHeader title="PRICE PER PERSON" />
            <View style={styles.priceInputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={pricePerPerson}
                onChangeText={(text) => {
                  setPricePerPerson(text)
                  setHasChanges(true)
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={`${Neo.black}40`}
              />
            </View>
          </>
        )}

        {paymentMode === 'DEPOSIT_PER_PERSON' && (
          <>
            <SectionHeader title="DEPOSIT PER PERSON" />
            <View style={styles.priceInputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={depositPerPerson}
                onChangeText={(text) => {
                  setDepositPerPerson(text)
                  setHasChanges(true)
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={`${Neo.black}40`}
              />
            </View>
          </>
        )}

        {/* Refund Policy */}
        {paymentMode !== 'NONE' && (
          <>
            <SectionHeader title="REFUND POLICY (OPTIONAL)" />
            <TextInput
              style={styles.refundPolicyInput}
              value={refundPolicy}
              onChangeText={(text) => {
                setRefundPolicy(text)
                setHasChanges(true)
              }}
              placeholder="Describe your cancellation and refund policy..."
              placeholderTextColor={`${Neo.black}40`}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        )}

        {/* Save Button */}
        {hasChanges && (
          <View style={styles.saveContainer}>
            <Pressable
              style={[styles.saveButton, updatePayment.isPending && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={updatePayment.isPending}
            >
              {updatePayment.isPending ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modesContainer: {
    gap: 12,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 16,
    gap: 14,
  },
  modeOptionSelected: {
    backgroundColor: Neo.lime + '30',
    borderWidth: NeoBorder.default,
  },
  modeRadio: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Neo.black,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeRadioInner: {
    width: 10,
    height: 10,
    backgroundColor: Neo.black,
    borderRadius: 5,
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modeLabelSelected: {
    fontWeight: '900',
  },
  modeDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  warningBox: {
    backgroundColor: Neo.pink + '30',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.pink,
    padding: 16,
    marginTop: 16,
  },
  warningTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '800',
    color: Neo.black,
    paddingLeft: 16,
    paddingRight: 8,
  },
  priceInput: {
    flex: 1,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refundPolicyInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 100,
  },
  saveContainer: {
    marginTop: 32,
  },
  saveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 18,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
