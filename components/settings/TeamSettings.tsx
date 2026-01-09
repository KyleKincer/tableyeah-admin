import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useStaffMembers } from '@/lib/api/queries'
import { useUpdateStaffRole, useRemoveStaff, useRevokeInvitation } from '@/lib/api/mutations'
import type { StaffMember, StaffRole } from '@/lib/types'
import { InviteStaffModal } from './InviteStaffModal'

const ROLE_CONFIG: Record<StaffRole, { label: string; color: string }> = {
  OWNER: { label: 'Owner', color: Neo.yellow },
  ADMIN: { label: 'Admin', color: Neo.purple },
  MANAGER: { label: 'Manager', color: Neo.cyan },
  STAFF: { label: 'Staff', color: Neo.lime },
}

const ALL_ROLES: StaffRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF']

function RoleBadge({ role }: { role: StaffRole }) {
  const config = ROLE_CONFIG[role]
  return (
    <View style={[styles.roleBadge, { backgroundColor: config.color }]}>
      <Text style={styles.roleBadgeText}>{config.label}</Text>
    </View>
  )
}

function StaffMemberRow({
  member,
  isCurrentUser,
  onChangeRole,
  onRemove,
  isChangingRole,
}: {
  member: StaffMember
  isCurrentUser: boolean
  onChangeRole: (newRole: StaffRole) => void
  onRemove: () => void
  isChangingRole: boolean
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)

  const handleRolePress = () => {
    if (isCurrentUser) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowRoleMenu(!showRoleMenu)
  }

  const handleSelectRole = (newRole: StaffRole) => {
    if (newRole === member.role) {
      setShowRoleMenu(false)
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowRoleMenu(false)
    onChangeRole(newRole)
  }

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Remove Staff Member',
      `Are you sure you want to remove ${member.name || member.email}'s admin access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: onRemove,
        },
      ]
    )
  }

  const lastActive = member.lastSignInAt
    ? new Date(member.lastSignInAt).toLocaleDateString()
    : 'Never'

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(member.name || member.email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberDetails}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.name || member.email}</Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <Text style={styles.lastActive}>Last active: {lastActive}</Text>
        </View>
      </View>

      <View style={styles.memberActions}>
        <Pressable
          style={styles.roleButton}
          onPress={handleRolePress}
          disabled={isCurrentUser || isChangingRole}
          accessibilityLabel={`Change role for ${member.name || member.email}`}
          accessibilityRole="button"
        >
          {isChangingRole ? (
            <ActivityIndicator size="small" color={Neo.black} />
          ) : (
            <>
              <RoleBadge role={member.role} />
              {!isCurrentUser && <Text style={styles.chevron}>▼</Text>}
            </>
          )}
        </Pressable>

        {!isCurrentUser && (
          <Pressable
            style={styles.removeButton}
            onPress={handleRemove}
            accessibilityLabel="Remove staff member"
            accessibilityRole="button"
          >
            <Text style={styles.removeButtonText}>×</Text>
          </Pressable>
        )}
      </View>

      {showRoleMenu && (
        <View style={styles.roleMenu}>
          {ALL_ROLES.map((r) => {
            const config = ROLE_CONFIG[r]
            const isSelected = r === member.role
            return (
              <Pressable
                key={r}
                style={[styles.roleMenuItem, isSelected && styles.roleMenuItemSelected]}
                onPress={() => handleSelectRole(r)}
                disabled={isSelected}
              >
                <View style={[styles.roleMenuDot, { backgroundColor: config.color }]} />
                <Text style={[styles.roleMenuText, isSelected && styles.roleMenuTextSelected]}>
                  {config.label}
                </Text>
                {isSelected && <Text style={styles.roleMenuCheck}>✓</Text>}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

function PendingInvitationRow({
  invitation,
  onRevoke,
  isRevoking,
}: {
  invitation: StaffMember
  onRevoke: () => void
  isRevoking: boolean
}) {
  const handleRevoke = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Revoke Invitation',
      `Are you sure you want to revoke the invitation for ${invitation.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: onRevoke,
        },
      ]
    )
  }

  return (
    <View style={styles.pendingRow}>
      <View style={styles.pendingInfo}>
        <View style={[styles.avatar, styles.pendingAvatar]}>
          <Text style={styles.avatarText}>@</Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{invitation.name || invitation.email}</Text>
          <Text style={styles.memberEmail}>
            {invitation.email} · {ROLE_CONFIG[invitation.role].label}
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.revokeButton}
        onPress={handleRevoke}
        disabled={isRevoking}
        accessibilityLabel="Revoke invitation"
        accessibilityRole="button"
      >
        {isRevoking ? (
          <ActivityIndicator size="small" color={Neo.black} />
        ) : (
          <Text style={styles.revokeButtonText}>×</Text>
        )}
      </Pressable>
    </View>
  )
}

