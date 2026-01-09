import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import ColorPicker, { Panel1, HueSlider, Preview, type ColorFormatsObject } from 'reanimated-color-picker'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useBranding } from '@/lib/api/queries'
import { useUpdateBranding, useGenerateBrandColors, useUploadBrandingImage, useUpdateBrandColors } from '@/lib/api/mutations'
import type { BrandingAssetType } from '@/lib/types'

function ColorEditModal({
  visible,
  colorType,
  initialColor,
  onSave,
  onClose,
  isSaving,
}: {
  visible: boolean
  colorType: 'primary' | 'accent'
  initialColor: string
  onSave: (color: string) => void
  onClose: () => void
  isSaving: boolean
}) {
  const selectedColorRef = useRef(initialColor)

  const onSelectColor = ({ hex }: ColorFormatsObject) => {
    selectedColorRef.current = hex
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(selectedColorRef.current.toUpperCase())
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>
            {colorType.toUpperCase()} COLOR
          </Text>

          <ColorPicker
            value={initialColor}
            onComplete={onSelectColor}
            style={styles.colorPicker}
          >
            <Preview style={styles.colorPreview} hideInitialColor />
            <Panel1 style={styles.colorPanel} />
            <HueSlider style={styles.hueSlider} />
          </ColorPicker>

          <View style={styles.modalActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.saveButtonText}>SAVE</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const BRANDING_CONFIG: Array<{
  kind: BrandingAssetType
  label: string
  description: string
  recommended: string
  field: 'logoUrl' | 'wordmarkUrl' | 'coverImageUrl' | 'faviconUrl' | 'ogImageUrl'
}> = [
  {
    kind: 'logo',
    label: 'Logo (square)',
    description: 'Used in admin UI and emails.',
    recommended: '512×512+ PNG/WebP',
    field: 'logoUrl',
  },
  {
    kind: 'wordmark',
    label: 'Wordmark (wide)',
    description: 'Used in headers.',
    recommended: '1200×300 transparent',
    field: 'wordmarkUrl',
  },
  {
    kind: 'cover',
    label: 'Cover / hero image',
    description: 'Used on public pages.',
    recommended: '2400×1200 JPG/WebP',
    field: 'coverImageUrl',
  },
  {
    kind: 'favicon',
    label: 'Favicon',
    description: 'Browser tab icon.',
    recommended: '512×512 PNG',
    field: 'faviconUrl',
  },
  {
    kind: 'og',
    label: 'Social share (OpenGraph)',
    description: 'Used for link previews.',
    recommended: '1200×630 JPG/WebP',
    field: 'ogImageUrl',
  },
]

function AssetCard({
  kind,
  label,
  description,
  recommended,
  url,
  isUploading,
  onUpload,
  onRemove,
}: {
  kind: BrandingAssetType
  label: string
  description: string
  recommended: string
  url: string | null
  isUploading: boolean
  onUpload: () => void
  onRemove: () => void
}) {
  const isCover = kind === 'cover' || kind === 'og'

  return (
    <View style={styles.assetCard}>
      <View style={styles.assetHeader}>
        <View style={styles.assetInfo}>
          <Text style={styles.assetLabel}>{label}</Text>
          <Text style={styles.assetDescription}>{description}</Text>
          <Text style={styles.assetRecommended}>{recommended}</Text>
        </View>
        {!url && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
          </View>
        )}
      </View>

      <View style={styles.previewContainer}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={[styles.previewImage, isCover && styles.previewImageCover]}
            resizeMode={isCover ? 'cover' : 'contain'}
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>No image</Text>
          </View>
        )}
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.uploadingText}>UPLOADING...</Text>
          </View>
        )}
      </View>

      <View style={styles.assetActions}>
        <Pressable
          style={[styles.uploadButton, isUploading && styles.buttonDisabled]}
          onPress={onUpload}
          disabled={isUploading}
          accessibilityLabel={url ? `Replace ${label}` : `Upload ${label}`}
          accessibilityRole="button"
        >
          <Text style={styles.uploadButtonText}>{url ? 'REPLACE' : 'UPLOAD'}</Text>
        </Pressable>

        {url && (
          <Pressable
            style={[styles.removeButton, isUploading && styles.buttonDisabled]}
            onPress={onRemove}
            disabled={isUploading}
            accessibilityLabel={`Remove ${label}`}
            accessibilityRole="button"
          >
            <Text style={styles.removeButtonText}>REMOVE</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export function BrandingSettings() {
  const { data, isLoading, refetch } = useBranding()
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingKind, setUploadingKind] = useState<BrandingAssetType | null>(null)
  const [editingColor, setEditingColor] = useState<'primary' | 'accent' | null>(null)

  const updateMutation = useUpdateBranding()
  const generateColorsMutation = useGenerateBrandColors()
  const uploadMutation = useUploadBrandingImage()
  const updateColorsMutation = useUpdateBrandColors()

  const branding = data?.branding
  const colors = data?.colors

  const handleEditColor = (colorType: 'primary' | 'accent') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingColor(colorType)
  }

  const handleSaveColor = (color: string) => {
    const colorData = editingColor === 'primary'
      ? { primaryColor: color }
      : { accentColor: color }

    updateColorsMutation.mutate(colorData, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setEditingColor(null)
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to update color')
      },
    })
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handlePickImage = async (kind: BrandingAssetType) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please grant photo library access to upload images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setUploadingKind(kind)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    uploadMutation.mutate(
      {
        assetType: kind,
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
      },
      {
        onSuccess: (response) => {
          // Update branding with new URL
          const config = BRANDING_CONFIG.find((c) => c.kind === kind)!
          const updatedBranding = {
            ...branding,
            [config.field]: response.url,
          }
          updateMutation.mutate(updatedBranding, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              setUploadingKind(null)
            },
            onError: (err: any) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Error', err?.message || 'Failed to save branding')
              setUploadingKind(null)
            },
          })
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', err?.message || 'Failed to upload image')
          setUploadingKind(null)
        },
      }
    )
  }

  const handleRemove = (kind: BrandingAssetType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert('Remove Image', 'Are you sure you want to remove this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const config = BRANDING_CONFIG.find((c) => c.kind === kind)!
          const updatedBranding = {
            ...branding,
            [config.field]: null,
          }
          updateMutation.mutate(updatedBranding, {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            },
            onError: (err: any) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Error', err?.message || 'Failed to remove image')
            },
          })
        },
      },
    ])
  }

  const handleGenerateColors = (assetType: BrandingAssetType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    generateColorsMutation.mutate(assetType, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to generate colors')
      },
    })
  }

  // Find available color sources (images that have been uploaded)
  const availableColorSources: Array<{ kind: BrandingAssetType; label: string }> = []
  if (branding?.logoUrl) availableColorSources.push({ kind: 'logo', label: 'Logo' })
  if (branding?.wordmarkUrl) availableColorSources.push({ kind: 'wordmark', label: 'Wordmark' })
  if (branding?.coverImageUrl) availableColorSources.push({ kind: 'cover', label: 'Cover' })
  if (branding?.ogImageUrl) availableColorSources.push({ kind: 'og', label: 'Social' })
  if (branding?.faviconUrl) availableColorSources.push({ kind: 'favicon', label: 'Favicon' })

  if (isLoading && !data) {
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
      {/* Color Edit Modal */}
      {editingColor && colors && (
        <ColorEditModal
          visible={!!editingColor}
          colorType={editingColor}
          initialColor={editingColor === 'primary' ? colors.primaryColor : colors.accentColor}
          onSave={handleSaveColor}
          onClose={() => setEditingColor(null)}
          isSaving={updateColorsMutation.isPending}
        />
      )}

      {/* Brand Colors Section */}
      <View style={styles.colorsCard}>
        <View style={styles.colorsHeader}>
          <View style={styles.colorsInfo}>
            <Text style={styles.colorsTitle}>BRAND COLORS</Text>
            <Text style={styles.colorsDescription}>
              {colors?.isDefault
                ? 'Using defaults. Upload an image to generate colors.'
                : 'Tap a swatch to edit manually.'}
            </Text>
          </View>
        </View>

        {colors && (
          <View style={styles.colorSwatchesRow}>
            <Pressable
              style={styles.colorSwatchContainer}
              onPress={() => handleEditColor('primary')}
              accessibilityLabel="Edit primary color"
              accessibilityRole="button"
            >
              <View style={[styles.colorSwatchLarge, { backgroundColor: colors.primaryColor }]} />
              <Text style={styles.colorSwatchLabel}>PRIMARY</Text>
              <Text style={styles.colorSwatchValue}>{colors.primaryColor}</Text>
            </Pressable>

            <Pressable
              style={styles.colorSwatchContainer}
              onPress={() => handleEditColor('accent')}
              accessibilityLabel="Edit accent color"
              accessibilityRole="button"
            >
              <View style={[styles.colorSwatchLarge, { backgroundColor: colors.accentColor }]} />
              <Text style={styles.colorSwatchLabel}>ACCENT</Text>
              <Text style={styles.colorSwatchValue}>{colors.accentColor}</Text>
            </Pressable>
          </View>
        )}

        {availableColorSources.length > 0 && (
          <View style={styles.generateButtons}>
            <Text style={styles.generateLabel}>Generate from:</Text>
            <View style={styles.generateButtonRow}>
              {availableColorSources.map((source) => (
                <Pressable
                  key={source.kind}
                  style={[
                    styles.generateButton,
                    generateColorsMutation.isPending && styles.buttonDisabled,
                  ]}
                  onPress={() => handleGenerateColors(source.kind)}
                  disabled={generateColorsMutation.isPending}
                  accessibilityLabel={`Generate colors from ${source.label}`}
                  accessibilityRole="button"
                >
                  {generateColorsMutation.isPending ? (
                    <ActivityIndicator size="small" color={Neo.black} />
                  ) : (
                    <Text style={styles.generateButtonText}>{source.label}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Asset Cards */}
      <Text style={styles.sectionHeader}>BRANDING ASSETS</Text>
      {BRANDING_CONFIG.map((config) => (
        <AssetCard
          key={config.kind}
          kind={config.kind}
          label={config.label}
          description={config.description}
          recommended={config.recommended}
          url={branding?.[config.field] || null}
          isUploading={uploadingKind === config.kind}
          onUpload={() => handlePickImage(config.kind)}
          onRemove={() => handleRemove(config.kind)}
        />
      ))}

      {/* Notes */}
      <View style={styles.notesCard}>
        <Text style={styles.notesTitle}>NOTES</Text>
        <Text style={styles.notesText}>
          • Tap a color swatch to manually edit{'\n'}
          • First upload auto-picks brand colors{'\n'}
          • Re-generate colors from any uploaded image{'\n'}
          • Default images used when none uploaded
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
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorsCard: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  colorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  colorsInfo: {
    flex: 1,
    marginRight: 16,
  },
  colorsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorsDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  colorSwatchContainer: {
    flex: 1,
    alignItems: 'center',
  },
  colorSwatchLarge: {
    width: '100%',
    height: 60,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    marginBottom: 8,
  },
  colorSwatchLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  colorSwatchValue: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Color picker modal styles
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
    padding: 20,
    width: '100%',
    maxWidth: 340,
    ...NeoShadow.lg,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorPicker: {
    width: '100%',
    gap: 16,
  },
  colorPreview: {
    height: 50,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    borderRadius: 0,
  },
  colorPanel: {
    height: 180,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderRadius: 0,
  },
  hueSlider: {
    height: 32,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderRadius: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  generateButtons: {
    marginTop: 16,
  },
  generateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  generateButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  generateButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  assetCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    marginBottom: 16,
    ...NeoShadow.default,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
  },
  assetInfo: {
    flex: 1,
    marginRight: 12,
  },
  assetLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 4,
  },
  assetDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  assetRecommended: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  defaultBadge: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewContainer: {
    height: 140,
    backgroundColor: Neo.cream,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageCover: {
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholderText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Neo.white + 'E0',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  assetActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  removeButton: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.pink,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  notesCard: {
    backgroundColor: Neo.cyan + '30',
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notesText: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.7,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
