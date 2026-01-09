import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useDeviceType } from '@/lib/hooks/useDeviceType'
import { OrdersList } from '@/components/commerce/OrdersList'
import { GiftCardsList } from '@/components/commerce/GiftCardsList'
import { ProductsList } from '@/components/commerce/ProductsList'

type CommerceSegment = 'orders' | 'gift-cards' | 'products'

const SEGMENTS: { key: CommerceSegment; label: string }[] = [
  { key: 'orders', label: 'ORDERS' },
  { key: 'gift-cards', label: 'GIFT CARDS' },
  { key: 'products', label: 'PRODUCTS' },
]

function SegmentedControl({
  selected,
  onSelect,
}: {
  selected: CommerceSegment
  onSelect: (segment: CommerceSegment) => void
}) {
  return (
    <View style={styles.segmentedControl}>
      {SEGMENTS.map((segment) => {
        const isSelected = selected === segment.key
        return (
          <Pressable
            key={segment.key}
            style={[
              styles.segmentButton,
              isSelected && styles.segmentButtonSelected,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(segment.key)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={segment.label}
          >
            <Text
              style={[
                styles.segmentButtonText,
                isSelected && styles.segmentButtonTextSelected,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function CommerceScreen() {
  const [activeSegment, setActiveSegment] = useState<CommerceSegment>('orders')
  const { isTablet, isLandscape } = useDeviceType()
  const useSplitLayout = isTablet && isLandscape

  const renderContent = () => {
    switch (activeSegment) {
      case 'orders':
        return <OrdersList useSplitLayout={useSplitLayout} />
      case 'gift-cards':
        return <GiftCardsList useSplitLayout={useSplitLayout} />
      case 'products':
        return <ProductsList useSplitLayout={useSplitLayout} />
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <SegmentedControl selected={activeSegment} onSelect={setActiveSegment} />
      </View>
      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  header: {
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  segmentButtonSelected: {
    backgroundColor: Neo.lime,
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  segmentButtonTextSelected: {
    opacity: 1,
  },
  content: {
    flex: 1,
  },
})
