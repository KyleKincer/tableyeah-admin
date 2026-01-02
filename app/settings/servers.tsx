import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useServers } from '@/lib/api/queries'
import { useCreateServer, useUpdateServer, useDeleteServer } from '@/lib/api/mutations'
import type { Server } from '@/lib/types'

// Preset colors for server assignment
const SERVER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#64748b', // slate
]

function ServerColorBadge({ color, name }: { color: string; name: string }) {
  const textColor = getContrastText(color)

  return (
    <View style={[styles.serverBadge, { backgroundColor: color }]}>
      <Text style={[styles.serverBadgeText, { color: textColor }]}>
        {name.substring(0, 2).toUpperCase()}
      </Text>
    </View>
  )
}

function ServerRow({ server, onPress }: { server: Server; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.serverRow, pressed && styles.serverRowPressed]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`${server.name}, ${server.active ? 'active' : 'inactive'}`}
      accessibilityRole="button"
      accessibilityHint="Tap to edit"
    >
      <View style={[styles.colorStripe, { backgroundColor: server.color }]} />
      <ServerColorBadge color={server.color} name={server.name} />
      <View style={styles.serverInfo}>
        <Text style={styles.serverName}>{server.name}</Text>
        {!server.active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
          </View>
        )}
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  )
}

interface ServerFormData {
  name: string
  color: string
  active: boolean
}

function NeoToggle({
  value,
  onToggle,
}: {
  value: boolean
  onToggle: (newValue: boolean) => void
}) {
  return (
    <Pressable
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onToggle(!value)
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  )
}

