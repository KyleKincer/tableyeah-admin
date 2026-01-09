import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useProducts } from '@/lib/api/queries'
import type { Product, ProductType } from '@/lib/types'
import { ProductDetailPanel } from './ProductDetailPanel'

const TYPE_FILTERS: { key: ProductType | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'ADDON', label: 'ADD-ONS' },
  { key: 'FOOD', label: 'FOOD' },
  { key: 'MERCH', label: 'MERCH' },
  { key: 'GIFT_CARD', label: 'GIFT CARDS' },
]

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

function ProductCard({
  product,
  onPress,
  isSelected,
}: {
  product: Product
  onPress: () => void
  isSelected?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  const totalInventory =
    product.variantCount > 0
      ? product.totalVariantInventory
      : product.inventoryQuantity

  return (
    <Pressable
      style={[
        styles.productCard,
        pressed && styles.productCardPressed,
        isSelected && styles.productCardSelected,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`Product: ${product.name}`}
    >
      <View style={styles.productRow}>
        {/* Image */}
        <View style={styles.productImageContainer}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={styles.productImagePlaceholderText}>
                {product.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>
            {!product.active && (
              <View style={[styles.badge, { backgroundColor: Neo.pink }]}>
                <Text style={styles.badgeText}>INACTIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.productMeta}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(product.type) }]}>
              <Text style={styles.typeBadgeText}>
                {getTypeLabel(product.type)}
              </Text>
            </View>
            <Text style={styles.productPrice}>
              {formatCurrency(product.unitAmountCents, product.currency)}
            </Text>
          </View>

          <View style={styles.productFooter}>
            <Text style={styles.inventoryText}>
              {totalInventory} in stock
              {product.variantCount > 0 && ` • ${product.variantCount} variant${product.variantCount !== 1 ? 's' : ''}`}
            </Text>
            {!product.availableInStore && (
              <Text style={styles.hiddenText}>HIDDEN</Text>
            )}
          </View>
        </View>

        <Text style={styles.chevron}>→</Text>
      </View>
    </Pressable>
  )
}

export function ProductsList({ useSplitLayout }: { useSplitLayout: boolean }) {
  const router = useRouter()
  const [filter, setFilter] = useState<ProductType | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  const { data, isLoading, refetch } = useProducts()

  const allProducts = data?.products || []
  const products = filter === 'all'
    ? allProducts
    : allProducts.filter((p) => p.type === filter)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleProductPress = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (useSplitLayout) {
      setSelectedProductId(product.id)
    } else {
      router.push(`/product/${product.id}` as any)
    }
  }

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/product/create' as any)
  }

  const renderItem = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={() => handleProductPress(item)}
      isSelected={useSplitLayout && selectedProductId === item.id}
    />
  )

  const listContent = (
    <>
      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {TYPE_FILTERS.map((f) => {
          const isActive = filter === f.key
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setFilter(f.key)
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* List */}
      {isLoading && products.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Neo.black} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>NO PRODUCTS</Text>
          <Text style={styles.emptyStateSubtext}>
            Create your first product
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={handleAddPress}
        accessibilityRole="button"
        accessibilityLabel="Add new product"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </>
  )

  if (useSplitLayout) {
    return (
      <View style={styles.splitContainer}>
        <View style={styles.listPane}>{listContent}</View>
        <View style={styles.detailPane}>
          {selectedProductId ? (
            <ProductDetailPanel productId={selectedProductId} />
          ) : (
            <View style={styles.detailPlaceholder}>
              <Text style={styles.detailPlaceholderText}>SELECT A PRODUCT</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return <View style={styles.container}>{listContent}</View>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    width: '40%',
    borderRightWidth: NeoBorder.default,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
  },
  detailPane: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  detailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  detailPlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.3,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailPlaceholderSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.2,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filtersContainer: {
    padding: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Neo.lime,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 14,
    textAlign: 'center',
  },
  filterChipTextActive: {
    opacity: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80, // Space for FAB
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.3,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.2,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  productCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    marginBottom: 12,
    ...NeoShadow.default,
  },
  productCardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  productCardSelected: {
    backgroundColor: Neo.lime,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    marginRight: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Neo.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    opacity: 0.3,
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inventoryText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hiddenText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.orange,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chevron: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.default,
  },
  fabText: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.black,
    lineHeight: 36,
  },
})
