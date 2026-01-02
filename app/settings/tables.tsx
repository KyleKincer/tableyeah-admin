import { useState, useMemo, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow, getContrastText } from '@/constants/theme'
import { useTables, useZonesData } from '@/lib/api/queries'
import { useCreateTable, useUpdateTable, useDeleteTable } from '@/lib/api/mutations'
import type { TableInfo, TableShape, Zone } from '@/lib/types'

const TABLE_SHAPES: { value: TableShape; label: string }[] = [
  { value: 'RECTANGLE', label: 'Rectangle' },
  { value: 'SQUARE', label: 'Square' },
  { value: 'CIRCLE', label: 'Circle' },
  { value: 'OVAL', label: 'Oval' },
  { value: 'BAR', label: 'Bar' },
]

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
      onPress={(e) => {
        e.stopPropagation()
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

function ShapeIcon({ shape, size = 24 }: { shape: TableShape; size?: number }) {
  const iconStyle = {
    width: size,
    height: size,
    backgroundColor: Neo.black,
  }

  switch (shape) {
    case 'CIRCLE':
      return <View style={[iconStyle, { borderRadius: size / 2 }]} />
    case 'OVAL':
      return <View style={[iconStyle, { width: size * 1.4, borderRadius: size / 2 }]} />
    case 'SQUARE':
      return <View style={iconStyle} />
    case 'BAR':
      return <View style={[iconStyle, { width: size * 2, height: size * 0.5 }]} />
    case 'RECTANGLE':
    default:
      return <View style={[iconStyle, { width: size * 1.3 }]} />
  }
}

function TableRow({
  table,
  zoneColor,
  onEdit,
  onToggleActive,
}: {
  table: TableInfo
  zoneColor: string
  onEdit: () => void
  onToggleActive: (active: boolean) => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[styles.tableRow, pressed && styles.tableRowPressed]}
      onPress={onEdit}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`Table ${table.table_number}, capacity ${table.min_capacity}-${table.max_capacity}. ${table.active ? 'Active' : 'Inactive'}. Tap to edit`}
      accessibilityRole="button"
    >
      <View style={[styles.colorStripe, { backgroundColor: zoneColor }]} />
      <View style={styles.tableIcon}>
        <ShapeIcon shape={table.shape} size={20} />
      </View>
      <View style={styles.tableInfo}>
        <Text style={[styles.tableNumber, !table.active && styles.tableNumberInactive]}>
          {table.table_number}
        </Text>
        <Text style={styles.tableCapacity}>
          {table.min_capacity}–{table.max_capacity} guests
        </Text>
      </View>
      <View style={styles.toggleContainer}>
        <NeoToggle value={table.active} onToggle={onToggleActive} />
      </View>
    </Pressable>
  )
}

