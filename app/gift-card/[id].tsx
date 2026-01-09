import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useGiftCard } from '@/lib/api/queries'
import { useAdjustGiftCardBalance, useVoidGiftCard } from '@/lib/api/mutations'
import type { GiftCardStatus, GiftCardTransaction } from '@/lib/types'

function getStatusColor(status: GiftCardStatus): string {
  switch (status) {
    case 'ACTIVE':
      return Neo.lime
    case 'VOID':
      return Neo.pink
    default:
      return Neo.cream
  }
}

function getTransactionColor(type: GiftCardTransaction['type']): string {
  switch (type) {
    case 'ISSUE':
      return Neo.lime
    case 'REDEEM':
      return Neo.cyan
    case 'REDEEM_REVERSAL':
      return Neo.orange
    case 'ADJUST':
      return Neo.yellow
    case 'VOID':
      return Neo.pink
    default:
      return Neo.cream
  }
}

function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatCode(code: string): string {
  // Format as XXXX-XXXX-XXXX-XXXX
  const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  return cleaned.match(/.{1,4}/g)?.join('-') || code
}

function formatDate(dateString: string | undefined | null, formatStr: string): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'
    return format(date, formatStr)
  } catch {
    return 'N/A'
  }
}

function TransactionItem({ transaction, currency }: { transaction: GiftCardTransaction; currency: string }) {
  const isPositive = transaction.amountCents >= 0

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={[styles.transactionBadge, { backgroundColor: getTransactionColor(transaction.type) }]}>
          <Text style={styles.transactionBadgeText}>{transaction.type.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.transactionDate}>
          {formatDate(transaction.createdAt, 'MMM d, h:mm a')}
        </Text>
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionAmount, !isPositive && styles.transactionAmountNegative]}>
          {isPositive ? '+' : ''}{formatCurrency(transaction.amountCents, currency)}
        </Text>
        {transaction.note && (
          <Text style={styles.transactionNote}>{transaction.note}</Text>
        )}
      </View>
    </View>
  )
}

