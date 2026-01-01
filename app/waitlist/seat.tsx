import { format } from 'date-fns'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useAvailableTables } from '@/lib/api/queries'
import { useSeatWaitlistEntry } from '@/lib/api/mutations'
import type { AvailableTable } from '@/lib/types'

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function TablePicker({
  tables,
  selectedTableId,
  onSelectTable,
  isLoading,
}: {
  tables: AvailableTable[]
  selectedTableId: number | null
  onSelectTable: (tableId: number) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Neo.black} />
        <Text style={styles.loadingText}>Loading tables...</Text>
      </View>
    )
  }

  if (tables.length === 0) {
    return (
      <View style={styles.emptySlots}>
        <Text style={styles.emptySlotsText}>No tables available</Text>
      </View>
    )
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
    <View style={styles.tablesContainer}>
      {Object.entries(tablesByZone).map(([zone, zoneTables]) => (
        <View key={zone}>
          <Text style={styles.zoneLabel}>{zone.toUpperCase()}</Text>
          <View style={styles.tablesGrid}>
            {zoneTables.map((table) => {
              const isSelected = selectedTableId === table.id
              return (
                <Pressable
                  key={table.id}
                  style={[styles.tableButton, isSelected && styles.tableButtonSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSelectTable(table.id)
                  }}
                  accessibilityLabel={`Table ${table.table_number}, capacity ${table.min_capacity} to ${table.max_capacity}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Text
                    style={[styles.tableNumber, isSelected && styles.tableNumberSelected]}
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
      ))}
    </View>
  )
}

function NeoButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      style={[
        styles.actionButton,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Neo.black} size="small" />
      ) : (
        <Text style={styles.actionButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export default function SeatFromWaitlistScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    uuid: string
    name: string
    covers: string
    date: string
  }>()

  const uuid = params.uuid || ''
  const name = params.name || 'Guest'
  const covers = parseInt(params.covers || '2', 10)
  const date = params.date || format(new Date(), 'yyyy-MM-dd')

  // Current time for seating
  const now = new Date()
  const currentTime = format(now, 'HH:mm')

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)

  // Fetch available tables
  const { data: tablesData, isLoading: isLoadingTables } = useAvailableTables(
    date,
    currentTime,
    covers
  )

  // Mutation
  const seatMutation = useSeatWaitlistEntry()

  const tables = tablesData?.tables || []

  const canSubmit = selectedTableId !== null

  const handleSubmit = () => {
    if (!canSubmit || !selectedTableId) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    seatMutation.mutate(
      {
        uuid,
        tableId: selectedTableId,
        date,
        time: currentTime,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.back()
        },
        onError: () => {
          Alert.alert('Error', 'Failed to seat guest')
        },
      }
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Guest Info Header */}
        <View style={styles.guestHeader}>
          <Text style={styles.guestName}>{name.toUpperCase()}</Text>
          <Text style={styles.guestMeta}>
            {covers} {covers === 1 ? 'guest' : 'guests'} · {format(now, 'h:mm a')}
          </Text>
        </View>

        {/* Table Selection */}
        <SectionHeader title="SELECT A TABLE" />
        <TablePicker
          tables={tables}
          selectedTableId={selectedTableId}
          onSelectTable={setSelectedTableId}
          isLoading={isLoadingTables}
        />

        {/* Submit */}
        <View style={styles.submitContainer}>
          <NeoButton
            label="SEAT GUEST"
            onPress={handleSubmit}
            disabled={!canSubmit || seatMutation.isPending}
            loading={seatMutation.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  guestHeader: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 20,
    alignItems: 'center',
    ...NeoShadow.default,
  },
  guestName: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -0.5,
  },
  guestMeta: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
    opacity: 0.8,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
  },
  loadingText: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptySlots: {
    padding: 24,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    alignItems: 'center',
  },
  emptySlotsText: {
    fontSize: 12,
    color: Neo.black,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tablesContainer: {
    gap: 16,
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
    width: 72,
    height: 72,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableButtonSelected: {
    backgroundColor: Neo.cyan,
    borderWidth: NeoBorder.default,
    ...NeoShadow.sm,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableNumberSelected: {
    fontWeight: '900',
  },
  tableCapacity: {
    fontSize: 11,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
    marginTop: 4,
  },
  tableCapacitySelected: {
    opacity: 1,
  },
  submitContainer: {
    marginTop: 32,
  },
  actionButton: {
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...NeoShadow.sm,
  },
  actionButtonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Neo.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
