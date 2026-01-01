import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useGuestTagOptions } from '@/lib/api/queries'
import { useCreateGuestTag, useUpdateGuestTag, useDeleteGuestTag } from '@/lib/api/mutations'
import type { GuestTagOption } from '@/lib/types'

// Preset colors matching the web app
const TAG_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
]

function TagBadge({ color, label, icon }: { color: string; label: string; icon: string | null }) {
  const textColor = getContrastText(color)

  return (
    <View style={[styles.tagBadge, { backgroundColor: color }]}>
      {icon ? (
        <Text style={styles.tagIcon}>{icon}</Text>
      ) : (
        <Text style={[styles.tagBadgeText, { color: textColor }]}>
          {label.substring(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  )
}

function NeoToggle({
  value,
  onToggle,
}: {
  value: boolean
  onToggle: (newValue: boolean) => void
}) {
  return (
    <Pressable
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
      onPress={(e) => {
        e.stopPropagation()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onToggle(!value)
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={value ? 'Enabled' : 'Disabled'}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  )
}

function TagRow({
  tag,
  onEdit,
  onToggleActive,
}: {
  tag: GuestTagOption
  onEdit: () => void
  onToggleActive: (active: boolean) => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.tagRow, pressed && styles.tagRowPressed]}
      onPress={onEdit}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${tag.label}, ${tag.active ? 'enabled' : 'disabled'}. Tap to edit`}
      accessibilityRole="button"
    >
      <View style={[styles.colorStripe, { backgroundColor: tag.color }]} />
      <TagBadge color={tag.color} label={tag.label} icon={tag.icon} />
      <View style={styles.tagInfo}>
        <Text style={[styles.tagLabel, !tag.active && styles.tagLabelInactive]}>
          {tag.label}
        </Text>
      </View>
      <View style={styles.toggleContainer}>
        <NeoToggle value={tag.active} onToggle={onToggleActive} />
      </View>
    </Pressable>
  )
}

interface TagFormData {
  label: string
  color: string
  icon: string | null
}

function TagModal({
  visible,
  tag,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: {
  visible: boolean
  tag: GuestTagOption | null
  onClose: () => void
  onSave: (data: TagFormData) => void
  onDelete: () => void
  isSaving: boolean
}) {
  const [label, setLabel] = useState(tag?.label || '')
  const [color, setColor] = useState(tag?.color || TAG_COLORS[0])
  const [icon, setIcon] = useState(tag?.icon || '')

  const isEditing = tag !== null

  const handleClose = () => {
    setLabel(tag?.label || '')
    setColor(tag?.color || TAG_COLORS[0])
    setIcon(tag?.icon || '')
    onClose()
  }

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert('Error', 'Please enter a tag name')
      return
    }
    onSave({ label: label.trim(), color, icon: icon.trim() || null })
  }

  const handleDelete = () => {
    Alert.alert(
      'DELETE TAG',
      `Permanently delete "${tag?.label}"? This will remove the tag from all guests.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    )
  }

  useEffect(() => {
    if (visible) {
      setLabel(tag?.label || '')
      setColor(tag?.color || TAG_COLORS[0])
      setIcon(tag?.icon || '')
    }
  }, [visible, tag])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable
            onPress={handleClose}
            style={styles.modalHeaderButton}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={styles.modalHeaderButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {isEditing ? 'EDIT TAG' : 'NEW TAG'}
          </Text>
          <Pressable
            onPress={handleSave}
            style={[styles.modalHeaderButton, styles.modalSaveButton]}
            disabled={isSaving}
            accessibilityLabel="Save"
            accessibilityRole="button"
          >
            <Text style={[styles.modalHeaderButtonText, styles.modalSaveButtonText]}>
              {isSaving ? '...' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>NAME</Text>
            <TextInput
              style={styles.textInput}
              value={label}
              onChangeText={setLabel}
              placeholder="Enter tag name"
              placeholderTextColor={Neo.black + '40'}
              autoCapitalize="words"
              autoFocus={!isEditing}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>ICON (EMOJI)</Text>
            <TextInput
              style={styles.textInput}
              value={icon}
              onChangeText={(text) => setIcon(text.slice(0, 2))}
              placeholder="🏷️"
              placeholderTextColor={Neo.black + '40'}
            />
            <Text style={styles.formHint}>Optional: Add an emoji to display instead of initials</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>COLOR</Text>
            <View style={styles.colorGrid}>
              {TAG_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    color === c && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setColor(c)
                  }}
                  accessibilityLabel={`Select color`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: color === c }}
                >
                  {color === c && (
                    <Text style={[styles.colorCheckmark, { color: getContrastText(c) }]}>
                      ✓
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.formLabel}>PREVIEW</Text>
            <View style={styles.previewContainer}>
              <TagBadge color={color} label={label || 'AB'} icon={icon || null} />
              <Text style={styles.previewLabel}>{label || 'Tag Name'}</Text>
            </View>
          </View>

          {isEditing && (
            <View style={styles.dangerSection}>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDelete}
                accessibilityLabel="Delete tag"
                accessibilityRole="button"
              >
                <Text style={styles.deleteButtonText}>DELETE TAG</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function FAB({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.fab, pressed && styles.fabPressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel="Add tag"
      accessibilityRole="button"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

export default function GuestTagsScreen() {
  const { data, isLoading, refetch } = useGuestTagOptions()
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTag, setEditingTag] = useState<GuestTagOption | null>(null)

  const createMutation = useCreateGuestTag()
  const updateMutation = useUpdateGuestTag()
  const deleteMutation = useDeleteGuestTag()

  const isSaving = createMutation.isPending || updateMutation.isPending

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const tags = data?.tags || []

  // Sort: active first, then by sortOrder, then by label
  const sortedTags = [...tags].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.label.localeCompare(b.label)
  })

  const handleAddNew = () => {
    setEditingTag(null)
    setModalVisible(true)
  }

  const handleEdit = (tag: GuestTagOption) => {
    setEditingTag(tag)
    setModalVisible(true)
  }

  const handleToggleActive = (tag: GuestTagOption, active: boolean) => {
    updateMutation.mutate(
      { id: tag.id, active },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to update tag')
        },
      }
    )
  }

  const handleDelete = () => {
    if (!editingTag) return

    deleteMutation.mutate(editingTag.id, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setModalVisible(false)
        setEditingTag(null)
      },
      onError: (error: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to delete tag')
      },
    })
  }

  const handleSave = (formData: TagFormData) => {
    if (editingTag) {
      updateMutation.mutate(
        { id: editingTag.id, label: formData.label, color: formData.color, icon: formData.icon },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            setModalVisible(false)
            setEditingTag(null)
          },
          onError: (error: any) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', error?.message || 'Failed to update tag')
          },
        }
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setModalVisible(false)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to create tag')
        },
      })
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isLoading && !data ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      ) : sortedTags.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          <Text style={styles.emptyTitle}>NO GUEST TAGS</Text>
          <Text style={styles.emptySubtext}>
            Create tags to categorize and identify guests
          </Text>
          <Pressable
            style={styles.addFirstButton}
            onPress={handleAddNew}
            accessibilityLabel="Add your first tag"
            accessibilityRole="button"
          >
            <Text style={styles.addFirstButtonText}>+ ADD TAG</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedTags}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TagRow
              tag={item}
              onEdit={() => handleEdit(item)}
              onToggleActive={(active) => handleToggleActive(item, active)}
            />
          )}
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

      {sortedTags.length > 0 && <FAB onPress={handleAddNew} />}

      <TagModal
        visible={modalVisible}
        tag={editingTag}
        onClose={() => {
          setModalVisible(false)
          setEditingTag(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        isSaving={isSaving}
      />
    </SafeAreaView>
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
    padding: 24,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  tagRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  colorStripe: {
    width: 6,
    alignSelf: 'stretch',
  },
  tagBadge: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  tagIcon: {
    fontSize: 20,
  },
  tagBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tagInfo: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  tagLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  tagLabelInactive: {
    opacity: 0.4,
  },
  toggleContainer: {
    marginRight: 12,
  },
  toggleTrack: {
    width: 52,
    height: 32,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    padding: 3,
  },
  toggleTrackOn: {
    backgroundColor: Neo.lime,
  },
  toggleTrackOff: {
    backgroundColor: Neo.white,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: Neo.black,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    alignSelf: 'flex-start',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    paddingHorizontal: 24,
    ...NeoShadow.sm,
  },
  addFirstButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.default,
  },
  fabPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  fabText: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.white,
    marginTop: -2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.purple,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalHeaderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalHeaderButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalSaveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalSaveButtonText: {
    color: Neo.black,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.white,
    letterSpacing: -0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formHint: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: NeoBorder.thick,
  },
  colorCheckmark: {
    fontSize: 20,
    fontWeight: '900',
  },
  previewSection: {
    marginTop: 8,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    gap: 12,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  dangerSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
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
    fontSize: 14,
    fontWeight: '900',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
