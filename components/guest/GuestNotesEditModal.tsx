import { useState, useEffect } from 'react'
import {
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

interface GuestNotesEditModalProps {
  visible: boolean
  initialNotes: string
  onSave: (notes: string) => void
  onClose: () => void
}

export function GuestNotesEditModal({
  visible,
  initialNotes,
  onSave,
  onClose,
}: GuestNotesEditModalProps) {
  const [notes, setNotes] = useState(initialNotes)

  useEffect(() => {
    if (visible) {
      setNotes(initialNotes)
    }
  }, [visible, initialNotes])

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(notes)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.headerText}>EDIT GUEST NOTES</Text>
            </View>
          <ScrollView style={styles.content}>
            <Text style={styles.label}>NOTES</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Guest preferences, dietary restrictions, special occasions..."
              placeholderTextColor={`${Neo.black}60`}
              multiline
              numberOfLines={6}
              autoFocus
            />
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>SAVE</Text>
            </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
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
    ...NeoShadow.lg,
  },
  header: {
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.lime,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    maxHeight: 400,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
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
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.lime,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
