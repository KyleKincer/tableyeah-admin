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

interface GuestEditModalProps {
  visible: boolean
  initialName: string
  initialPhone: string
  onSave: (name: string, phone: string) => void
  onClose: () => void
}

export function GuestEditModal({
  visible,
  initialName,
  initialPhone,
  onSave,
  onClose,
}: GuestEditModalProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)

  useEffect(() => {
    if (visible) {
      setName(initialName)
      setPhone(initialPhone)
    }
  }, [visible, initialName, initialPhone])

  const handleSave = () => {
    if (!name.trim()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(name.trim(), phone.trim())
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
            <Text style={styles.headerText}>EDIT GUEST</Text>
          </View>
          <ScrollView style={styles.content}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Guest name"
              placeholderTextColor={`${Neo.black}60`}
              autoCapitalize="words"
              autoFocus
            />
            <Text style={[styles.label, { marginTop: 16 }]}>PHONE</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number (optional)"
              placeholderTextColor={`${Neo.black}60`}
              keyboardType="phone-pad"
            />
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
