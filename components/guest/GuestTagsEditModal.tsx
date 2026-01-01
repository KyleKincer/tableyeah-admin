import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useGuestTagOptions } from '@/lib/api/queries'
import type { GuestTag, GuestTagOption } from '@/lib/types'

interface GuestTagsEditModalProps {
  visible: boolean
  currentTags: GuestTag[]
  onAddTag: (tagOptionId: number) => void
  onRemoveTag: (tagOptionId: number) => void
  onClose: () => void
}

function TagOption({
  tag,
  isSelected,
  onToggle,
}: {
  tag: GuestTagOption
  isSelected: boolean
  onToggle: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const isLight = [Neo.lime, Neo.cyan, Neo.yellow, '#C8FF00', '#00FFFF', '#FFE600'].includes(
    tag.color
  )

  return (
    <Pressable
      style={[
        styles.tagOption,
        { backgroundColor: isSelected ? tag.color : Neo.white },
        pressed && styles.tagOptionPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onToggle()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      {tag.icon && <Text style={styles.tagIcon}>{tag.icon}</Text>}
      <Text
        style={[
          styles.tagLabel,
          { color: isSelected && !isLight ? Neo.white : Neo.black },
        ]}
      >
        {tag.label}
      </Text>
      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

export function GuestTagsEditModal({
  visible,
  currentTags,
  onAddTag,
  onRemoveTag,
  onClose,
}: GuestTagsEditModalProps) {
  const { data, isLoading } = useGuestTagOptions()
  const tagOptions = data?.tags || []

  const currentTagIds = new Set(currentTags.map((t) => t.id))

  const handleToggle = (tagOption: GuestTagOption) => {
    if (currentTagIds.has(tagOption.id)) {
      onRemoveTag(tagOption.id)
    } else {
      onAddTag(tagOption.id)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerText}>EDIT TAGS</Text>
          </View>
          <ScrollView style={styles.content}>
            {isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={Neo.black} />
                <Text style={styles.loadingText}>Loading tags...</Text>
              </View>
            ) : tagOptions.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No tags configured</Text>
                <Text style={styles.emptySubtext}>
                  Create tags in the web dashboard settings
                </Text>
              </View>
            ) : (
              <View style={styles.tagsList}>
                {tagOptions
                  .filter((t) => t.active)
                  .map((tagOption) => (
                    <TagOption
                      key={tagOption.id}
                      tag={tagOption}
                      isSelected={currentTagIds.has(tagOption.id)}
                      onToggle={() => handleToggle(tagOption)}
                    />
                  ))}
              </View>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>DONE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...NeoShadow.lg,
  },
  header: {
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.purple,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  loading: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  tagsList: {
    gap: 8,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 14,
    gap: 10,
    ...NeoShadow.sm,
  },
  tagOptionPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  tagIcon: {
    fontSize: 16,
  },
  tagLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Neo.black,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.white,
  },
  footer: {
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
  },
  doneButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.lime,
  },
  doneButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
