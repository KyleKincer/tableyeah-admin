import { format } from 'date-fns'
import { useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'

interface TimePickerProps {
  /** Currently selected time in HH:mm format (e.g., "14:30") */
  value: string | null
  /** Callback when time is selected */
  onChange: (time: string) => void
  /** Label shown above the button */
  label?: string
  /** Placeholder text when no time is selected */
  placeholder?: string
}

// Convert HH:mm string to Date object
const getDateFromTimeString = (timeString: string | null): Date => {
  if (!timeString) {
    // Default to 6:00 PM
    const date = new Date()
    date.setHours(18, 0, 0, 0)
    return date
  }
  const [hours, minutes] = timeString.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

// Convert Date to HH:mm string
const getTimeStringFromDate = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * A native time picker that shows the platform's native time selection UI.
 * Returns time in HH:mm format.
 */
export function TimePicker({
  value,
  onChange,
  label,
  placeholder = 'Select time',
}: TimePickerProps) {
  const [show, setShow] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [tempDate, setTempDate] = useState(() => getDateFromTimeString(value))

  // Format for display (e.g., "6:30 PM")
  const displayValue = value
    ? format(getDateFromTimeString(value), 'h:mm a')
    : null

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false)
      if (event.type === 'set' && selectedDate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onChange(getTimeStringFromDate(selectedDate))
      }
    } else {
      // iOS - update temp date, confirm on done
      if (selectedDate) {
        setTempDate(selectedDate)
      }
    }
  }

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onChange(getTimeStringFromDate(tempDate))
    setShow(false)
  }

  const handleCancel = () => {
    setTempDate(getDateFromTimeString(value))
    setShow(false)
  }

  const openPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTempDate(getDateFromTimeString(value))
    setShow(true)
  }

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        style={[styles.button, pressed && styles.buttonPressed]}
        onPress={openPicker}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <Text style={[styles.buttonText, !displayValue && styles.buttonTextPlaceholder]}>
          {displayValue || placeholder}
        </Text>
      </Pressable>

      {/* iOS Modal */}
      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable onPress={handleCancel} style={styles.modalButton}>
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Select Time</Text>
                <Pressable onPress={handleConfirm} style={styles.modalButton}>
                  <Text style={styles.modalButtonTextConfirm}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                  minuteInterval={5}
                  textColor={Neo.black}
                  themeVariant="light"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Android picker */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleChange}
          minuteInterval={5}
        />
      )}
    </View>
  )
}

/**
 * Inline time picker button that can be used in forms.
 * Shows the selected time and opens a modal when pressed.
 */
export function TimePickerButton({
  value,
  onChange,
  placeholder = 'Select',
}: Omit<TimePickerProps, 'label'>) {
  const [show, setShow] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [tempDate, setTempDate] = useState(() => getDateFromTimeString(value))

  const displayValue = value
    ? format(getDateFromTimeString(value), 'h:mm a')
    : null

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false)
      if (event.type === 'set' && selectedDate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onChange(getTimeStringFromDate(selectedDate))
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate)
      }
    }
  }

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onChange(getTimeStringFromDate(tempDate))
    setShow(false)
  }

  const handleCancel = () => {
    setTempDate(getDateFromTimeString(value))
    setShow(false)
  }

  const openPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTempDate(getDateFromTimeString(value))
    setShow(true)
  }

  return (
    <>
      <Pressable
        style={[styles.inlineButton, pressed && styles.inlineButtonPressed]}
        onPress={openPicker}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <Text style={[styles.inlineButtonText, !displayValue && styles.inlineButtonTextPlaceholder]}>
          {displayValue || placeholder}
        </Text>
      </Pressable>

      {/* iOS Modal */}
      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable onPress={handleCancel} style={styles.modalButton}>
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Select Time</Text>
                <Pressable onPress={handleConfirm} style={styles.modalButton}>
                  <Text style={styles.modalButtonTextConfirm}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                  minuteInterval={5}
                  textColor={Neo.black}
                  themeVariant="light"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Android picker */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleChange}
          minuteInterval={5}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  button: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  buttonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonTextPlaceholder: {
    color: `${Neo.black}60`,
  },
  inlineButton: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  inlineButtonPressed: {
    backgroundColor: Neo.cream,
  },
  inlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inlineButtonTextPlaceholder: {
    color: `${Neo.black}60`,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Neo.white,
    borderTopWidth: NeoBorder.default,
    borderColor: Neo.black,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
    backgroundColor: Neo.cream,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalButton: {
    padding: 8,
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.6,
  },
  modalButtonTextConfirm: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.blue,
  },
  pickerContainer: {
    backgroundColor: Neo.white,
    paddingVertical: 10,
  },
})
