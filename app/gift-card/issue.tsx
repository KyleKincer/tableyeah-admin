import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { NeoSwitch } from '@/components/ui/NeoSwitch'
import { useIssueGiftCard } from '@/lib/api/mutations'

export default function IssueGiftCardScreen() {
  const router = useRouter()
  const issueGiftCard = useIssueGiftCard()

  const [amount, setAmount] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'EMAIL' | 'PRINT'>('EMAIL')
  const [sendEmail, setSendEmail] = useState(true)

  const amountCents = Math.round(parseFloat(amount || '0') * 100)
  const isValidAmount = amountCents > 0

  const handleIssue = () => {
    if (!isValidAmount) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    if (deliveryMethod === 'EMAIL' && sendEmail && !recipientEmail) {
      Alert.alert('Error', 'Please enter a recipient email to send the gift card')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    issueGiftCard.mutate(
      {
        valueCents: amountCents,
        recipientEmail: recipientEmail || undefined,
        recipientName: recipientName || undefined,
        message: personalMessage || undefined,
        deliveryMethod,
        sendEmail: deliveryMethod === 'EMAIL' ? sendEmail : false,
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          Alert.alert(
            'Gift Card Issued',
            `Gift card created successfully!\n\nCode: ${data.code || 'See details'}`,
            [
              {
                text: 'View Card',
                onPress: () => router.replace(`/gift-card/${data.id}` as any),
              },
              {
                text: 'Done',
                onPress: () => router.back(),
              },
            ]
          )
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to issue gift card')
        },
      }
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'ISSUE GIFT CARD',
          headerStyle: { backgroundColor: Neo.purple },
          headerTintColor: Neo.white,
          presentation: 'modal',
        }}
      />
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>VALUE</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={Neo.black + '40'}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
            </View>

            {/* Delivery Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DELIVERY METHOD</Text>
              <View style={styles.deliveryOptions}>
                <Pressable
                  style={[
                    styles.deliveryOption,
                    deliveryMethod === 'EMAIL' && styles.deliveryOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setDeliveryMethod('EMAIL')
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: deliveryMethod === 'EMAIL' }}
                >
                  <Text style={[
                    styles.deliveryOptionText,
                    deliveryMethod === 'EMAIL' && styles.deliveryOptionTextSelected,
                  ]}>
                    EMAIL
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.deliveryOption,
                    deliveryMethod === 'PRINT' && styles.deliveryOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setDeliveryMethod('PRINT')
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: deliveryMethod === 'PRINT' }}
                >
                  <Text style={[
                    styles.deliveryOptionText,
                    deliveryMethod === 'PRINT' && styles.deliveryOptionTextSelected,
                  ]}>
                    PRINT
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Recipient Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RECIPIENT (OPTIONAL)</Text>
              <View style={styles.inputCard}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="John Doe"
                    placeholderTextColor={Neo.black + '40'}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.inputRow, styles.inputRowBorder]}>
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.textInput}
                    value={recipientEmail}
                    onChangeText={setRecipientEmail}
                    placeholder="john@example.com"
                    placeholderTextColor={Neo.black + '40'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            {/* Personal Message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL MESSAGE (OPTIONAL)</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.messageInput}
                  value={personalMessage}
                  onChangeText={setPersonalMessage}
                  placeholder="Add a personal message..."
                  placeholderTextColor={Neo.black + '40'}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            {/* Send Email Toggle */}
            {deliveryMethod === 'EMAIL' && recipientEmail && (
              <View style={styles.section}>
                <View style={styles.toggleCard}>
                  <NeoSwitch
                    label="Send Email to Recipient"
                    description="Send the gift card code to the recipient's email"
                    value={sendEmail}
                    onToggle={() => setSendEmail(!sendEmail)}
                  />
                </View>
              </View>
            )}

            {/* Summary */}
            {isValidAmount && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gift Card Value</Text>
                  <Text style={styles.summaryValue}>
                    ${(amountCents / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery</Text>
                  <Text style={styles.summaryValue}>
                    {deliveryMethod === 'EMAIL' ? 'Email' : 'Print'}
                  </Text>
                </View>
                {recipientEmail && deliveryMethod === 'EMAIL' && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Send to</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {recipientEmail}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Issue Button */}
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.issueButton,
                (!isValidAmount || issueGiftCard.isPending) && styles.issueButtonDisabled,
              ]}
              onPress={handleIssue}
              disabled={!isValidAmount || issueGiftCard.isPending}
              accessibilityRole="button"
              accessibilityLabel="Issue gift card"
            >
              {issueGiftCard.isPending ? (
                <ActivityIndicator color={Neo.black} />
              ) : (
                <Text style={styles.issueButtonText}>ISSUE GIFT CARD</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deliveryOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  deliveryOption: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  deliveryOptionSelected: {
    backgroundColor: Neo.lime,
  },
  deliveryOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deliveryOptionTextSelected: {
    opacity: 1,
    fontWeight: '800',
  },
  inputCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  inputRowBorder: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  inputLabel: {
    width: 70,
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  messageInput: {
    padding: 16,
    fontSize: 14,
    color: Neo.black,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggleCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  summaryCard: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    maxWidth: '60%',
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: Neo.cream,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  issueButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  issueButtonDisabled: {
    opacity: 0.5,
  },
  issueButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
