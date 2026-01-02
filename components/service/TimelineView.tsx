import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Neo } from '@/constants/theme'
import { useOccupancyTimeline } from '@/lib/api/queries'
import { TimelineHeader } from './TimelineHeader'
import { TimelineCanvas } from './TimelineCanvas'
import type { TimelineViewProps } from './timeline/types'
import {
  buildTableLayouts,
  getCurrentTimeMinutes,
} from './timeline/utils'
import {
  DEFAULT_ZOOM_INDEX,
  SERVICE_START_HOUR,
  SERVICE_END_HOUR,
} from './timeline/constants'

// Default seating settings if not provided
const DEFAULT_SEATING_SETTINGS = {
  turnTime2Top: 90,
  turnTime4Top: 120,
  turnTime6Top: 150,
  turnTimeLarge: 180,
  maxPartySizePublic: 8,
  allowMultiTablePublic: false,
}

export function TimelineView({
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

  // Fetch occupancy data for pacing graph
  const { data: occupancyData } = useOccupancyTimeline(date, isLiveMode)

  // Zoom state
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [scrollOffsetMinutes, setScrollOffsetMinutes] = useState(0)

  // Current time for NOW indicator
  const [nowMinutes, setNowMinutes] = useState(getCurrentTimeMinutes)

  // Update current time every minute when in live mode
  useEffect(() => {
    if (!isLiveMode) return

    const interval = setInterval(() => {
      setNowMinutes(getCurrentTimeMinutes())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [isLiveMode])

  // Build table layouts with memoization
  const layouts = useMemo(() => {
    // Filter to active reservations only (exclude cancelled/no-show for layout)
    const activeReservations = reservations.filter(
      (r) => !['CANCELLED', 'NO_SHOW'].includes(r.status) || r.status === 'NO_SHOW'
    )

    return buildTableLayouts(
      reservations,
      tables,
      settings,
      SERVICE_START_HOUR,
      SERVICE_END_HOUR
    )
  }, [reservations, tables, settings])

  // Stats for header
  const stats = useMemo(() => {
    const active = reservations.filter(
      (r) => !['CANCELLED', 'NO_SHOW'].includes(r.status)
    )
    const totalCovers = active.reduce((sum, r) => sum + r.covers, 0)
    return {
      totalReservations: active.length,
      totalCovers,
    }
  }, [reservations])

  // Scroll/zoom handlers (for future sync between canvas and graph)
  const handleScrollChange = useCallback((minutes: number) => {
    setScrollOffsetMinutes(minutes)
  }, [])

  const handleZoomChange = useCallback((index: number) => {
    setZoomIndex(index)
  }, [])

  // Drag handlers (for future implementation)
  const handleDragStart = useCallback((reservation: any) => {
    // Will be implemented with drag-and-drop
    console.log('Drag start:', reservation.id)
  }, [])

  const handleDragEnd = useCallback((tableId: number | null) => {
    // Will be implemented with drag-and-drop
    console.log('Drag end on table:', tableId)
  }, [])

  return (
    <View style={styles.container}>
      {/* Header with stats */}
      <TimelineHeader
        totalReservations={stats.totalReservations}
        totalCovers={stats.totalCovers}
        peakCovers={occupancyData?.peakCovers}
      />

      {/* Timeline canvas with integrated occupancy graph */}
      <TimelineCanvas
        layouts={layouts}
        serviceStartHour={SERVICE_START_HOUR}
        serviceEndHour={SERVICE_END_HOUR}
        zoomIndex={zoomIndex}
        scrollOffsetMinutes={scrollOffsetMinutes}
        nowMinutes={nowMinutes}
        showNowLine={isLiveMode}
        selectedReservationId={selectedReservationId}
        occupancySlots={occupancyData?.slots}
        onReservationPress={onReservationPress}
        onScrollChange={handleScrollChange}
        onZoomChange={handleZoomChange}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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