export default function GiftCardDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const giftCardId = id ? parseInt(id, 10) : null

  const { data: giftCard, isLoading, refetch } = useGiftCard(giftCardId)
  const adjustBalance = useAdjustGiftCardBalance()
  const voidCard = useVoidGiftCard()

  const [refreshing, setRefreshing] = useState(false)
  const [adjustModalVisible, setAdjustModalVisible] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [voidModalVisible, setVoidModalVisible] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleAdjustBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (!giftCard) return
    setAdjustAmount('')
    setAdjustNote('')
    setAdjustModalVisible(true)
  }

  const submitAdjustment = () => {
    if (!giftCardId) return

    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      Alert.alert('Error', 'Please enter a valid non-zero amount')
      return
    }
    const amountCents = Math.round(amount * 100)

    adjustBalance.mutate(
      { giftCardId, amountCents, note: adjustNote || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setAdjustModalVisible(false)
          refetch()
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to adjust balance')
        },
      }
    )
  }

  const handleVoid = () => {
    if (!giftCard || !giftCardId) return
    setVoidReason('')
    setVoidModalVisible(true)
  }

  const submitVoid = () => {
    if (!giftCardId) return

    voidCard.mutate(
      { giftCardId, note: voidReason || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setVoidModalVisible(false)
          refetch()
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to void gift card')
        },
      }
    )
  }

  if (isLoading || !giftCard) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'GIFT CARD',
            headerStyle: { backgroundColor: Neo.purple },
            headerTintColor: Neo.white,
          }}
        />
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Neo.black} />
          </View>
        </SafeAreaView>
      </>
    )
  }

  const availableBalance = giftCard.balanceCents - (giftCard.activeHoldsCents || 0)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'GIFT CARD',
          headerStyle: { backgroundColor: Neo.purple },
          headerTintColor: Neo.white,
        }}
      />
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.giftCardCode}>{formatCode(giftCard.code)}</Text>
              <View style={[styles.badge, { backgroundColor: getStatusColor(giftCard.status) }]}>
                <Text style={styles.badgeText}>{giftCard.status}</Text>
              </View>
            </View>
            <Text style={styles.giftCardDate}>
              Issued {formatDate(giftCard.createdAt, 'MMMM d, yyyy')}
            </Text>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
              <Text style={styles.balanceValue}>
                {formatCurrency(giftCard.balanceCents, giftCard.currency)}
              </Text>
            </View>
            {giftCard.activeHoldsCents > 0 && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceSubLabel}>Available (after holds)</Text>
                <Text style={styles.balanceSubValue}>
                  {formatCurrency(availableBalance, giftCard.currency)}
                </Text>
              </View>
            )}
            <View style={styles.balanceRow}>
              <Text style={styles.balanceSubLabel}>Initial value</Text>
              <Text style={styles.balanceSubValue}>
                {formatCurrency(giftCard.initialValueCents, giftCard.currency)}
              </Text>
            </View>
          </View>

          {/* Recipient Info */}
          {(giftCard.recipientName || giftCard.recipientEmail) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RECIPIENT</Text>
              <View style={styles.sectionCard}>
                {giftCard.recipientName && (
                  <Text style={styles.recipientName}>{giftCard.recipientName}</Text>
                )}
                {giftCard.recipientEmail && (
                  <Text style={styles.recipientEmail}>{giftCard.recipientEmail}</Text>
                )}
                <View style={styles.deliveryBadge}>
                  <Text style={styles.deliveryBadgeText}>
                    {giftCard.deliveryMethod === 'EMAIL' ? 'EMAILED' : 'PRINTED'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          {giftCard.status === 'ACTIVE' && (
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={handleAdjustBalance}
                disabled={adjustBalance.isPending}
                accessibilityRole="button"
                accessibilityLabel="Adjust balance"
              >
                <Text style={styles.actionButtonText}>ADJUST BALANCE</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.actionButtonDestructive]}
                onPress={handleVoid}
                disabled={voidCard.isPending}
                accessibilityRole="button"
                accessibilityLabel="Void gift card"
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>VOID</Text>
              </Pressable>
            </View>
          )}

          {/* Transaction History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              TRANSACTIONS ({giftCard.transactions?.length || 0})
            </Text>
            <View style={styles.sectionCard}>
              {giftCard.transactions && giftCard.transactions.length > 0 ? (
                giftCard.transactions.map((transaction, index) => (
                  <View
                    key={transaction.id}
                    style={[
                      index > 0 && styles.transactionBorder,
                    ]}
                  >
                    <TransactionItem
                      transaction={transaction}
                      currency={giftCard.currency}
                    />
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No transactions yet</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Adjust Balance Modal */}
        <Modal
          visible={adjustModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAdjustModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>ADJUST BALANCE</Text>
              <Text style={styles.modalSubtitle}>
                Enter amount (positive to add, negative to subtract)
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={Neo.black + '40'}
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={styles.modalLabel}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Reason for adjustment..."
                placeholderTextColor={Neo.black + '40'}
                value={adjustNote}
                onChangeText={setAdjustNote}
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setAdjustModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={submitAdjustment}
                  disabled={adjustBalance.isPending}
                >
                  <Text style={styles.modalButtonText}>
                    {adjustBalance.isPending ? 'ADJUSTING...' : 'ADJUST'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Void Modal */}
        <Modal
          visible={voidModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVoidModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>VOID GIFT CARD</Text>
              <Text style={styles.modalSubtitle}>
                This will set the balance to $0 and cannot be undone.
                {giftCard && `\n\nCurrent balance: ${formatCurrency(giftCard.balanceCents, giftCard.currency)}`}
              </Text>

              <Text style={styles.modalLabel}>REASON (OPTIONAL)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Reason for voiding..."
                placeholderTextColor={Neo.black + '40'}
                value={voidReason}
                onChangeText={setVoidReason}
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setVoidModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonDestructive]}
                  onPress={submitVoid}
                  disabled={voidCard.isPending}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextLight]}>
                    {voidCard.isPending ? 'VOIDING...' : 'VOID CARD'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  giftCardCode: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  giftCardDate: {
    fontSize: 12,
    color: Neo.white,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
  },
  balanceSubLabel: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceSubValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 4,
  },
  recipientEmail: {
    fontSize: 13,
    color: Neo.black,
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  deliveryBadge: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  deliveryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  actionButtonPrimary: {
    backgroundColor: Neo.lime,
  },
  actionButtonDestructive: {
    backgroundColor: Neo.pink,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionButtonTextLight: {
    color: Neo.black,
  },
  transactionItem: {
    paddingVertical: 12,
  },
  transactionBorder: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  transactionBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  transactionDate: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
  },
  transactionAmountNegative: {
    color: Neo.pink,
  },
  transactionNote: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 13,
    color: Neo.black,
    opacity: 0.4,
    textAlign: 'center',
    paddingVertical: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...NeoShadow.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalSubtitle: {
    fontSize: 13,
    color: Neo.black,
    opacity: 0.6,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalInputMultiline: {
    fontSize: 14,
    fontWeight: '400',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  modalButtonPrimary: {
    backgroundColor: Neo.lime,
  },
  modalButtonSecondary: {
    backgroundColor: Neo.white,
  },
  modalButtonDestructive: {
    backgroundColor: Neo.pink,
  },
  modalButtonTextLight: {
    color: Neo.black,
  },
  modalButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
