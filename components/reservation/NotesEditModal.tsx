import { useState } from 'react'
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

interface NotesEditModalProps {
  visible: boolean
  initialNotes: string
  initialAdminNotes: string
  onSave: (notes: string, adminNotes: string) => void
  onClose: () => void
}

export function NotesEditModal({
  visible,
  initialNotes,
  initialAdminNotes,
  onSave,
  onClose,
}: NotesEditModalProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes)

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(notes, adminNotes)
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
            <Text style={styles.headerText}>EDIT NOTES</Text>
          </View>
          <ScrollView style={styles.content}>
            <Text style={styles.label}>GUEST NOTES</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Special requests, allergies, etc."
              placeholderTextColor={`${Neo.black}60`}
              multiline
              numberOfLines={4}
            />
            <Text style={[styles.label, { marginTop: 16 }]}>ADMIN NOTES</Text>
            <TextInput
              style={[styles.input, { backgroundColor: Neo.yellow }]}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Internal notes (staff only)"
              placeholderTextColor={`${Neo.black}60`}
              multiline
              numberOfLines={4}
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
    minHeight: 80,
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
