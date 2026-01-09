import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { NeoSwitch } from '@/components/ui/NeoSwitch'
import { VariantEditModal } from '@/components/commerce/VariantEditModal'
import { ProductImagesManager } from '@/components/commerce/ProductImagesManager'
import { useProduct } from '@/lib/api/queries'
import { useUpdateProduct, useDeleteProduct, useAdjustInventory } from '@/lib/api/mutations'
import type { ProductType, ProductVariant } from '@/lib/types'

function getTypeColor(type: ProductType): string {
  switch (type) {
    case 'ADDON':
      return Neo.cyan
    case 'MERCH':
      return Neo.yellow
    case 'FOOD':
      return Neo.orange
    case 'GIFT_CARD':
      return Neo.purple
    default:
      return Neo.cream
  }
}

function getTypeLabel(type: ProductType): string {
  switch (type) {
    case 'ADDON':
      return 'ADD-ON'
    case 'MERCH':
      return 'MERCH'
    case 'FOOD':
      return 'FOOD'
    case 'GIFT_CARD':
      return 'GIFT CARD'
    default:
      return type
  }
}

function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function VariantCard({
  variant,
  currency,
  onAdjustInventory,
  onEdit,
  isAdjusting,
}: {
  variant: ProductVariant
  currency: string
  onAdjustInventory: (variantId: number, delta: number) => void
  onEdit: () => void
  isAdjusting: boolean
}) {
  return (
    <View style={[styles.variantCard, !variant.active && styles.variantCardInactive]}>
      <Pressable
        style={styles.variantInfo}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onEdit()
        }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${variant.label}`}
      >
        <View style={styles.variantLabelRow}>
          <Text style={styles.variantLabel}>{variant.label}</Text>
          {!variant.active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
            </View>
          )}
        </View>
        {variant.sku && <Text style={styles.variantSku}>SKU: {variant.sku}</Text>}
        {variant.unitAmountCentsOverride !== null && (
          <Text style={styles.variantPrice}>
            {formatCurrency(variant.unitAmountCentsOverride, currency)}
          </Text>
        )}
        <Text style={styles.editHint}>Tap to edit</Text>
      </Pressable>
      <View style={styles.variantInventory}>
        <Pressable
          style={[styles.inventoryButton, isAdjusting && styles.inventoryButtonDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onAdjustInventory(variant.id, -1)
          }}
          disabled={isAdjusting || variant.inventoryQuantity <= 0}
          accessibilityRole="button"
          accessibilityLabel="Decrease inventory"
        >
          <Text style={styles.inventoryButtonText}>−</Text>
        </Pressable>
        <Text style={styles.inventoryCount}>{variant.inventoryQuantity}</Text>
        <Pressable
          style={[styles.inventoryButton, isAdjusting && styles.inventoryButtonDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onAdjustInventory(variant.id, 1)
          }}
          disabled={isAdjusting}
          accessibilityRole="button"
          accessibilityLabel="Increase inventory"
        >
          <Text style={styles.inventoryButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function ProductDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const productId = id ? parseInt(id, 10) : null

  const { data: product, isLoading, refetch } = useProduct(productId)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const adjustInventory = useAdjustInventory()

  const [refreshing, setRefreshing] = useState(false)
  const [variantModalVisible, setVariantModalVisible] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  const handleOpenVariantModal = (variant?: ProductVariant) => {
    setSelectedVariant(variant || null)
    setVariantModalVisible(true)
  }

  const handleCloseVariantModal = () => {
    setVariantModalVisible(false)
    setSelectedVariant(null)
    refetch()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleToggleActive = (active: boolean) => {
    if (!productId) return

    updateProduct.mutate(
      { id: productId, active },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to update product')
        },
      }
    )
  }

  const handleToggleStoreVisibility = (availableInStore: boolean) => {
    if (!productId) return

    updateProduct.mutate(
      { id: productId, availableInStore },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to update product')
        },
      }
    )
  }

  const handleAdjustInventory = (variantId: number, delta: number) => {
    if (!productId) return

    adjustInventory.mutate(
      { productId, id: variantId, adjustment: delta },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          refetch()
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to adjust inventory')
        },
      }
    )
  }

  const handleDelete = () => {
    if (!productId || !product) return

    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProduct.mutate(
              productId,
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  router.back()
                },
                onError: (error: any) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', error?.message || 'Failed to delete product')
                },
              }
            )
          },
        },
      ]
    )
  }

  if (isLoading || !product) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'PRODUCT',
            headerStyle: { backgroundColor: Neo.white },
            headerTintColor: Neo.black,
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

  const totalInventory =
    product.variantCount > 0
      ? product.totalVariantInventory
      : product.inventoryQuantity

  return (
    <>
      <Stack.Screen
        options={{
          title: product.name.toUpperCase(),
          headerStyle: { backgroundColor: Neo.white },
          headerTintColor: Neo.black,
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
          {/* Images */}
          <ProductImagesManager
            productId={productId!}
            images={product.images || []}
            primaryImageUrl={product.imageUrl}
            onImagesChanged={refetch}
          />

          {/* Product Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(product.type) }]}>
                <Text style={styles.typeBadgeText}>
                  {getTypeLabel(product.type)}
                </Text>
              </View>
            </View>

            <Text style={styles.productPrice}>
              {product.type === 'GIFT_CARD' && product.giftCardMinCents && product.giftCardMaxCents
                ? `${formatCurrency(product.giftCardMinCents, product.currency)} - ${formatCurrency(product.giftCardMaxCents, product.currency)}`
                : formatCurrency(product.unitAmountCents, product.currency)}
            </Text>

            {product.description && (
              <Text style={styles.productDescription}>{product.description}</Text>
            )}

            <View style={styles.productMeta}>
              <Text style={styles.productMetaText}>
                {totalInventory} in stock
                {product.variantCount > 0 && ` • ${product.variantCount} variant${product.variantCount !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>

          {/* Status Toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STATUS</Text>
            <View style={styles.toggleCard}>
              <NeoSwitch
                label="Active"
                description="Product can be purchased"
                value={product.active}
                onToggle={() => handleToggleActive(!product.active)}
                disabled={updateProduct.isPending}
              />
              <View style={styles.toggleRowBorder}>
                <NeoSwitch
                  label="Visible in Store"
                  description="Show in online store"
                  value={product.availableInStore}
                  onToggle={() => handleToggleStoreVisibility(!product.availableInStore)}
                  disabled={updateProduct.isPending}
                />
              </View>
            </View>
          </View>

          {/* Variants */}
          {product.type !== 'GIFT_CARD' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  VARIANTS {product.variants && product.variants.length > 0 && `(${product.variants.length})`}
                </Text>
              </View>
              {product.variants && product.variants.length > 0 ? (
                <View style={styles.variantsCard}>
                  {product.variants.map((variant, index) => (
                    <View
                      key={variant.id}
                      style={[index > 0 && styles.variantBorder]}
                    >
                      <VariantCard
                        variant={variant}
                        currency={product.currency}
                        onAdjustInventory={handleAdjustInventory}
                        onEdit={() => handleOpenVariantModal(variant)}
                        isAdjusting={adjustInventory.isPending}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyVariants}>
                  <Text style={styles.emptyVariantsText}>No variants yet</Text>
                  <Text style={styles.emptyVariantsSubtext}>
                    Add variants for different sizes, colors, etc.
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.addVariantButton}
                onPress={() => handleOpenVariantModal()}
                accessibilityRole="button"
                accessibilityLabel="Add variant"
              >
                <Text style={styles.addVariantButtonText}>+ ADD VARIANT</Text>
              </Pressable>
            </View>
          )}

          {/* Single Product Inventory (gift cards only) */}
          {product.type === 'GIFT_CARD' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>INVENTORY</Text>
              <View style={styles.inventoryCard}>
                <Text style={styles.inventoryLabel}>QUANTITY IN STOCK</Text>
                <Text style={styles.inventoryValue}>{product.inventoryQuantity}</Text>
              </View>
            </View>
          )}

          {/* Delete Button */}
          <View style={styles.dangerZone}>
            <Pressable
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleteProduct.isPending}
              accessibilityRole="button"
              accessibilityLabel="Delete product"
            >
              <Text style={styles.deleteButtonText}>DELETE PRODUCT</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Variant Edit Modal */}
        <VariantEditModal
          visible={variantModalVisible}
          onClose={handleCloseVariantModal}
          productId={productId!}
          currency={product.currency}
          variant={selectedVariant}
        />
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
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    margin: 16,
    ...NeoShadow.default,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
    marginBottom: 12,
  },
  productDescription: {
    fontSize: 14,
    color: Neo.black,
    lineHeight: 22,
    marginBottom: 12,
  },
  productMeta: {
    paddingTop: 12,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  productMetaText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
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
  variantsCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  variantBorder: {
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  variantCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  variantCardInactive: {
    opacity: 0.6,
  },
  variantInfo: {
    flex: 1,
    marginRight: 16,
  },
  variantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  inactiveBadge: {
    backgroundColor: Neo.pink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  inactiveBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  variantSku: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  variantPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    marginTop: 4,
  },
  editHint: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyVariants: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  emptyVariantsText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
  },
  emptyVariantsSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    textAlign: 'center',
  },
  addVariantButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    ...NeoShadow.sm,
  },
  addVariantButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  variantInventory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inventoryButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventoryButtonDisabled: {
    opacity: 0.5,
  },
  inventoryButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: Neo.black,
  },
  inventoryCount: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    minWidth: 40,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inventoryCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  inventoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inventoryValue: {
    fontSize: 40,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -2,
  },
  dangerZone: {
    margin: 16,
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black + '20',
  },
  deleteButton: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
