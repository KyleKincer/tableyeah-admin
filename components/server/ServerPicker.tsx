import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useState, useEffect } from 'react'

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useServers } from '@/lib/api/queries'
import type { Server } from '@/lib/types'

interface ServerPickerModalProps {
  visible: boolean
  currentServerId: number | null
  onSelect: (serverId: number | null) => void
  onClose: () => void
}

export function ServerPickerModal({
  visible,
  currentServerId,
  onSelect,
  onClose,
}: ServerPickerModalProps) {
  const [selectedServerId, setSelectedServerId] = useState<number | null>(currentServerId)
  const { data: serversData, isLoading } = useServers()
  const activeServers = (serversData?.servers || []).filter((s) => s.active)

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedServerId(currentServerId)
    }
  }, [visible, currentServerId])

  const handleSelectServer = (serverId: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedServerId(serverId)
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelect(selectedServerId)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerText}>ASSIGN SERVER</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Neo.black} />
                <Text style={styles.loadingText}>Loading servers...</Text>
              </View>
            ) : activeServers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No active servers</Text>
                <Text style={styles.emptyHint}>
                  Add servers in Settings → Servers
                </Text>
              </View>
            ) : (
              <>
                {/* No Server option */}
                <Pressable
                  style={[
                    styles.serverOption,
                    selectedServerId === null && styles.serverOptionSelected,
                  ]}
                  onPress={() => handleSelectServer(null)}
                  accessibilityLabel="No server assigned"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedServerId === null }}
                >
                  <View style={styles.noServerBadge}>
                    <Text style={styles.noServerText}>—</Text>
                  </View>
                  <Text style={styles.serverName}>NO SERVER</Text>
                  {selectedServerId === null && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>

                {/* Server list */}
                {activeServers.map((server) => {
                  const isSelected = selectedServerId === server.id
                  const textColor = getContrastText(server.color)
                  return (
                    <Pressable
                      key={server.id}
                      style={[
                        styles.serverOption,
                        isSelected && styles.serverOptionSelected,
                      ]}
                      onPress={() => handleSelectServer(server.id)}
                      accessibilityLabel={`Server ${server.name}${isSelected ? ', selected' : ''}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[styles.serverBadge, { backgroundColor: server.color }]}>
                        <Text style={[styles.serverInitials, { color: textColor }]}>
                          {server.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.serverName}>{server.name}</Text>
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </Pressable>
                  )
                })}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={handleSave}
              accessibilityLabel="Save server assignment"
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>SAVE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
    maxWidth: 360,
    maxHeight: '70%',
    ...NeoShadow.lg,
  },
  header: {
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.blue,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.white,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 350,
  },
  content: {
    padding: 12,
    gap: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  loadingText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyHint: {
    fontSize: 11,
    color: Neo.black,
    opacity: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
    textAlign: 'center',
  },
  serverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    padding: 12,
    gap: 12,
  },
  serverOptionSelected: {
    backgroundColor: Neo.lime + '30',
    borderWidth: NeoBorder.default,
  },
  noServerBadge: {
    width: 40,
    height: 40,
    backgroundColor: Neo.cream,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noServerText: {
    fontSize: 18,
    fontWeight: '700',
    color: Neo.black,
    opacity: 0.3,
  },
  serverBadge: {
    width: 40,
    height: 40,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverInitials: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
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
  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
