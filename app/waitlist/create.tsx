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
import { useGuests } from '@/lib/api/queries'
import { useCreateWaitlistEntry } from '@/lib/api/mutations'
import { DatePicker } from '@/components/ui/DatePicker'
import type { GuestInfo } from '@/lib/types'

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function PartySizePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (size: number) => void
}) {
  return (
    <View style={styles.partySizeContainer}>
      {PARTY_SIZES.map((size) => {
        const isSelected = size === value
        return (
          <Pressable
            key={size}
            style={[styles.partySizeButton, isSelected && styles.partySizeButtonSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onChange(size)
            }}
          >
            <Text
              style={[styles.partySizeText, isSelected && styles.partySizeTextSelected]}
            >
              {size}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function GuestSearchInput({
  value,
  onChange,
  onSelectGuest,
  selectedGuest,
}: {
  value: string
  onChange: (text: string) => void
  onSelectGuest: (guest: GuestInfo | null) => void
  selectedGuest: GuestInfo | null
}) {
  const { data, isLoading } = useGuests(value.length >= 2 ? value : undefined)
  const guests = data?.guests || []
  const showResults = value.length >= 2 && !selectedGuest

  if (selectedGuest) {
    return (
      <View style={styles.selectedGuest}>
        <View style={styles.selectedGuestInfo}>
          <Text style={styles.selectedGuestName}>{selectedGuest.name}</Text>
          {selectedGuest.email && (
            <Text style={styles.selectedGuestEmail}>{selectedGuest.email}</Text>
          )}
        </View>
        <Pressable
          style={styles.clearGuestButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onSelectGuest(null)
            onChange('')
          }}
        >
          <Text style={styles.clearGuestButtonText}>X</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder="Search or enter guest name"
        placeholderTextColor={`${Neo.black}60`}
        autoCapitalize="words"
      />
      {showResults && (
        <View style={styles.guestResults}>
          {isLoading ? (
            <View style={styles.guestResultsLoading}>
              <ActivityIndicator size="small" color={Neo.black} />
            </View>
          ) : guests.length > 0 ? (
            guests.slice(0, 5).map((guest) => (
              <Pressable
                key={guest.id}
                style={styles.guestResultRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onSelectGuest(guest)
                  onChange(guest.name)
                }}
              >
                <Text style={styles.guestResultName}>{guest.name}</Text>
                <Text style={styles.guestResultMeta}>
                  {guest.totalVisits || guest.visitCount || 0} visits
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.guestResultsEmpty}>
              <Text style={styles.guestResultsEmptyText}>No matching guests</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.toggleButton,
        active && styles.toggleButtonActive,
        pressed && styles.toggleButtonPressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>
        {label}
      </Text>
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
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor = variant === 'primary' ? Neo.purple : Neo.white

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
        <ActivityIndicator color={Neo.white} size="small" />
      ) : (
        <Text style={[styles.actionButtonText, variant === 'primary' && { color: Neo.white }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export default function AddToWaitlistScreen() {
  const router = useRouter()

  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [useSpecificTime, setUseSpecificTime] = useState(false)
  const [specificTime, setSpecificTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestInfo | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Mutations
  const createEntry = useCreateWaitlistEntry()

  const handleSelectGuest = (guest: GuestInfo | null) => {
    setSelectedGuest(guest)
    if (guest) {
      setEmail(guest.email || '')
    }
  }

  const canSubmit = guestName.trim().length > 0 && partySize > 0

  const handleSubmit = () => {
    if (!canSubmit) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const dateString = format(selectedDate, 'yyyy-MM-dd')

    createEntry.mutate(
      {
        date: dateString,
        time: useSpecificTime && specificTime.trim() ? specificTime.trim() : null,
        covers: partySize,
        name: guestName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.back()
        },
        onError: () => {
          Alert.alert('Error', 'Failed to add to waitlist')
        },
      }
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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

          {/* Time Preference */}
          <SectionHeader title="TIME PREFERENCE" />
          <View style={styles.toggleContainer}>
            <ToggleButton
              label="ANY TIME"
              active={!useSpecificTime}
              onPress={() => setUseSpecificTime(false)}
            />
            <ToggleButton
              label="SPECIFIC"
              active={useSpecificTime}
              onPress={() => setUseSpecificTime(true)}
            />
          </View>
          {useSpecificTime && (
            <TextInput
              style={[styles.textInput, { marginTop: 12 }]}
              value={specificTime}
              onChangeText={setSpecificTime}
              placeholder="e.g. 7:00 PM"
              placeholderTextColor={`${Neo.black}60`}
            />
          )}

          {/* Party Size */}
          <SectionHeader title="PARTY SIZE" />
          <PartySizePicker value={partySize} onChange={setPartySize} />

          {/* Guest Info */}
          <SectionHeader title="GUEST NAME" />
          <GuestSearchInput
            value={guestName}
            onChange={setGuestName}
            onSelectGuest={handleSelectGuest}
            selectedGuest={selectedGuest}
          />

          {/* Contact Info */}
          <SectionHeader title="PHONE (FOR NOTIFICATIONS)" />
          <TextInput
            style={styles.textInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={`${Neo.black}60`}
            keyboardType="phone-pad"
          />

          {!selectedGuest && (
            <>
              <SectionHeader title="EMAIL (OPTIONAL)" />
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={`${Neo.black}60`}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {/* Notes */}
          <SectionHeader title="NOTES (OPTIONAL)" />
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Special requests, seating preferences, etc."
            placeholderTextColor={`${Neo.black}60`}
            multiline
            numberOfLines={3}
          />

          {/* Submit */}
          <View style={styles.submitContainer}>
            <NeoButton
              label="ADD TO WAITLIST"
              onPress={handleSubmit}
              disabled={!canSubmit || createEntry.isPending}
              loading={createEntry.isPending}
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
  dateButton: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  toggleButtonActive: {
    backgroundColor: Neo.lime,
  },
  toggleButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleButtonTextActive: {
    color: Neo.black,
  },
  partySizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  partySizeButton: {
    width: 48,
    height: 48,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partySizeButtonSelected: {
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
  },
  partySizeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  partySizeTextSelected: {
    fontWeight: '900',
    color: Neo.white,
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
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedGuest: {
    flexDirection: 'row',
    backgroundColor: Neo.purple,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  selectedGuestInfo: {
    flex: 1,
  },
  selectedGuestName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.white,
    textTransform: 'uppercase',
  },
  selectedGuestEmail: {
    fontSize: 12,
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.8,
  },
  clearGuestButton: {
    width: 32,
    height: 32,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearGuestButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
  },
  guestResults: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderTopWidth: 0,
    maxHeight: 200,
  },
  guestResultsLoading: {
    padding: 16,
    alignItems: 'center',
  },
  guestResultRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black,
  },
  guestResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  guestResultMeta: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    opacity: 0.6,
  },
  guestResultsEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  guestResultsEmptyText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
