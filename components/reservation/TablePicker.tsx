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
import { useState } from 'react'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useAvailableTables } from '@/lib/api/queries'
import type { AvailableTable } from '@/lib/types'

interface TablePickerModalProps {
  visible: boolean
  selectedTableIds: number[]
  date: string
  time: string
  partySize: number
  onSave: (tableIds: number[]) => void
  onClose: () => void
}

export function TablePickerModal({
  visible,
  selectedTableIds: initialSelectedIds,
  date,
  time,
  partySize,
  onSave,
  onClose,
}: TablePickerModalProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>(initialSelectedIds)
  const { data: tablesData, isLoading } = useAvailableTables(date, time, partySize)
  const tables = tablesData?.tables || []

  const handleToggleTable = (tableId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTableIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    )
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(selectedTableIds)
    onClose()
  }

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTableIds([])
  }

  // Group tables by zone
  const tablesByZone = tables.reduce(
    (acc, table) => {
      const zone = table.zone_display_name || 'Other'
      if (!acc[zone]) acc[zone] = []
      acc[zone].push(table)
      return acc
    },
    {} as Record<string, AvailableTable[]>
  )

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
            <Text style={styles.headerText}>SELECT TABLES</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Neo.black} />
                <Text style={styles.loadingText}>Loading tables...</Text>
              </View>
            ) : tables.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tables available</Text>
              </View>
            ) : (
              Object.entries(tablesByZone).map(([zone, zoneTables]) => (
                <View key={zone} style={styles.zoneSection}>
                  <Text style={styles.zoneLabel}>{zone.toUpperCase()}</Text>
                  <View style={styles.tablesGrid}>
                    {zoneTables.map((table) => {
                      const isSelected = selectedTableIds.includes(table.id)
                      return (
                        <Pressable
                          key={table.id}
                          style={[
                            styles.tableButton,
                            isSelected && styles.tableButtonSelected,
                          ]}
                          onPress={() => handleToggleTable(table.id)}
                          accessibilityLabel={`Table ${table.table_number}, seats ${table.min_capacity} to ${table.max_capacity}${isSelected ? ', selected' : ''}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <Text
                            style={[
                              styles.tableNumber,
                              isSelected && styles.tableNumberSelected,
                            ]}
                          >
                            {table.table_number}
                          </Text>
                          <Text
                            style={[
                              styles.tableCapacity,
                              isSelected && styles.tableCapacitySelected,
                            ]}
                          >
                            {table.min_capacity}-{table.max_capacity}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.clearButton}
              onPress={handleClear}
              accessibilityLabel="Clear table selection"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>CLEAR</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={handleSave}
              accessibilityLabel={`Save ${selectedTableIds.length} table${selectedTableIds.length !== 1 ? 's' : ''} selected`}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>
                SAVE{selectedTableIds.length > 0 ? ` (${selectedTableIds.length})` : ''}
              </Text>
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
    maxWidth: 400,
    maxHeight: '80%',
    ...NeoShadow.lg,
  },
  header: {
    padding: 16,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    backgroundColor: Neo.cyan,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  content: {
    padding: 16,
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
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  zoneSection: {
    marginBottom: 16,
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
    opacity: 0.6,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableButton: {
    width: 64,
    height: 64,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableButtonSelected: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableNumberSelected: {
    fontWeight: '900',
  },
  tableCapacity: {
    fontSize: 10,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    marginTop: 2,
  },
  tableCapacitySelected: {
    opacity: 1,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: NeoBorder.default,
    borderTopColor: Neo.black,
  },
  clearButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
  },
  clearButtonText: {
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
