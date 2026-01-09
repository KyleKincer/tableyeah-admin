import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { NeoSwitch } from '@/components/ui/NeoSwitch'
import { useCreateVariant, useUpdateVariant, useDeleteVariant } from '@/lib/api/mutations'
import type { ProductVariant } from '@/lib/types'

interface VariantEditModalProps {
  visible: boolean
  onClose: () => void
  productId: number
  currency: string
  variant?: ProductVariant | null // null for create mode
}

export function VariantEditModal({
  visible,
  onClose,
  productId,
  currency,
  variant,
}: VariantEditModalProps) {
  const isEditMode = !!variant

  const createVariant = useCreateVariant()
  const updateVariant = useUpdateVariant()
  const deleteVariant = useDeleteVariant()

  const [label, setLabel] = useState('')
  const [sku, setSku] = useState('')
  const [priceOverride, setPriceOverride] = useState('')
  const [inventoryQuantity, setInventoryQuantity] = useState('0')
  const [active, setActive] = useState(true)

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (variant) {
        setLabel(variant.label)
        setSku(variant.sku || '')
        setPriceOverride(
          variant.unitAmountCentsOverride !== null
            ? (variant.unitAmountCentsOverride / 100).toFixed(2)
            : ''
        )
        setInventoryQuantity(variant.inventoryQuantity.toString())
        setActive(variant.active)
      } else {
        setLabel('')
        setSku('')
        setPriceOverride('')
        setInventoryQuantity('0')
        setActive(true)
      }
    }
  }, [visible, variant])

  const isValid = label.trim().length > 0

  const handleSave = () => {
    if (!isValid) {
      Alert.alert('Error', 'Please enter a variant label')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const priceOverrideCents = priceOverride
      ? Math.round(parseFloat(priceOverride) * 100)
      : null

    if (isEditMode && variant) {
      updateVariant.mutate(
        {
          productId,
          id: variant.id,
          label: label.trim(),
          sku: sku.trim() || undefined,
          unitAmountCentsOverride: priceOverrideCents,
          active,
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onClose()
          },
          onError: (error: any) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', error?.message || 'Failed to update variant')
          },
        }
      )
    } else {
      createVariant.mutate(
        {
          productId,
          label: label.trim(),
          sku: sku.trim() || undefined,
          unitAmountCentsOverride: priceOverrideCents || undefined,
          inventoryQuantity: parseInt(inventoryQuantity || '0', 10),
          active,
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onClose()
          },
          onError: (error: any) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', error?.message || 'Failed to create variant')
          },
        }
      )
    }
  }

  const handleDelete = () => {
    if (!variant) return

    Alert.alert(
      'Delete Variant',
      `Are you sure you want to delete "${variant.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            deleteVariant.mutate(
              { variantId: variant.id, productId },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  onClose()
                },
                onError: (error: any) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', error?.message || 'Failed to delete variant')
                },
              }
            )
          },
        },
      ]
    )
  }

  const isPending = createVariant.isPending || updateVariant.isPending || deleteVariant.isPending

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={onClose}
            disabled={isPending}
          >
            <Text style={styles.headerButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'EDIT VARIANT' : 'NEW VARIANT'}
          </Text>
          <Pressable
            style={[styles.headerButton, styles.headerButtonPrimary]}
            onPress={handleSave}
            disabled={!isValid || isPending}
          >
            {isPending && !deleteVariant.isPending ? (
              <ActivityIndicator size="small" color={Neo.black} />
            ) : (
              <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>
                SAVE
              </Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Label */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LABEL *</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.textInput}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g., Small, Medium, Large"
                  placeholderTextColor={Neo.black + '40'}
                  autoCapitalize="words"
                  autoFocus={!isEditMode}
                />
              </View>
            </View>

            {/* SKU */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SKU (OPTIONAL)</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.textInput}
                  value={sku}
                  onChangeText={setSku}
                  placeholder="e.g., PROD-001-SM"
                  placeholderTextColor={Neo.black + '40'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Price Override */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRICE OVERRIDE (OPTIONAL)</Text>
              <Text style={styles.sectionHint}>
                Leave empty to use base product price
              </Text>
              <View style={styles.priceContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={priceOverride}
                  onChangeText={setPriceOverride}
                  placeholder="0.00"
                  placeholderTextColor={Neo.black + '40'}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Inventory (only for new variants) */}
            {!isEditMode && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>INITIAL INVENTORY</Text>
                <View style={styles.inputCard}>
                  <View style={styles.inventoryRow}>
                    <Text style={styles.inventoryLabel}>QUANTITY</Text>
                    <TextInput
                      style={styles.inventoryInput}
                      value={inventoryQuantity}
                      onChangeText={setInventoryQuantity}
                      placeholder="0"
                      placeholderTextColor={Neo.black + '40'}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Active Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STATUS</Text>
              <View style={styles.toggleCard}>
                <NeoSwitch
                  label="Active"
                  description="Variant can be purchased"
                  value={active}
                  onToggle={() => setActive(!active)}
                />
              </View>
            </View>

            {/* Delete Button (edit mode only) */}
            {isEditMode && (
              <View style={styles.dangerZone}>
                <Pressable
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={isPending}
                >
                  {deleteVariant.isPending ? (
                    <ActivityIndicator size="small" color={Neo.black} />
                  ) : (
                    <Text style={styles.deleteButtonText}>DELETE VARIANT</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButtonPrimary: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerButtonTextPrimary: {
    opacity: 1,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
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
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  dangerZone: {
    marginTop: 16,
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