function ServerModal({
  visible,
  server,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  visible: boolean
  server: Server | null
  onClose: () => void
  onSave: (data: ServerFormData) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [name, setName] = useState(server?.name || '')
  const [color, setColor] = useState(server?.color || SERVER_COLORS[0])
  const [active, setActive] = useState(server?.active ?? true)

  const handleClose = () => {
    setName(server?.name || '')
    setColor(server?.color || SERVER_COLORS[0])
    setActive(server?.active ?? true)
    onClose()
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a server name')
      return
    }
    onSave({ name: name.trim(), color, active })
  }

  const handleDelete = () => {
    Alert.alert(
      'DELETE SERVER',
      `Permanently delete ${server?.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    )
  }

  // Reset form when modal opens or server changes
  useEffect(() => {
    if (visible) {
      setName(server?.name || '')
      setColor(server?.color || SERVER_COLORS[0])
      setActive(server?.active ?? true)
    }
  }, [visible, server])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable
            onPress={handleClose}
            style={styles.modalHeaderButton}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={styles.modalHeaderButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {server ? 'EDIT SERVER' : 'NEW SERVER'}
          </Text>
          <Pressable
            onPress={handleSave}
            style={[styles.modalHeaderButton, styles.modalSaveButton]}
            disabled={isSaving}
            accessibilityLabel="Save"
            accessibilityRole="button"
          >
            <Text style={[styles.modalHeaderButtonText, styles.modalSaveButtonText]}>
              {isSaving ? '...' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>NAME</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter server name"
              placeholderTextColor={Neo.black + '40'}
              autoCapitalize="words"
              autoFocus={!server}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>COLOR</Text>
            <View style={styles.colorGrid}>
              {SERVER_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    color === c && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setColor(c)
                  }}
                  accessibilityLabel={`Color ${c}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: color === c }}
                >
                  {color === c && (
                    <Text style={[styles.colorCheckmark, { color: getContrastText(c) }]}>
                      ✓
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {server && (
            <View style={styles.formSection}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Active</Text>
                  <Text style={styles.toggleDescription}>Server is available for assignment</Text>
                </View>
                <NeoToggle value={active} onToggle={setActive} />
              </View>
            </View>
          )}

          <View style={styles.previewSection}>
            <Text style={styles.formLabel}>PREVIEW</Text>
            <View style={styles.previewContainer}>
              <ServerColorBadge color={color} name={name || 'AB'} />
              <Text style={styles.previewName}>{name || 'Server Name'}</Text>
            </View>
          </View>

          {/* Delete button - only for existing servers */}
          {server && (
            <View style={styles.dangerSection}>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={isDeleting}
                accessibilityLabel="Delete server"
                accessibilityRole="button"
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'DELETING...' : 'DELETE SERVER'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function FAB({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <Pressable
      style={[styles.fab, pressed && styles.fabPressed]}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel="Add server"
      accessibilityRole="button"
      accessibilityHint="Opens the add server modal"
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  )
}

// Exported content component for use in split view
export function ServersSettingsContent() {
  const { data, isLoading, refetch } = useServers()
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)

  const createMutation = useCreateServer()
  const updateMutation = useUpdateServer()
  const deleteMutation = useDeleteServer()

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isDeleting = deleteMutation.isPending

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const servers = data?.servers || []

  // Sort: active first, then by name
  const sortedServers = [...servers].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const handleAddNew = () => {
    setEditingServer(null)
    setModalVisible(true)
  }

  const handleEdit = (server: Server) => {
    setEditingServer(server)
    setModalVisible(true)
  }

  const handleDelete = async () => {
    if (!editingServer) return

    try {
      await deleteMutation.mutateAsync(editingServer.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setModalVisible(false)
      setEditingServer(null)
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error?.message || 'Failed to delete server')
    }
  }

  const handleSave = async (formData: ServerFormData) => {
    if (editingServer) {
      // Update existing server
      try {
        await updateMutation.mutateAsync({
          id: editingServer.id,
          name: formData.name,
          color: formData.color,
          active: formData.active,
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setModalVisible(false)
        setEditingServer(null)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to update server')
      }
    } else {
      // Create new server
      try {
        await createMutation.mutateAsync({ name: formData.name, color: formData.color })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setModalVisible(false)
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error?.message || 'Failed to create server')
      }
    }
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
    <View style={styles.contentContainer}>
      {sortedServers.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        >
          <Text style={styles.emptyTitle}>NO SERVERS</Text>
          <Text style={styles.emptySubtext}>
            Add servers to assign them to tables and reservations
          </Text>
          <Pressable
            style={styles.addFirstButton}
            onPress={handleAddNew}
            accessibilityLabel="Add your first server"
            accessibilityRole="button"
          >
            <Text style={styles.addFirstButtonText}>+ ADD SERVER</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedServers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ServerRow server={item} onPress={() => handleEdit(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        />
      )}

      {sortedServers.length > 0 && <FAB onPress={handleAddNew} />}

      <ServerModal
        visible={modalVisible}
        server={editingServer}
        onClose={() => {
          setModalVisible(false)
          setEditingServer(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        isSaving={isSaving}
        isDeleting={isDeleting}
      />
    </View>
  )
}

// Screen wrapper for standalone navigation
export default function ServersScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ServersSettingsContent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    overflow: 'hidden',
    ...NeoShadow.default,
  },
  serverRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  colorStripe: {
    width: 6,
    alignSelf: 'stretch',
  },
  serverBadge: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  serverBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  inactiveBadge: {
    backgroundColor: Neo.black + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Neo.black + '40',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Neo.black + '60',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    marginRight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    paddingHorizontal: 24,
    ...NeoShadow.sm,
  },
  addFirstButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    backgroundColor: Neo.blue,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.default,
  },
  fabPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  fabText: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.white,
    marginTop: -2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.blue,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalHeaderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalHeaderButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalSaveButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalSaveButtonText: {
    color: Neo.black,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.white,
    letterSpacing: -0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: NeoBorder.thick,
  },
  colorCheckmark: {
    fontSize: 20,
    fontWeight: '900',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  previewSection: {
    marginTop: 8,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    gap: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  dangerSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Neo.black + '20',
  },
  deleteButton: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomPadding: {
    height: 40,
  },
})
