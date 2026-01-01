import { useState } from 'react'
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

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { Server, TableWithStatus } from '@/lib/types'

interface ServerAssignmentSheetProps {
  visible: boolean
  servers: Server[]
  tables: TableWithStatus[]
  currentAssignments: Record<number, { serverId: number; serverName: string; serverColor: string }>
  onClose: () => void
  onSave: (assignments: { tableId: number; serverId: number | null }[]) => void
  isLoading?: boolean
}

export function ServerAssignmentSheet({
  visible,
  servers,
  tables,
  currentAssignments,
  onClose,
  onSave,
  isLoading = false,
}: ServerAssignmentSheetProps) {
  // Track local edits to assignments
  const [localAssignments, setLocalAssignments] = useState<
    Record<number, { serverId: number; serverName: string; serverColor: string } | null>
  >({})
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)

  const activeServers = servers.filter((s) => s.active)

  const handleServerSelect = (serverId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedServerId(selectedServerId === serverId ? null : serverId)
  }

  const handleTableTap = (tableId: number) => {
    if (selectedServerId === null) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const server = activeServers.find((s) => s.id === selectedServerId)
    if (!server) return

    // Get current assignment (from local edits or original)
    const currentAssignment =
      localAssignments[tableId] !== undefined
        ? localAssignments[tableId]
        : currentAssignments[tableId]

    // Toggle: if already assigned to this server, unassign
    if (currentAssignment?.serverId === selectedServerId) {
      setLocalAssignments((prev) => ({
        ...prev,
        [tableId]: null,
      }))
    } else {
      // Assign to selected server
      setLocalAssignments((prev) => ({
        ...prev,
        [tableId]: {
          serverId: server.id,
          serverName: server.name,
          serverColor: server.color,
        },
      }))
    }
  }

  const getTableAssignment = (tableId: number) => {
    if (localAssignments[tableId] !== undefined) {
      return localAssignments[tableId]
    }
    return currentAssignments[tableId] || null
  }

  const handleSave = () => {
    // Build list of changes
    const changes: { tableId: number; serverId: number | null }[] = []

    for (const [tableIdStr, assignment] of Object.entries(localAssignments)) {
      const tableId = parseInt(tableIdStr, 10)
      changes.push({
        tableId,
        serverId: assignment?.serverId ?? null,
      })
    }

    if (changes.length === 0) {
      onClose()
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onSave(changes)
    setLocalAssignments({})
    setSelectedServerId(null)
  }

  const handleClose = () => {
    setLocalAssignments({})
    setSelectedServerId(null)
    onClose()
  }

  const hasChanges = Object.keys(localAssignments).length > 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>CANCEL</Text>
          </Pressable>
          <Text style={styles.title}>ASSIGN SERVERS</Text>
          <Pressable
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Neo.black} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>SAVE</Text>
            )}
          </Pressable>
        </View>

        {/* Server picker */}
        <View style={styles.serverPicker}>
          <Text style={styles.label}>SELECT SERVER</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serverList}
          >
            {activeServers.map((server) => (
              <Pressable
                key={server.id}
                style={[
                  styles.serverChip,
                  { borderColor: server.color },
                  selectedServerId === server.id && styles.serverChipSelected,
                  selectedServerId === server.id && { backgroundColor: server.color },
                ]}
                onPress={() => handleServerSelect(server.id)}
              >
                <View
                  style={[styles.serverDot, { backgroundColor: server.color }]}
                />
                <Text
                  style={[
                    styles.serverChipText,
                    selectedServerId === server.id && styles.serverChipTextSelected,
                  ]}
                >
                  {server.name}
                </Text>
              </Pressable>
            ))}
            {activeServers.length === 0 && (
              <Text style={styles.noServersText}>No active servers</Text>
            )}
          </ScrollView>
          {selectedServerId && (
            <Text style={styles.hint}>Tap tables to assign/unassign</Text>
          )}
        </View>

        {/* Table grid */}
        <ScrollView style={styles.tableArea} contentContainerStyle={styles.tableGrid}>
          {tables.map((table) => {
            const assignment = getTableAssignment(table.id)
            const isAssignedToSelected = assignment?.serverId === selectedServerId

            return (
              <Pressable
                key={table.id}
                style={[
                  styles.tableCard,
                  assignment && {
                    borderColor: assignment.serverColor,
                    borderWidth: 3,
                  },
                  isAssignedToSelected && styles.tableCardSelected,
                  !selectedServerId && styles.tableCardDisabled,
                ]}
                onPress={() => handleTableTap(table.id)}
                disabled={!selectedServerId}
              >
                <Text style={styles.tableNumber}>{table.table_number}</Text>
                {assignment ? (
                  <View
                    style={[
                      styles.assignedBadge,
                      { backgroundColor: assignment.serverColor },
                    ]}
                  >
                    <Text style={styles.assignedText}>
                      {assignment.serverName.split(' ')[0]}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.unassignedText}>—</Text>
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
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
    paddingVertical: 12,
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.lime,
    ...NeoShadow.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Neo.white,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  serverPicker: {
    backgroundColor: Neo.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
    opacity: 0.6,
  },
  serverList: {
    flexDirection: 'row',
    gap: 10,
  },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    backgroundColor: Neo.white,
    gap: 6,
  },
  serverChipSelected: {
    ...NeoShadow.sm,
  },
  serverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  serverChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  serverChipTextSelected: {
    color: Neo.black,
  },
  noServersText: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  hint: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    marginTop: 8,
    fontStyle: 'italic',
  },
  tableArea: {
    flex: 1,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  tableCard: {
    width: 80,
    height: 80,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  tableCardSelected: {
    ...NeoShadow.default,
  },
  tableCardDisabled: {
    opacity: 0.5,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  assignedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  assignedText: {
    fontSize: 8,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  unassignedText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.3,
    marginTop: 4,
  },
})
