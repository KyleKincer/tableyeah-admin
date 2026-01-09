import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useUploadProductImage, useDeleteProductImage, useSetPrimaryImage } from '@/lib/api/mutations'
import type { ProductImage } from '@/lib/types'

interface ProductImagesManagerProps {
  productId: number
  images: ProductImage[]
  primaryImageUrl: string | null
  onImagesChanged: () => void
}

export function ProductImagesManager({
  productId,
  images,
  primaryImageUrl,
  onImagesChanged,
}: ProductImagesManagerProps) {
  const uploadImage = useUploadProductImage()
  const deleteImage = useDeleteProductImage()
  const setPrimaryImage = useSetPrimaryImage()

  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.')
      return
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) {
      return
    }

    const asset = result.assets[0]
    setIsUploading(true)

    uploadImage.mutate(
      {
        productId,
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setIsUploading(false)
          onImagesChanged()
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setIsUploading(false)
          Alert.alert('Upload Failed', error?.message || 'Failed to upload image')
        },
      }
    )
  }

  const handleImagePress = (image: ProductImage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedImage(image)
  }

  const handleSetPrimary = () => {
    if (!selectedImage) return

    setPrimaryImage.mutate(
      { imageId: selectedImage.id, productId },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setSelectedImage(null)
          onImagesChanged()
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to set primary image')
        },
      }
    )
  }

  const handleDelete = () => {
    if (!selectedImage) return

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteImage.mutate(
              { imageId: selectedImage.id, productId },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  setSelectedImage(null)
                  onImagesChanged()
                },
                onError: (error: any) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', error?.message || 'Failed to delete image')
                },
              }
            )
          },
        },
      ]
    )
  }

  const isPrimary = (image: ProductImage) => {
    return image.url === primaryImageUrl
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>IMAGES ({images.length})</Text>
      </View>

      {images.length === 0 && !isUploading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No images yet</Text>
          <Text style={styles.emptySubtext}>Add photos to showcase your product</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageList}
        >
          {images.map((image) => (
            <Pressable
              key={image.id}
              style={styles.imageContainer}
              onPress={() => handleImagePress(image)}
              accessibilityRole="button"
              accessibilityLabel={`Image ${isPrimary(image) ? '(Primary)' : ''}`}
            >
              <Image source={{ uri: image.url }} style={styles.image} resizeMode="cover" />
              {isPrimary(image) && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                </View>
              )}
            </Pressable>
          ))}
          {isUploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={Neo.black} />
              <Text style={styles.uploadingText}>UPLOADING...</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Pressable
        style={[styles.addButton, isUploading && styles.addButtonDisabled]}
        onPress={handlePickImage}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel="Add image"
      >
        <Text style={styles.addButtonText}>+ ADD IMAGE</Text>
      </Pressable>

      {/* Image Options Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedImage && (
              <>
                <Image
                  source={{ uri: selectedImage.url }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />

                <View style={styles.modalActions}>
                  {!isPrimary(selectedImage) && (
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonPrimary]}
                      onPress={handleSetPrimary}
                      disabled={setPrimaryImage.isPending}
                    >
                      <Text style={styles.modalButtonText}>
                        {setPrimaryImage.isPending ? 'SETTING...' : 'SET AS PRIMARY'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[styles.modalButton, styles.modalButtonDestructive]}
                    onPress={handleDelete}
                    disabled={deleteImage.isPending}
                  >
                    <Text style={styles.modalButtonText}>
                      {deleteImage.isPending ? 'DELETING...' : 'DELETE'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => setSelectedImage(null)}
                  >
                    <Text style={styles.modalButtonText}>CLOSE</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 32,
    marginHorizontal: 16,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.5,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    textAlign: 'center',
  },
  imageList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  image: {
    width: 120,
    height: 90,
    backgroundColor: Neo.cream,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Neo.lime,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black,
    paddingVertical: 4,
    alignItems: 'center',
  },
  primaryBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uploadingContainer: {
    width: 120,
    height: 90,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  uploadingText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black,
    marginTop: 8,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    ...NeoShadow.sm,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    ...NeoShadow.lg,
  },
  modalImage: {
    width: '100%',
    height: 250,
    backgroundColor: Neo.cream,
    marginBottom: 16,
  },
  modalActions: {
    gap: 12,
  },
  modalButton: {
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
  modalButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
