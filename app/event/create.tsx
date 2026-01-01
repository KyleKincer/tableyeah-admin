import { format } from 'date-fns'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useCreateEvent } from '@/lib/api/mutations'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'

// Quick capacity presets
const CAPACITY_PRESETS = [20, 50, 100, 200]

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function CapacityStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (capacity: number) => void
}) {
  const handleDecrement = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(Math.max(1, value - amount))
  }

  const handleIncrement = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(value + amount)
  }

  return (
    <View style={styles.capacityStepperContainer}>
      {/* Main stepper row */}
      <View style={styles.capacityStepperRow}>
        <Pressable
          style={styles.capacityStepButton}
          onPress={() => handleDecrement(10)}
        >
          <Text style={styles.capacityStepButtonText}>−10</Text>
        </Pressable>
        <Pressable
          style={styles.capacityStepButtonSmall}
          onPress={() => handleDecrement(1)}
        >
          <Text style={styles.capacityStepButtonText}>−</Text>
        </Pressable>
        <View style={styles.capacityValueContainer}>
          <Text style={styles.capacityValue}>{value}</Text>
          <Text style={styles.capacityLabel}>covers</Text>
        </View>
        <Pressable
          style={styles.capacityStepButtonSmall}
          onPress={() => handleIncrement(1)}
        >
          <Text style={styles.capacityStepButtonText}>+</Text>
        </Pressable>
        <Pressable
          style={styles.capacityStepButton}
          onPress={() => handleIncrement(10)}
        >
          <Text style={styles.capacityStepButtonText}>+10</Text>
        </Pressable>
      </View>

      {/* Quick presets */}
      <View style={styles.capacityPresetsRow}>
        {CAPACITY_PRESETS.map((preset) => {
          const isSelected = preset === value
          return (
            <Pressable
              key={preset}
              style={[
                styles.capacityPresetButton,
                isSelected && styles.capacityPresetButtonSelected,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                onChange(preset)
              }}
            >
              <Text
                style={[
                  styles.capacityPresetText,
                  isSelected && styles.capacityPresetTextSelected,
                ]}
              >
                {preset}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function ToggleOption({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.toggleOption,
        pressed && styles.toggleOptionPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onChange(!value)
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Text style={styles.checkmark}>X</Text>}
      </View>
      <Text style={styles.toggleOptionLabel}>{label}</Text>
    </Pressable>
  )
}

function NeoButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  loading?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor =
    variant === 'destructive'
      ? Neo.pink
      : variant === 'primary'
        ? Neo.lime
        : Neo.white

  return (
    <Pressable
      style={[
        styles.actionButton,
        { backgroundColor: bgColor },
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Neo.black} size="small" />
      ) : (
        <Text style={styles.actionButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export default function CreateEventScreen() {
  const router = useRouter()

  // Form state
  const [eventName, setEventName] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  })
  const [selectedTime, setSelectedTime] = useState<string | null>('19:00')
  const [capacity, setCapacity] = useState(50)
  const [active, setActive] = useState(true)
  const [visible, setVisible] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const createEvent = useCreateEvent()

  const canSubmit = eventName.trim().length > 0 && selectedTime !== null

  const handleSubmit = () => {
    if (!canSubmit) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    createEvent.mutate(
      {
        name: eventName.trim(),
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime!,
        capacity,
        active,
        visible,
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          // Navigate to the new event's detail page
          router.replace(`/event/${data.eventId}`)
        },
        onError: () => {
          Alert.alert('Error', 'Failed to create event')
        },
      }
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Event Name */}
          <SectionHeader title="EVENT NAME" />
          <TextInput
            style={styles.textInput}
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g., Valentine's Day Dinner"
            placeholderTextColor={`${Neo.black}60`}
            autoCapitalize="words"
          />

          {/* Date */}
          <SectionHeader title="DATE" />
          <Pressable
            style={styles.dateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setShowDatePicker(true)
            }}
          >
            <Text style={styles.dateButtonText}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy').toUpperCase()}
            </Text>
          </Pressable>

          {/* Time */}
          <SectionHeader title="START TIME" />
          <TimePicker
            value={selectedTime}
            onChange={setSelectedTime}
            placeholder="Tap to select time"
          />

          {/* Capacity */}
          <SectionHeader title="CAPACITY" />
          <CapacityStepper value={capacity} onChange={setCapacity} />

          {/* Options */}
          <SectionHeader title="OPTIONS" />
          <View style={styles.optionsContainer}>
            <ToggleOption
              label="Active (accepting reservations)"
              value={active}
              onChange={setActive}
            />
            <ToggleOption
              label="Visible to guests"
              value={visible}
              onChange={setVisible}
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>NEXT STEPS</Text>
            <Text style={styles.infoBoxText}>
              After creating, you can add timeslots, configure pricing, and manage reservations from the event detail screen.
            </Text>
          </View>

          {/* Submit */}
          <View style={styles.submitContainer}>
            <NeoButton
              label="CREATE EVENT"
              onPress={handleSubmit}
              disabled={!canSubmit || createEvent.isPending}
              loading={createEvent.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateButton: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityStepperContainer: {
    gap: 16,
  },
  capacityStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  capacityStepButton: {
    width: 56,
    height: 48,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityStepButtonSmall: {
    width: 44,
    height: 48,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityStepButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityValueContainer: {
    width: 100,
    height: 64,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityPresetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  capacityPresetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  capacityPresetButtonSelected: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
  },
  capacityPresetText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityPresetTextSelected: {
    fontWeight: '900',
  },
  optionsContainer: {
    gap: 12,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 14,
    gap: 12,
  },
  toggleOptionPressed: {
    backgroundColor: Neo.cream,
  },
  checkbox: {
    width: 24,
    height: 24,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Neo.lime,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
  },
  toggleOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  infoBox: {
    backgroundColor: Neo.cyan + '30',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 16,
    marginTop: 24,
  },
  infoBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
    opacity: 0.8,
  },
  submitContainer: {
    marginTop: 32,
  },
  actionButton: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...NeoShadow.sm,
  },
  actionButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