function ZonePicker({
  zones,
  selectedZoneId,
  onSelect,
}: {
  zones: Zone[]
  selectedZoneId: number | null
  onSelect: (zoneId: number) => void
}) {
  return (
    <View style={styles.zonePicker}>
      {zones.map((zone) => {
        const isSelected = zone.id === selectedZoneId
        const textColor = isSelected ? getContrastText(zone.color) : Neo.black
        return (
          <Pressable
            key={zone.id}
            style={[
              styles.zoneOption,
              isSelected && { backgroundColor: zone.color },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(zone.id)
            }}
          >
            <Text style={[styles.zoneOptionText, { color: textColor }]}>
              {zone.emoji ? `${zone.emoji} ` : ''}{zone.displayName}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ShapePicker({
  selectedShape,
  onSelect,
}: {
  selectedShape: TableShape
  onSelect: (shape: TableShape) => void
}) {
  return (
    <View style={styles.shapePicker}>
      {TABLE_SHAPES.map(({ value, label }) => {
        const isSelected = value === selectedShape
        return (
          <Pressable
            key={value}
            style={[styles.shapeOption, isSelected && styles.shapeOptionSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(value)
            }}
          >
            <ShapeIcon shape={value} size={18} />
            <Text style={[styles.shapeOptionText, isSelected && styles.shapeOptionTextSelected]}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

interface TableFormData {
  tableNumber: string
  minCapacity: string
  maxCapacity: string
  zoneId: number | null
  shape: TableShape
}

function TableModal({
  visible,
  onClose,
  table,
  zones,
  onSave,
  onDelete,
  isLoading,
}: {
  visible: boolean
  onClose: () => void
  table: TableInfo | null
  zones: Zone[]
  onSave: (data: TableFormData) => void
  onDelete?: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<TableFormData>({
    tableNumber: table?.table_number || '',
    minCapacity: table?.min_capacity?.toString() || '1',
    maxCapacity: table?.max_capacity?.toString() || '4',
    zoneId: table?.zone_id || (zones.length > 0 ? zones[0].id : null),
    shape: table?.shape || 'RECTANGLE',
  })

  // Reset form when table changes
  useState(() => {
    if (visible) {
      setFormData({
        tableNumber: table?.table_number || '',
        minCapacity: table?.min_capacity?.toString() || '1',
        maxCapacity: table?.max_capacity?.toString() || '4',
        zoneId: table?.zone_id || (zones.length > 0 ? zones[0].id : null),
        shape: table?.shape || 'RECTANGLE',
      })
    }
  })

  const handleSave = () => {
    if (!formData.tableNumber.trim()) {
      Alert.alert('Error', 'Please enter a table number')
      return
    }
    if (!formData.zoneId) {
      Alert.alert('Error', 'Please select a zone')
      return
    }
    onSave(formData)
  }

  const isEditing = !!table

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{isEditing ? 'EDIT TABLE' : 'ADD TABLE'}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TABLE NUMBER</Text>
            <TextInput
              style={styles.textInput}
              value={formData.tableNumber}
              onChangeText={(v) => setFormData({ ...formData, tableNumber: v })}
              placeholder="e.g., T1, Bar 3"
              placeholderTextColor={Neo.black + '40'}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>MIN CAPACITY</Text>
              <TextInput
                style={styles.textInput}
                value={formData.minCapacity}
                onChangeText={(v) => setFormData({ ...formData, minCapacity: v })}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={Neo.black + '40'}
              />
            </View>
            <View style={styles.inputSpacer} />
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>MAX CAPACITY</Text>
              <TextInput
                style={styles.textInput}
                value={formData.maxCapacity}
                onChangeText={(v) => setFormData({ ...formData, maxCapacity: v })}
                keyboardType="number-pad"
                placeholder="4"
                placeholderTextColor={Neo.black + '40'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ZONE</Text>
            <ZonePicker
              zones={zones}
              selectedZoneId={formData.zoneId}
              onSelect={(zoneId) => setFormData({ ...formData, zoneId })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SHAPE</Text>
            <ShapePicker
              selectedShape={formData.shape}
              onSelect={(shape) => setFormData({ ...formData, shape })}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary, NeoShadow.sm]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonPrimary, NeoShadow.sm]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Neo.black} />
              ) : (
                <Text style={styles.modalButtonText}>{isEditing ? 'SAVE' : 'ADD'}</Text>
              )}
            </Pressable>
          </View>

          {isEditing && onDelete && (
            <Pressable
              style={styles.deleteButton}
              onPress={onDelete}
            >
              <Text style={styles.deleteButtonText}>DELETE TABLE</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// Exported content component for use in split view
export function TablesSettingsContent() {
  const { data: tablesData, isLoading: isLoadingTables, refetch: refetchTables, isRefetching } = useTables()
  const { data: zonesData, isLoading: isLoadingZones } = useZonesData()

  const createTable = useCreateTable()
  const updateTable = useUpdateTable()
  const deleteTable = useDeleteTable()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingTable, setEditingTable] = useState<TableInfo | null>(null)

  const zones = zonesData?.zones || []
  const tables = tablesData?.tables || []

  // Group tables by zone
  const sections = useMemo(() => {
    const zoneMap = new Map<number, { zone: Zone; tables: TableInfo[] }>()

    // Initialize with all zones
    for (const zone of zones) {
      zoneMap.set(zone.id, { zone, tables: [] })
    }

    // Add tables to their zones
    for (const table of tables) {
      const zoneData = zoneMap.get(table.zone_id)
      if (zoneData) {
        zoneData.tables.push(table)
      }
    }

    // Convert to section list format, filtering empty zones
    return Array.from(zoneMap.values())
      .filter((z) => z.tables.length > 0)
      .sort((a, b) => a.zone.sortOrder - b.zone.sortOrder)
      .map((z) => ({
        title: z.zone.displayName,
        color: z.zone.color,
        emoji: z.zone.emoji,
        data: z.tables.sort((a, b) => a.table_number.localeCompare(b.table_number)),
      }))
  }, [zones, tables])

  const handleOpenModal = (table: TableInfo | null = null) => {
    setEditingTable(table)
    setModalVisible(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingTable(null)
  }

  const handleSave = async (formData: TableFormData) => {
    const minCap = parseInt(formData.minCapacity, 10) || 1
    const maxCap = parseInt(formData.maxCapacity, 10) || 4

    if (minCap > maxCap) {
      Alert.alert('Error', 'Minimum capacity cannot be greater than maximum capacity')
      return
    }

    try {
      if (editingTable) {
        await updateTable.mutateAsync({
          id: editingTable.id,
          tableNumber: formData.tableNumber,
          minCapacity: minCap,
          maxCapacity: maxCap,
          zoneId: formData.zoneId!,
          shape: formData.shape,
        })
      } else {
        await createTable.mutateAsync({
          tableNumber: formData.tableNumber,
          minCapacity: minCap,
          maxCapacity: maxCap,
          zoneId: formData.zoneId!,
          shape: formData.shape,
        })
      }
      handleCloseModal()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('Error', 'Failed to save table')
    }
  }

  const handleToggleActive = async (table: TableInfo, active: boolean) => {
    try {
      await updateTable.mutateAsync({ id: table.id, active })
    } catch {
      Alert.alert('Error', 'Failed to update table')
    }
  }

  const handleDelete = () => {
    if (!editingTable) return

    Alert.alert(
      'Delete Table',
      `Are you sure you want to delete table "${editingTable.table_number}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTable.mutateAsync(editingTable.id)
              handleCloseModal()
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch {
              Alert.alert('Error', 'Failed to delete table')
            }
          },
        },
      ]
    )
  }

  if (isLoadingTables || isLoadingZones) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Neo.black} />
      </View>
    )
  }

  return (
    <View style={styles.contentContainer}>
      {zones.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>NO ZONES</Text>
          <Text style={styles.emptyStateText}>
            Create zones first to organize your tables.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, section }) => (
            <TableRow
              table={item}
              zoneColor={section.color}
              onEdit={() => handleOpenModal(item)}
              onToggleActive={(active) => handleToggleActive(item, active)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionColorDot, { backgroundColor: section.color }]} />
              <Text style={styles.sectionTitle}>
                {section.emoji ? `${section.emoji} ` : ''}{section.title.toUpperCase()}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchTables}
              tintColor={Neo.black}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>NO TABLES</Text>
              <Text style={styles.emptyStateText}>
                Tap the + button to add your first table.
              </Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      {zones.length > 0 && (
        <Pressable
          style={[styles.fab, NeoShadow.default]}
          onPress={() => handleOpenModal(null)}
          accessibilityLabel="Add table"
          accessibilityRole="button"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}

      <TableModal
        visible={modalVisible}
        onClose={handleCloseModal}
        table={editingTable}
        zones={zones}
        onSave={handleSave}
        onDelete={editingTable ? handleDelete : undefined}
        isLoading={createTable.isPending || updateTable.isPending}
      />
    </View>
  )
}

// Screen wrapper for standalone navigation
export default function TablesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TablesSettingsContent />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  sectionColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 0,
  },
  tableRowPressed: {
    backgroundColor: Neo.yellow,
  },
  colorStripe: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tableIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 12,
  },
  tableInfo: {
    flex: 1,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Neo.black,
    marginBottom: 2,
  },
  tableNumberInactive: {
    color: Neo.black + '50',
  },
  tableCapacity: {
    fontSize: 12,
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toggleContainer: {
    marginLeft: 12,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Neo.black + '60',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 32,
    fontWeight: '700',
    color: Neo.black,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.lg,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    marginBottom: 20,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputSpacer: {
    width: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Neo.black,
    marginBottom: 6,
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
  },
  zonePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
  },
  zoneOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  shapePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shapeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    backgroundColor: Neo.white,
    gap: 6,
  },
  shapeOptionSelected: {
    backgroundColor: Neo.yellow,
  },
  shapeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Neo.black,
  },
  shapeOptionTextSelected: {
    fontWeight: '800',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: Neo.white,
  },
  modalButtonPrimary: {
    backgroundColor: Neo.lime,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
  },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.pink,
  },
})
