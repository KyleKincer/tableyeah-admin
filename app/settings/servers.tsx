import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { Swipeable } from 'react-native-gesture-handler'
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

interface SwipeAction {
  label: string
  color: string
  textColor?: string
  onPress: () => void
}

function SwipeableServerRow({
  server,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  server: Server
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const [pressed, setPressed] = useState(false)

  const rightActions: SwipeAction[] = [
    { label: 'EDIT', color: Neo.cyan, onPress: onEdit },
    {
      label: server.active ? 'DISABLE' : 'ENABLE',
      color: server.active ? Neo.orange : Neo.lime,
      onPress: onToggleActive,
    },
    { label: 'DELETE', color: Neo.pink, textColor: Neo.white, onPress: onDelete },
  ]

  const handleAction = (action: SwipeAction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    swipeableRef.current?.close()
    action.onPress()
  }

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    return (
      <View style={styles.rightActionsContainer}>
        {rightActions.map((action, index) => {
          const scale = dragX.interpolate({
            inputRange: [-80 * (rightActions.length - index), 0],
            outputRange: [1, 0.5],
            extrapolate: 'clamp',
          })

          return (
            <Pressable
              key={action.label}
              style={[styles.swipeAction, { backgroundColor: action.color }]}
              onPress={() => handleAction(action)}
              accessibilityLabel={action.label}
              accessibilityRole="button"
            >
              <Animated.Text
                style={[
                  styles.swipeActionText,
                  { color: action.textColor || Neo.black, transform: [{ scale }] },
                ]}
              >
                {action.label}
              </Animated.Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={80}
      friction={2}
      overshootRight={false}
      onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
    >
      <Pressable
        style={[styles.serverRow, pressed && styles.serverRowPressed]}
        onPress={onEdit}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityLabel={`${server.name}, ${server.active ? 'active' : 'inactive'}`}
        accessibilityRole="button"
        accessibilityHint="Tap to edit, swipe for more options"
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
        <Text style={styles.swipeHint}>← SWIPE</Text>
      </Pressable>
    </Swipeable>
  )
}

interface ServerFormData {
  name: string
  color: string
}

function ServerModal({
  visible,
  server,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean
  server: Server | null
  onClose: () => void
  onSave: (data: ServerFormData) => void
  isSaving: boolean
}) {
  const [name, setName] = useState(server?.name || '')
  const [color, setColor] = useState(server?.color || SERVER_COLORS[0])

  // Reset form when modal opens
  const handleClose = () => {
    setName(server?.name || '')
    setColor(server?.color || SERVER_COLORS[0])
    onClose()
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a server name')
      return
    }
    onSave({ name: name.trim(), color })
  }

  // Reset form when modal opens or server changes
  useEffect(() => {
    if (visible) {
      setName(server?.name || '')
      setColor(server?.color || SERVER_COLORS[0])
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
              autoFocus
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

          <View style={styles.previewSection}>
            <Text style={styles.formLabel}>PREVIEW</Text>
            <View style={styles.previewContainer}>
              <ServerColorBadge color={color} name={name || 'AB'} />
              <Text style={styles.previewName}>{name || 'Server Name'}</Text>
            </View>
          </View>
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

export default function ServersScreen() {
  const { data, isLoading, refetch } = useServers()
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)

  const createMutation = useCreateServer()
  const updateMutation = useUpdateServer()
  const deleteMutation = useDeleteServer()

  const isSaving = createMutation.isPending || updateMutation.isPending

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

  const handleToggleActive = (server: Server) => {
    const action = server.active ? 'disable' : 'enable'
    Alert.alert(
      `${action.toUpperCase()} SERVER`,
      `${action === 'disable' ? 'Disable' : 'Enable'} ${server.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.toUpperCase(),
          onPress: () => {
            updateMutation.mutate(
              { id: server.id, active: !server.active },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                },
                onError: (error: any) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  Alert.alert('Error', error?.message || `Failed to ${action} server`)
                },
              }
            )
          },
        },
      ]
    )
  }

  const handleDelete = (server: Server) => {
    Alert.alert(
      'DELETE SERVER',
      `Permanently delete ${server.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(server.id, {
              onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              },
              onError: (error: any) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                Alert.alert('Error', error?.message || 'Failed to delete server')
              },
            })
          },
        },
      ]
    )
  }

  const handleSave = (formData: ServerFormData) => {
    if (editingServer) {
      // Update existing server
      updateMutation.mutate(
        { id: editingServer.id, name: formData.name, color: formData.color },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            setModalVisible(false)
            setEditingServer(null)
          },
          onError: (error: any) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', error?.message || 'Failed to update server')
          },
        }
      )
    } else {
      // Create new server
      createMutation.mutate(formData, {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setModalVisible(false)
        },
        onError: (error: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          Alert.alert('Error', error?.message || 'Failed to create server')
        },
      })
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isLoading && !data ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      ) : sortedServers.length === 0 ? (
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
            <SwipeableServerRow
              server={item}
              onEdit={() => handleEdit(item)}
              onToggleActive={() => handleToggleActive(item)}
              onDelete={() => handleDelete(item)}
            />
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
        isSaving={isSaving}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
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
  swipeHint: {
    fontSize: 8,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.3,
    marginRight: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rightActionsContainer: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderLeftWidth: 0,
  },
  swipeActionText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
})
