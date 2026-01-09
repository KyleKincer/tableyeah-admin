import { useState } from 'react'
import {
  ActivityIndicator,
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
import { useInviteStaff } from '@/lib/api/mutations'
import type { StaffRole } from '@/lib/types'

const ROLE_CONFIG: Record<
  StaffRole,
  { label: string; description: string; color: string }
> = {
  OWNER: {
    label: 'Owner',
    description: 'Full access including billing',
    color: Neo.yellow,
  },
  ADMIN: {
    label: 'Admin',
    description: 'Full access except billing',
    color: Neo.purple,
  },
  MANAGER: {
    label: 'Manager',
    description: 'Manage reservations & view reports',
    color: Neo.cyan,
  },
  STAFF: {
    label: 'Staff',
    description: 'Manage reservations only',
    color: Neo.lime,
  },
}

const ALL_ROLES: StaffRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF']

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export function InviteStaffModal({ visible, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('STAFF')
  const [error, setError] = useState('')

  const inviteMutation = useInviteStaff()

  const handleInvite = async () => {
    if (!email.trim()) {
      setError('Email is required')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    if (!email.includes('@')) {
      setError('Invalid email address')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    setError('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    inviteMutation.mutate(
      {
        email: email.trim(),
        name: name.trim() || undefined,
        role,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setEmail('')
          setName('')
          setRole('STAFF')
          onSuccess()
          onClose()
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setError(err?.message || 'Failed to send invitation')
        },
      }
    )
  }

  const handleClose = () => {
    setEmail('')
    setName('')
    setRole('STAFF')
    setError('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.title}>INVITE STAFF</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.label}>EMAIL ADDRESS *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="colleague@restaurant.com"
              placeholderTextColor={Neo.black + '40'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>NAME (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor={Neo.black + '40'}
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>ROLE</Text>
            <View style={styles.rolesGrid}>
              {ALL_ROLES.map((r) => {
                const config = ROLE_CONFIG[r]
                const isSelected = role === r
                return (
                  <Pressable
                    key={r}
                    style={[
                      styles.roleOption,
                      { backgroundColor: isSelected ? config.color : Neo.white },
                      isSelected && styles.roleOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setRole(r)
                    }}
                    accessibilityLabel={config.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={styles.roleLabel}>{config.label}</Text>
                    <Text style={styles.roleDescription}>{config.description}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.inviteButton, inviteMutation.isPending && styles.inviteButtonDisabled]}
            onPress={handleInvite}
            disabled={inviteMutation.isPending}
            accessibilityLabel="Send invitation"
            accessibilityRole="button"
          >
            {inviteMutation.isPending ? (
              <ActivityIndicator color={Neo.black} />
            ) : (
              <Text style={styles.inviteButtonText}>SEND INVITATION</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.yellow,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerSpacer: {
    width: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rolesGrid: {
    gap: 12,
  },
  roleOption: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
  },
  roleOptionSelected: {
    ...NeoShadow.sm,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorCard: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 18,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  inviteButtonDisabled: {
    backgroundColor: Neo.black + '20',
    ...NeoShadow.pressed,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
