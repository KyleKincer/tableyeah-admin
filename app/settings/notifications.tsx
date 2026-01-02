import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useNotificationSettings } from '@/lib/api/queries'
import { useUpdateNotificationSettings } from '@/lib/api/mutations'
import type { NotificationSettings } from '@/lib/types'

function NeoToggle({
  value,
  onToggle,
  disabled = false,
}: {
  value: boolean
  onToggle: (newValue: boolean) => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={[
        styles.toggleTrack,
        value ? styles.toggleTrackOn : styles.toggleTrackOff,
        disabled && styles.toggleTrackDisabled,
      ]}
      onPress={() => {
        if (disabled) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onToggle(!value)
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View
        style={[
          styles.toggleKnob,
          value ? styles.toggleKnobOn : styles.toggleKnobOff,
          disabled && styles.toggleKnobDisabled,
        ]}
      />
    </Pressable>
  )
}

function SettingRow({
  label,
  description,
  value,
  onToggle,
  disabled = false,
  indent = false,
}: {
  label: string
  description?: string
  value: boolean
  onToggle: (newValue: boolean) => void
  disabled?: boolean
  indent?: boolean
}) {
  return (
    <View style={[styles.settingRow, indent && styles.settingRowIndent]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, disabled && styles.settingLabelDisabled]}>{label}</Text>
        {description && (
          <Text style={[styles.settingDescription, disabled && styles.settingDescriptionDisabled]}>
            {description}
          </Text>
        )}
      </View>
      <NeoToggle value={value} onToggle={onToggle} disabled={disabled} />
    </View>
  )
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  const decrement = () => {
    if (value > min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onChange(value - step)
    }
  }

  const increment = () => {
    if (value < max) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onChange(value + step)
    }
  }

  return (
    <View style={[styles.stepperContainer, disabled && styles.stepperContainerDisabled]}>
      <Text style={[styles.stepperLabel, disabled && styles.stepperLabelDisabled]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
          onPress={decrement}
          disabled={disabled || value <= min}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {value}
          {suffix}
        </Text>
        <Pressable
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
          onPress={increment}
          disabled={disabled || value >= max}
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

// Exported content component for use in split view
export function NotificationsSettingsContent() {
  const { data: settings, isLoading, refetch, isRefetching } = useNotificationSettings()
  const updateSettings = useUpdateNotificationSettings()

  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings)
    }
  }, [settings, localSettings])

  const updateLocal = (updates: Partial<NotificationSettings>) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, ...updates })
      setIsDirty(true)
    }
  }

  const handleSave = async () => {
    if (!localSettings) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await updateSettings.mutateAsync(localSettings)
      setIsDirty(false)
      Alert.alert('Success', 'Notification settings saved')
    } catch {
      Alert.alert('Error', 'Failed to save notification settings')
    }
  }

  if (isLoading || !localSettings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Neo.black} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Neo.black}
        />
      }
    >
      {/* Guest Reminders */}
      <View style={styles.section}>
        <SectionHeader title="GUEST REMINDERS" />
        <View style={styles.card}>
          <SettingRow
            label="Send Reminder Email"
            description="Send guests an email reminder before their reservation"
            value={localSettings.reminderEnabled}
            onToggle={(v) => updateLocal({ reminderEnabled: v })}
          />
          {localSettings.reminderEnabled && (
            <NumberStepper
              label="Hours before"
              value={localSettings.reminderHoursBefore}
              onChange={(v) => updateLocal({ reminderHoursBefore: v })}
              min={1}
              max={72}
              suffix="h"
            />
          )}
        </View>
      </View>

      {/* Post-Visit */}
      <View style={styles.section}>
        <SectionHeader title="POST-VISIT FOLLOW-UP" />
        <View style={styles.card}>
          <SettingRow
            label="Send Follow-up Email"
            description="Send guests an email after their visit"
            value={localSettings.postVisitEnabled}
            onToggle={(v) => updateLocal({ postVisitEnabled: v })}
          />
          {localSettings.postVisitEnabled && (
            <NumberStepper
              label="Hours after visit"
              value={localSettings.postVisitDelayHours}
              onChange={(v) => updateLocal({ postVisitDelayHours: v })}
              min={1}
              max={48}
              suffix="h"
            />
          )}
        </View>
      </View>

      {/* SMS */}
      <View style={styles.section}>
        <SectionHeader title="SMS NOTIFICATIONS" />
        <View style={styles.card}>
          <SettingRow
            label="Enable SMS"
            description="Send SMS notifications to guests"
            value={localSettings.smsEnabled}
            onToggle={(v) => updateLocal({ smsEnabled: v })}
          />
          {localSettings.smsEnabled && (
            <SettingRow
              label="Require Phone Number"
              description="Make phone number required for reservations"
              value={localSettings.smsPhoneRequired}
              onToggle={(v) => updateLocal({ smsPhoneRequired: v })}
              indent
            />
          )}
        </View>
      </View>

      {/* Staff Notifications */}
      <View style={styles.section}>
        <SectionHeader title="STAFF NOTIFICATIONS" />
        <View style={styles.card}>
          <SettingRow
            label="Enable Staff Notifications"
            description="Send email notifications to staff"
            value={localSettings.staffNotificationsEnabled}
            onToggle={(v) => updateLocal({ staffNotificationsEnabled: v })}
          />
          {localSettings.staffNotificationsEnabled && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subheader}>NOTIFY WHEN:</Text>
              <SettingRow
                label="New Booking"
                value={localSettings.staffNotifyOnNewBooking}
                onToggle={(v) => updateLocal({ staffNotifyOnNewBooking: v })}
                indent
              />
              <SettingRow
                label="Guest Confirms"
                value={localSettings.staffNotifyOnConfirmation}
                onToggle={(v) => updateLocal({ staffNotifyOnConfirmation: v })}
                indent
              />
              <SettingRow
                label="Cancellation"
                value={localSettings.staffNotifyOnCancellation}
                onToggle={(v) => updateLocal({ staffNotifyOnCancellation: v })}
                indent
              />
              <SettingRow
                label="Modification"
                value={localSettings.staffNotifyOnModification}
                onToggle={(v) => updateLocal({ staffNotifyOnModification: v })}
                indent
              />
              <View style={styles.divider} />
              <View style={styles.emailInputContainer}>
                <Text style={styles.inputLabel}>STAFF EMAILS</Text>
                <Text style={styles.inputHint}>Comma-separated list of emails</Text>
                <TextInput
                  style={styles.textInput}
                  value={localSettings.staffNotificationEmails || ''}
                  onChangeText={(v) => updateLocal({ staffNotificationEmails: v || null })}
                  placeholder="staff@example.com, manager@example.com"
                  placeholderTextColor={Neo.black + '40'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Save Button */}
      {isDirty && (
        <View style={styles.saveContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              NeoShadow.sm,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSave}
            disabled={updateSettings.isPending}
            accessibilityRole="button"
            accessibilityLabel="Save notification settings"
          >
            {updateSettings.isPending ? (
              <ActivityIndicator size="small" color={Neo.black} />
            ) : (
              <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  )
}

// Screen wrapper for standalone navigation
export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NotificationsSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: Neo.black + '80',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  card: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingRowIndent: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: Neo.black + '20',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 2,
  },
  settingLabelDisabled: {
    color: Neo.black + '40',
  },
  settingDescription: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  settingDescriptionDisabled: {
    color: Neo.black + '30',
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
  toggleTrackDisabled: {
    opacity: 0.5,
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
  toggleKnobDisabled: {
    backgroundColor: Neo.black + '60',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 16,
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: Neo.black + '20',
  },
  stepperContainerDisabled: {
    opacity: 0.5,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Neo.black,
  },
  stepperLabelDisabled: {
    color: Neo.black + '40',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 36,
    height: 36,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Neo.black,
  },
  stepperValue: {
    minWidth: 50,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: Neo.black + '20',
    marginVertical: 12,
  },
  subheader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Neo.black + '60',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emailInputContainer: {
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Neo.black,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputHint: {
    fontSize: 11,
    color: Neo.black + '60',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveContainer: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
  },
  bottomPadding: {
    height: 40,
  },
})
