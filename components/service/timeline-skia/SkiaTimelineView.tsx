import { useMemo, useState, useEffect, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import { Neo } from '@/constants/theme'
import type { Reservation, TableWithStatus, SeatingSettings } from '@/lib/types'
import { useOccupancyTimeline } from '@/lib/api/queries'
import { useReassignReservationTable, useUpdateReservation } from '@/lib/api/mutations'

import { SkiaTimelineCanvas } from './SkiaTimelineCanvas'
import { buildTableLayouts, getCurrentTimeMinutes } from '../timeline/utils'
import type { TimelineViewProps } from './types'
import { SERVICE_START_HOUR, SERVICE_END_HOUR } from './constants'

// Default seating settings fallback
const DEFAULT_SEATING_SETTINGS: SeatingSettings = {
  turnTime2Top: 75,
  turnTime4Top: 90,
  turnTime6Top: 105,
  turnTimeLarge: 120,
  maxPartySizePublic: 12,
  allowMultiTablePublic: false,
}

// Error display duration in ms
const ERROR_DISPLAY_DURATION = 4000

// Pending change for optimistic updates
interface PendingChange {
  reservationId: number
  tableId?: number
  // We're not doing time changes for now, keeping it simple
}

export function SkiaTimelineView({
  date,
  reservations,
  tables,
  seatingSettings,
  isLiveMode,
  selectedReservationId,
  onReservationPress,
  onReservationDragComplete,
}: TimelineViewProps) {
  // Use provided settings or defaults
  const settings = seatingSettings || DEFAULT_SEATING_SETTINGS

  // Current time (updates every minute in live mode)
  const [nowMinutes, setNowMinutes] = useState(getCurrentTimeMinutes)

  // Saving and error state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Pending optimistic change - applied immediately to UI
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)

  // Query client for cache updates
  const queryClient = useQueryClient()

  // Mutations
  const reassignTableMutation = useReassignReservationTable()

  useEffect(() => {
    if (!isLiveMode) return

    // Update every minute
    const interval = setInterval(() => {
      setNowMinutes(getCurrentTimeMinutes())
    }, 60000)

    return () => clearInterval(interval)
  }, [isLiveMode])

  // Clear error after timeout
  useEffect(() => {
    if (saveError) {
      const timeout = setTimeout(() => {
        setSaveError(null)
      }, ERROR_DISPLAY_DURATION)
      return () => clearTimeout(timeout)
    }
  }, [saveError])

  // Clear pending change when reservations prop updates with the change
  useEffect(() => {
    if (pendingChange) {
      const reservation = reservations.find((r) => r.id === pendingChange.reservationId)
      if (reservation && pendingChange.tableId) {
        // Check if the server data now reflects our pending change
        if (reservation.table_ids?.includes(pendingChange.tableId)) {
          setPendingChange(null)
        }
      }
    }
  }, [reservations, pendingChange])

  // Fetch occupancy data
  const { data: occupancyData } = useOccupancyTimeline(date, true)

  // Apply pending changes to reservations for immediate UI update
  const effectiveReservations = useMemo(() => {
    if (!pendingChange) return reservations

    return reservations.map((r) => {
      if (r.id !== pendingChange.reservationId) return r
      return {
        ...r,
        table_ids: pendingChange.tableId ? [pendingChange.tableId] : r.table_ids,
      }
    })
  }, [reservations, pendingChange])

  // Build table layouts with lane assignments using effective reservations
  const layouts = useMemo(
    () => buildTableLayouts(effectiveReservations, tables, settings, SERVICE_START_HOUR, SERVICE_END_HOUR),
    [effectiveReservations, tables, settings]
  )

  // Handle drag completion (table reassignment)
  const handleDragEnd = useCallback(
    async (reservationId: number, tableId: number, newTime?: string) => {
      // Find the reservation being moved
      const reservation = reservations.find((r) => r.id === reservationId)
      if (!reservation) return

      // Determine what's changing
      const currentTableIds = reservation.table_ids || []
      const isTableChange = !currentTableIds.includes(tableId)

      // Nothing to change (we're ignoring time changes for now)
      if (!isTableChange) return

      // Immediately apply optimistic update via local state
      setPendingChange({ reservationId, tableId })
      setIsSaving(true)
      setSaveError(null)

      // Give haptic feedback for optimistic update
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      try {
        // Perform the actual API call
        await reassignTableMutation.mutateAsync({
          reservationId,
          tableIds: [tableId],
        })

        // Also update the query cache so parent gets the update
        queryClient.setQueryData<{ reservations: Reservation[] }>(['reservations', date], (old) => {
          if (!old?.reservations) return old
          return {
            ...old,
            reservations: old.reservations.map((r) => {
              if (r.id !== reservationId) return r
              return {
                ...r,
                table_ids: [tableId],
              }
            }),
          }
        })

        // Call the legacy callback if provided
        if (onReservationDragComplete) {
          onReservationDragComplete(reservationId, tableId)
        }
      } catch (error) {
        // Revert optimistic update on error
        setPendingChange(null)

        // Show error feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setSaveError(
          error instanceof Error
            ? `Failed to update: ${error.message}`
            : 'Failed to update reservation'
        )
      } finally {
        setIsSaving(false)
      }
    },
    [
      reservations,
      date,
      queryClient,
      reassignTableMutation,
      onReservationDragComplete,
    ]
  )

  return (
    <View style={styles.container}>
      <SkiaTimelineCanvas
        layouts={layouts}
        serviceStartHour={SERVICE_START_HOUR}
        serviceEndHour={SERVICE_END_HOUR}
        nowMinutes={nowMinutes}
        showNowLine={isLiveMode}
        selectedReservationId={selectedReservationId}
        occupancySlots={occupancyData?.slots}
        totalCapacity={occupancyData?.totalCapacity}
        onReservationPress={onReservationPress}
        onDragEnd={handleDragEnd}
        isSaving={isSaving}
        saveError={saveError}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
})
