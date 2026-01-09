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
import { format, parse } from 'date-fns'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'

interface ReservationEditModalProps {
  visible: boolean
  initialValues: {
    name: string
    date: string       // YYYY-MM-DD
    time: string       // HH:mm
    covers: number
    email: string | null
    phone: string | null
  }
  onSave: (values: {
    name: string
    date: string
    time: string
    covers: number
    email: string | null
    phone: string | null
  }) => void
  onClose: () => void
}

export function ReservationEditModal({
  visible,
  initialValues,
  onSave,
  onClose,
}: ReservationEditModalProps) {
  const [name, setName] = useState(initialValues.name)
  const [date, setDate] = useState(initialValues.date)
  const [time, setTime] = useState(initialValues.time)
  const [covers, setCovers] = useState(initialValues.covers.toString())
  const [email, setEmail] = useState(initialValues.email || '')
  const [phone, setPhone] = useState(initialValues.phone || '')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)

  // Reset form when modal opens with new values
  useEffect(() => {
    if (visible) {
      setName(initialValues.name)
      setDate(initialValues.date)
      setTime(initialValues.time)
      setCovers(initialValues.covers.toString())
      setEmail(initialValues.email || '')
      setPhone(initialValues.phone || '')
    }
  }, [visible, initialValues])

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const coversNum = parseInt(covers, 10)
    if (isNaN(coversNum) || coversNum < 1) {
      return // Could show error
    }
    onSave({
      name: name.trim(),
      date,
      time,
      covers: coversNum,
      email: email.trim() || null,
      phone: phone.trim() || null,
    })
    onClose()
  }

  const handleDateSelect = (selectedDate: Date) => {
    setDate(format(selectedDate, 'yyyy-MM-dd'))
    setShowDatePicker(false)
  }

  const displayDate = date
    ? format(parse(date, 'yyyy-MM-dd', new Date()), 'EEE, MMM d, yyyy')
    : 'Select date'

  const decrementCovers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = parseInt(covers, 10) || 1
    if (current > 1) {
      setCovers((current - 1).toString())
    }
  }

  const incrementCovers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = parseInt(covers, 10) || 1
    setCovers((current + 1).toString())
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <Text style={styles.headerText}>EDIT RESERVATION</Text>
              </View>
              <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                {/* Name */}
                <Text style={styles.label}>GUEST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Guest name"
                  placeholderTextColor={`${Neo.black}60`}
                  autoCapitalize="words"
                />

                {/* Date */}
                <Text style={[styles.label, { marginTop: 16 }]}>DATE</Text>
                <Pressable
                  style={[
                    styles.pickerButton,
                    pressed === 'date' && styles.pickerButtonPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setShowDatePicker(true)
                  }}
                  onPressIn={() => setPressed('date')}
                  onPressOut={() => setPressed(null)}
                >
                  <Text style={styles.pickerButtonText}>{displayDate}</Text>
                </Pressable>

                {/* Time */}
                <Text style={[styles.label, { marginTop: 16 }]}>TIME</Text>
                <TimePicker
                  value={time}
                  onChange={setTime}
                  placeholder="Select time"
                />

                {/* Party Size */}
                <Text style={[styles.label, { marginTop: 16 }]}>PARTY SIZE</Text>
                <View style={styles.coversRow}>
                  <Pressable
                    style={[
                      styles.coversButton,
                      pressed === 'decrement' && styles.coversButtonPressed,
                    ]}
                    onPress={decrementCovers}
                    onPressIn={() => setPressed('decrement')}
                    onPressOut={() => setPressed(null)}
                    disabled={parseInt(covers, 10) <= 1}
                  >
                    <Text style={styles.coversButtonText}>-</Text>
                  </Pressable>
                  <TextInput
                    style={styles.coversInput}
                    value={covers}
                    onChangeText={setCovers}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <Pressable
                    style={[
                      styles.coversButton,
                      pressed === 'increment' && styles.coversButtonPressed,
                    ]}
                    onPress={incrementCovers}
                    onPressIn={() => setPressed('increment')}
                    onPressOut={() => setPressed(null)}
                  >
                    <Text style={styles.coversButtonText}>+</Text>
                  </Pressable>
                </View>

                {/* Email */}
                <Text style={[styles.label, { marginTop: 16 }]}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email (optional)"
                  placeholderTextColor={`${Neo.black}60`}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Phone */}
                <Text style={[styles.label, { marginTop: 16 }]}>PHONE</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone (optional)"
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

      {/* Date Picker Modal */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={date ? parse(date, 'yyyy-MM-dd', new Date()) : new Date()}
        onSelectDate={handleDateSelect}
        onClose={() => setShowDatePicker(false)}
      />
    </>
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
    maxHeight: '90%',
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
  pickerButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  pickerButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coversRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coversButton: {
    width: 48,
    height: 48,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  coversButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  coversButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
  },
  coversInput: {
    flex: 1,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    fontSize: 20,
    fontWeight: '800',
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
    backgroundColor: Neo.cream,
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
