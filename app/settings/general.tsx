import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useGeneralSettings } from '@/lib/api/queries'
import { useUpdateGeneralSettings } from '@/lib/api/mutations'
import type { GeneralSettings } from '@/lib/types'

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
]

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  multiline = false,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: 'name' | 'email' | 'tel' | 'street-address' | 'postal-code' | 'url' | 'off'
  multiline?: boolean
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.textInput, multiline && styles.textInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Neo.black + '40'}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        multiline={multiline}
        accessibilityLabel={label}
      />
    </View>
  )
}

function TimezonePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const selectedTz = TIMEZONES.find((tz) => tz.value === value)

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>TIMEZONE</Text>
      <Pressable
        style={styles.pickerButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          setExpanded(!expanded)
        }}
        accessibilityLabel="Select timezone"
        accessibilityRole="button"
      >
        <Text style={styles.pickerButtonText}>
          {selectedTz?.label || value || 'Select timezone'}
        </Text>
        <Text style={styles.pickerChevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.pickerOptions}>
          {TIMEZONES.map((tz) => (
            <Pressable
              key={tz.value}
              style={[
                styles.pickerOption,
                value === tz.value && styles.pickerOptionSelected,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onChange(tz.value)
                setExpanded(false)
              }}
              accessibilityLabel={tz.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === tz.value }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  value === tz.value && styles.pickerOptionTextSelected,
                ]}
              >
                {tz.label}
              </Text>
              {value === tz.value && (
                <Text style={styles.pickerCheckmark}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

export default function GeneralSettingsScreen() {
  const { data, isLoading, refetch } = useGeneralSettings()
  const updateMutation = useUpdateGeneralSettings()
  const [refreshing, setRefreshing] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [timezone, setTimezone] = useState('')

  // Track if form has changed
  const [hasChanges, setHasChanges] = useState(false)

  // Load initial data
  useEffect(() => {
    if (data) {
      setName(data.name || '')
      setEmail(data.email || '')
      setPhone(data.phone || '')
      setAddress(data.address || '')
      setCity(data.city || '')
      setState(data.state || '')
      setZipCode(data.zipCode || '')
      setWebsiteUrl(data.websiteUrl || '')
      setTimezone(data.timezone || '')
      setHasChanges(false)
    }
  }, [data])

  // Check for changes when any field updates
  useEffect(() => {
    if (!data) return
    const changed =
      name !== (data.name || '') ||
      email !== (data.email || '') ||
      phone !== (data.phone || '') ||
      address !== (data.address || '') ||
      city !== (data.city || '') ||
      state !== (data.state || '') ||
      zipCode !== (data.zipCode || '') ||
      websiteUrl !== (data.websiteUrl || '') ||
      timezone !== (data.timezone || '')
    setHasChanges(changed)
  }, [data, name, email, phone, address, city, state, zipCode, websiteUrl, timezone])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleSave = () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert('Error', 'Restaurant name is required')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Valid email is required')
      return
    }
    if (!timezone) {
      Alert.alert('Error', 'Timezone is required')
      return
    }

    // Validate URL if provided
    if (websiteUrl.trim()) {
      try {
        new URL(websiteUrl)
      } catch {
        Alert.alert('Error', 'Invalid website URL format')
        return
      }
    }

    const settings: GeneralSettings = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zipCode: zipCode.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      timezone,
    }

    updateMutation.mutate(settings, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setHasChanges(false)
      },
      onError: (error: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to save settings')
      },
    })
  }

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>RESTAURANT INFO</Text>
            <View style={styles.sectionContent}>
              <FormField
                label="NAME *"
                value={name}
                onChangeText={setName}
                placeholder="Restaurant name"
                autoCapitalize="words"
                autoComplete="name"
              />
              <FormField
                label="EMAIL *"
                value={email}
                onChangeText={setEmail}
                placeholder="contact@restaurant.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <FormField
                label="PHONE"
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 555-5555"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <FormField
                label="WEBSITE"
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                placeholder="https://www.restaurant.com"
                keyboardType="url"
                autoCapitalize="none"
                autoComplete="url"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>LOCATION</Text>
            <View style={styles.sectionContent}>
              <FormField
                label="ADDRESS"
                value={address}
                onChangeText={setAddress}
                placeholder="123 Main Street"
                autoComplete="street-address"
              />
              <View style={styles.row}>
                <View style={styles.cityField}>
                  <FormField
                    label="CITY"
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.stateField}>
                  <FormField
                    label="STATE"
                    value={state}
                    onChangeText={setState}
                    placeholder="CA"
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.zipField}>
                  <FormField
                    label="ZIP"
                    value={zipCode}
                    onChangeText={setZipCode}
                    placeholder="12345"
                    autoComplete="postal-code"
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>TIME SETTINGS</Text>
            <View style={styles.sectionContent}>
              <TimezonePicker value={timezone} onChange={setTimezone} />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.saveButton,
                !hasChanges && styles.saveButtonDisabled,
                updateMutation.isPending && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              accessibilityLabel="Save changes"
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasChanges || updateMutation.isPending }}
            >
              <Text style={styles.saveButtonText}>
                {updateMutation.isPending ? 'SAVING...' : 'SAVE CHANGES'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionContent: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cityField: {
    flex: 2,
  },
  stateField: {
    flex: 1,
  },
  zipField: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pickerChevron: {
    fontSize: 10,
    color: Neo.black,
  },
  pickerOptions: {
    marginTop: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '20',
  },
  pickerOptionSelected: {
    backgroundColor: Neo.lime + '40',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pickerOptionTextSelected: {
    fontWeight: '800',
  },
  pickerCheckmark: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
  },
  buttonContainer: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Neo.black + '20',
    ...NeoShadow.pressed,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
