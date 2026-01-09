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
  useWindowDimensions,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { NeoSwitch } from '@/components/ui/NeoSwitch'
import { useCreateProduct } from '@/lib/api/mutations'
import type { ProductType } from '@/lib/types'

interface TypeOption {
  type: ProductType
  label: string
  description: string
  color: string
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'ADDON', label: 'ADD-ON', description: 'Event extras', color: Neo.cyan },
  { type: 'FOOD', label: 'FOOD', description: 'Food items', color: Neo.orange },
  { type: 'MERCH', label: 'MERCH', description: 'Merchandise', color: Neo.yellow },
  { type: 'GIFT_CARD', label: 'GIFT CARD', description: 'Store credit', color: Neo.purple },
]

export default function CreateProductScreen() {
  const router = useRouter()
  const createProduct = useCreateProduct()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ProductType>('ADDON')
  const [price, setPrice] = useState('')
  const [giftCardMin, setGiftCardMin] = useState('')
  const [giftCardMax, setGiftCardMax] = useState('')
  const [inventoryQuantity, setInventoryQuantity] = useState('')
  const [active, setActive] = useState(true)
  const [availableInStore, setAvailableInStore] = useState(true)
  const [showStockOnStore, setShowStockOnStore] = useState(false)

  const isGiftCard = type === 'GIFT_CARD'
  const priceCents = Math.round(parseFloat(price || '0') * 100)
  const giftCardMinCents = Math.round(parseFloat(giftCardMin || '0') * 100)
  const giftCardMaxCents = Math.round(parseFloat(giftCardMax || '0') * 100)
  const inventory = inventoryQuantity ? parseInt(inventoryQuantity, 10) : null

  // Validation: name required, price required for non-gift-cards
  const isValid = name.trim().length > 0 && (
    isGiftCard || priceCents > 0
  )

  const handleCreate = () => {
    if (!isValid) {
      Alert.alert('Error', isGiftCard
        ? 'Please enter a product name'
        : 'Please enter a product name and price'
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    createProduct.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        unitAmountCents: isGiftCard ? 0 : priceCents,
        giftCardMinCents: isGiftCard ? (giftCardMinCents || 1000) : undefined, // Default $10 min
        giftCardMaxCents: isGiftCard ? (giftCardMaxCents || 50000) : undefined, // Default $500 max
        inventoryQuantity: isGiftCard ? undefined : (inventory ?? undefined),
        active,
        availableInStore,
        showStockOnStore: availableInStore ? showStockOnStore : false,
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.replace(`/product/${data.id}` as any)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to create product')
        },
      }
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'NEW PRODUCT',
          headerStyle: { backgroundColor: Neo.lime },
          headerTintColor: Neo.black,
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
            {/* Product Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRODUCT TYPE</Text>
              <View style={styles.typeGrid}>
                {TYPE_OPTIONS.map((option) => {
                  // Phone: 2 columns, Tablet: 4 columns
                  const itemWidth = isTablet
                    ? (width - 32 - 36) / 4 // 32 padding, 36 for 3 gaps of 12
                    : (width - 32 - 12) / 2 // 32 padding, 12 for 1 gap

                  return (
                    <Pressable
                      key={option.type}
                      style={[
                        styles.typeOption,
                        { width: itemWidth },
                        type === option.type && { backgroundColor: option.color },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setType(option.type)
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: type === option.type }}
                    >
                      <Text style={[
                        styles.typeOptionText,
                        type === option.type && styles.typeOptionTextSelected,
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.typeOptionDescription}>
                        {option.description}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>NAME *</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Product name"
                  placeholderTextColor={Neo.black + '40'}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.messageInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Product description (optional)"
                  placeholderTextColor={Neo.black + '40'}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            {/* Pricing - different for gift cards vs other types */}
            {isGiftCard ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>VALUE RANGE</Text>
                <Text style={styles.sectionHint}>
                  Customers choose their value. Defaults: $10 - $500
                </Text>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceRangeInput}>
                    <Text style={styles.priceRangeLabel}>MIN</Text>
                    <View style={styles.priceInputSmall}>
                      <Text style={styles.currencySymbolSmall}>$</Text>
                      <TextInput
                        style={styles.priceInputText}
                        value={giftCardMin}
                        onChangeText={setGiftCardMin}
                        placeholder="10"
                        placeholderTextColor={Neo.black + '40'}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <Text style={styles.priceRangeDash}>—</Text>
                  <View style={styles.priceRangeInput}>
                    <Text style={styles.priceRangeLabel}>MAX</Text>
                    <View style={styles.priceInputSmall}>
                      <Text style={styles.currencySymbolSmall}>$</Text>
                      <TextInput
                        style={styles.priceInputText}
                        value={giftCardMax}
                        onChangeText={setGiftCardMax}
                        placeholder="500"
                        placeholderTextColor={Neo.black + '40'}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PRICE *</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor={Neo.black + '40'}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {/* Inventory (non-gift-cards only) */}
            {!isGiftCard && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>INVENTORY</Text>
                <Text style={styles.sectionHint}>
                  Leave blank for unlimited stock
                </Text>
                <View style={styles.inputCard}>
                  <View style={styles.inventoryRow}>
                    <Text style={styles.inventoryLabel}>QUANTITY</Text>
                    <TextInput
                      style={styles.inventoryInput}
                      value={inventoryQuantity}
                      onChangeText={setInventoryQuantity}
                      placeholder="∞"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SETTINGS</Text>
              <View style={styles.toggleCard}>
                <NeoSwitch
                  label="Active"
                  description="Product can be purchased"
                  value={active}
                  onToggle={() => setActive(!active)}
                />
                <View style={styles.toggleRowBorder}>
                  <NeoSwitch
                    label="Visible in Store"
                    description="Show in online store"
                    value={availableInStore}
                    onToggle={() => setAvailableInStore(!availableInStore)}
                  />
                </View>
                {availableInStore && !isGiftCard && (
                  <View style={styles.toggleRowBorder}>
                    <NeoSwitch
                      label="Show Stock Quantity"
                      description="Display available quantity to customers"
                      value={showStockOnStore}
                      onToggle={() => setShowStockOnStore(!showStockOnStore)}
                    />
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Create Button */}
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.createButton,
                (!isValid || createProduct.isPending) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!isValid || createProduct.isPending}
              accessibilityRole="button"
              accessibilityLabel="Create product"
            >
              {createProduct.isPending ? (
                <ActivityIndicator color={Neo.black} />
              ) : (
                <Text style={styles.createButtonText}>CREATE PRODUCT</Text>
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
  sectionHint: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeOption: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.sm,
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  typeOptionTextSelected: {
    color: Neo.black,
  },
  typeOptionDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
  },
  inputCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  textInput: {
    padding: 16,
    fontSize: 14,
    color: Neo.black,
  },
  messageInput: {
    padding: 16,
    fontSize: 14,
    color: Neo.black,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceRangeInput: {
    flex: 1,
  },
  priceRangeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  priceInputSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    ...NeoShadow.sm,
  },
  currencySymbolSmall: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 4,
  },
  priceInputText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  priceRangeDash: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    opacity: 0.3,
    marginTop: 20,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  inventoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inventoryInput: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textAlign: 'right',
    minWidth: 80,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  toggleRowBorder: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: Neo.cream,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  createButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