export function TeamSettings() {
  const { user: currentUser } = useUser()
  const { data, isLoading, refetch } = useStaffMembers()
  const [refreshing, setRefreshing] = useState(false)
  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [changingRoleFor, setChangingRoleFor] = useState<number | null>(null)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  const updateRoleMutation = useUpdateStaffRole()
  const removeStaffMutation = useRemoveStaff()
  const revokeInvitationMutation = useRevokeInvitation()

  const staff = data?.staff || []
  const pendingInvitations = data?.pendingInvitations || []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleChangeRole = (memberId: number, newRole: StaffRole) => {
    setChangingRoleFor(memberId)
    updateRoleMutation.mutate(
      { id: memberId, role: newRole },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setChangingRoleFor(null)
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', err?.message || 'Failed to change role')
          setChangingRoleFor(null)
        },
      }
    )
  }

  const handleRemoveStaff = (memberId: number) => {
    removeStaffMutation.mutate(memberId, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to remove staff member')
      },
    })
  }

  const handleRevokeInvitation = (invitationId: number) => {
    setRevokingId(invitationId)
    revokeInvitationMutation.mutate(invitationId, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setRevokingId(null)
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', err?.message || 'Failed to revoke invitation')
        setRevokingId(null)
      },
    })
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Neo.black} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Neo.black} />
      }
    >
      {/* Header with Invite Button */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TEAM MEMBERS</Text>
          <Text style={styles.headerSubtitle}>Manage admin access and roles</Text>
        </View>
        <Pressable
          style={styles.inviteButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            setInviteModalVisible(true)
          }}
          accessibilityLabel="Invite staff member"
          accessibilityRole="button"
        >
          <Text style={styles.inviteButtonText}>+ INVITE</Text>
        </Pressable>
      </View>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.pendingHeader}>
            <Text style={styles.sectionHeader}>PENDING INVITATIONS</Text>
          </View>
          <View style={styles.pendingCard}>
            {pendingInvitations.map((invitation) => (
              <PendingInvitationRow
                key={invitation.id}
                invitation={invitation}
                onRevoke={() => handleRevokeInvitation(invitation.id)}
                isRevoking={revokingId === invitation.id}
              />
            ))}
          </View>
        </View>
      )}

      {/* Staff List */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TEAM MEMBERS</Text>
        <View style={styles.staffCard}>
          {staff.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No staff members yet.</Text>
              <Text style={styles.emptySubtext}>Invite your first team member above.</Text>
            </View>
          ) : (
            staff.map((member) => (
              <StaffMemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.clerkUserId === currentUser?.id}
                onChangeRole={(newRole) => handleChangeRole(member.id, newRole)}
                onRemove={() => handleRemoveStaff(member.id)}
                isChangingRole={changingRoleFor === member.id}
              />
            ))
          )}
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          {pendingInvitations.length > 0 &&
            ` · ${pendingInvitations.length} pending invitation${pendingInvitations.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      <InviteStaffModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        onSuccess={onRefresh}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Neo.cream,
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
    backgroundColor: Neo.cream,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerSubtitle: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...NeoShadow.sm,
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingCard: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: Neo.white,
    marginHorizontal: 8,
    marginVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingAvatar: {
    backgroundColor: Neo.orange,
  },
  revokeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokeButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.5,
  },
  staffCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.default,
  },
  memberRow: {
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black + '20',
    padding: 16,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
  },
  memberDetails: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
  },
  youBadge: {
    backgroundColor: Neo.yellow,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  memberEmail: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.6,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lastActive: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    fontSize: 10,
    color: Neo.black,
    opacity: 0.5,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: Neo.pink,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  roleMenu: {
    position: 'absolute',
    right: 16,
    top: 70,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
    zIndex: 10,
    minWidth: 140,
  },
  roleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Neo.black + '10',
    gap: 8,
  },
  roleMenuItemSelected: {
    backgroundColor: Neo.cream,
  },
  roleMenuDot: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  roleMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: Neo.black,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  roleMenuTextSelected: {
    fontWeight: '800',
  },
  roleMenuCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptySubtext: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.4,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summary: {
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    alignSelf: 'flex-start',
  },
  summaryText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
