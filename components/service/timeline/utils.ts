import type { Reservation, SeatingSettings, TableWithStatus } from '@/lib/types'
import type { TimelineBarLayout, TimelineTableLayout } from './types'
import {
  SERVICE_START_HOUR,
  SERVICE_END_HOUR,
  BAR_MIN_HEIGHT,
  LANE_GAP,
  ROW_PADDING,
  ROW_MIN_HEIGHT,
} from './constants'

/**
 * Convert "HH:MM" time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert minutes since midnight to "HH:MM" string
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Format hour for display (e.g., 14 -> "2p", 10 -> "10a")
 */
export function formatHour(hour: number): string {
  const h12 = hour % 12 || 12
  const ampm = hour >= 12 ? 'p' : 'a'
  return `${h12}${ampm}`
}

/**
 * Format time for display (e.g., "14:30" -> "2:30pm")
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${minutes}${ampm}`
}

/**
 * Clamp a number between min and max
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Get turn time for a party size from seating settings
 */
export function getTurnTimeForPartySize(
  partySize: number,
  settings: SeatingSettings
): number {
  if (partySize <= 2) return settings.turnTime2Top
  if (partySize <= 4) return settings.turnTime4Top
  if (partySize <= 6) return settings.turnTime6Top
  return settings.turnTimeLarge
}

/**
 * Get reservation duration in minutes.
 * Uses expected_turn_time if available, otherwise calculates from settings.
 */
export function getReservationDuration(
  reservation: Reservation,
  settings: SeatingSettings
): number {
  // Use expected_turn_time from API if available (already accounts for zone settings)
  if (reservation.expected_turn_time) {
    return reservation.expected_turn_time
  }
  // Fall back to calculating from party size
  return getTurnTimeForPartySize(reservation.covers, settings)
}

/**
 * Convert ISO timestamp to minutes in local day
 */
function timestampToMinutesInLocalDay(ts: string): number | null {
  const d = new Date(ts)
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Get the end minutes for a reservation, accounting for status
 */
export function getReservationEndMinutes(
  reservation: Reservation,
  settings: SeatingSettings
): number {
  const start = timeToMinutes(reservation.time)
  const expectedEnd = start + getReservationDuration(reservation, settings)

  // Cancelled and no-show reservations show as short bars
  if (reservation.status === 'CANCELLED') {
    return start + 15
  }
  if (reservation.status === 'NO_SHOW') {
    return start + 15
  }

  // Completed reservations use actual completion time (clamped)
  if (reservation.status === 'COMPLETED' && reservation.completed_at) {
    const completedMinutes = timestampToMinutesInLocalDay(reservation.completed_at)
    if (completedMinutes !== null) {
      return clamp(completedMinutes, start + 10, expectedEnd)
    }
  }

  return expectedEnd
}

/**
 * Convert minutes to percentage position within service hours
 */
export function minutesToPercent(
  minutes: number,
  startHour: number = SERVICE_START_HOUR,
  endHour: number = SERVICE_END_HOUR
): number {
  const serviceStartMinutes = startHour * 60
  const totalServiceMinutes = (endHour - startHour) * 60
  return ((minutes - serviceStartMinutes) / totalServiceMinutes) * 100
}

/**
 * Group reservations by table, including "Unassigned" group
 */
export function groupReservationsByTable(
  reservations: Reservation[],
  tables: TableWithStatus[]
): Map<string, Reservation[]> {
  const groups = new Map<string, Reservation[]>()

  // Initialize groups for all tables
  for (const table of tables) {
    groups.set(table.table_number, [])
  }
  groups.set('Unassigned', [])

  // Assign reservations to tables
  for (const res of reservations) {
    const tableNumbers = res.table_numbers || []
    if (tableNumbers.length === 0) {
      const unassigned = groups.get('Unassigned') || []
      unassigned.push(res)
      groups.set('Unassigned', unassigned)
    } else {
      // Add to each assigned table
      for (const tableNum of tableNumbers) {
        const existing = groups.get(tableNum) || []
        existing.push(res)
        groups.set(tableNum, existing)
      }
    }
  }

  return groups
}

/**
 * Detect conflicts (overlapping reservations) within a list
 */
export function detectConflicts(
  reservations: Reservation[],
  settings: SeatingSettings
): Set<number> {
  const conflicts = new Set<number>()

  for (let i = 0; i < reservations.length; i++) {
    const r1 = reservations[i]
    const s1 = timeToMinutes(r1.time)
    const e1 = getReservationEndMinutes(r1, settings)

    for (let j = i + 1; j < reservations.length; j++) {
      const r2 = reservations[j]
      const s2 = timeToMinutes(r2.time)
      const e2 = getReservationEndMinutes(r2, settings)

      // Check for overlap
      if (s1 < e2 && s2 < e1) {
        conflicts.add(r1.id)
        conflicts.add(r2.id)
      }
    }
  }

  return conflicts
}

/**
 * Assign lanes to reservations using greedy interval graph coloring.
 * This prevents visual overlap of bars in the same table row.
 */
export function assignLanes(
  reservations: Reservation[],
  settings: SeatingSettings,
  serviceStartHour: number = SERVICE_START_HOUR,
  serviceEndHour: number = SERVICE_END_HOUR
): TimelineBarLayout[] {
  if (reservations.length === 0) return []

  // Prepare items with timing
  const items = reservations.map((res) => {
    const startMinutes = timeToMinutes(res.time)
    const endMinutes = getReservationEndMinutes(res, settings)
    return { res, startMinutes, endMinutes }
  })

  // Sort by start time, then end time
  items.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)

  // Detect conflicts first
  const conflicts = detectConflicts(reservations, settings)

  // Greedy lane assignment
  const laneEnds: number[] = []

  return items.map((item) => {
    // Find first lane where this reservation can fit
    let laneIndex = laneEnds.findIndex((end) => end <= item.startMinutes)

    if (laneIndex === -1) {
      // No existing lane available, create new one
      laneIndex = laneEnds.length
      laneEnds.push(item.endMinutes)
    } else {
      // Use existing lane
      laneEnds[laneIndex] = item.endMinutes
    }

    // Calculate position as percentage
    const startPercent = minutesToPercent(item.startMinutes, serviceStartHour, serviceEndHour)
    const durationMinutes = item.endMinutes - item.startMinutes
    const totalMinutes = (serviceEndHour - serviceStartHour) * 60
    const widthPercent = (durationMinutes / totalMinutes) * 100

    return {
      reservation: item.res,
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      startPercent,
      widthPercent,
      laneIndex,
      isConflict: conflicts.has(item.res.id),
    }
  })
}

/**
 * Build complete layout for all table rows
 */
export function buildTableLayouts(
  reservations: Reservation[],
  tables: TableWithStatus[],
  settings: SeatingSettings,
  serviceStartHour: number = SERVICE_START_HOUR,
  serviceEndHour: number = SERVICE_END_HOUR
): TimelineTableLayout[] {
  const groups = groupReservationsByTable(reservations, tables)

  const layouts: TimelineTableLayout[] = []

  // Sort entries: tables first (by table number), then Unassigned last
  const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === 'Unassigned') return 1
    if (b[0] === 'Unassigned') return -1
    return a[0].localeCompare(b[0], undefined, { numeric: true })
  })

  for (const [tableKey, tableReservations] of sortedEntries) {
    // Skip empty rows (except Unassigned if it has items)
    if (tableReservations.length === 0 && tableKey !== 'Unassigned') {
      // Still include the table row even if empty for consistent layout
    }

    const bars = assignLanes(tableReservations, settings, serviceStartHour, serviceEndHour)
    const laneCount = Math.max(1, bars.length > 0 ? Math.max(...bars.map((b) => b.laneIndex)) + 1 : 1)

    // Calculate row height based on lane count
    const rowHeight = Math.max(
      ROW_MIN_HEIGHT,
      ROW_PADDING * 2 + laneCount * BAR_MIN_HEIGHT + (laneCount - 1) * LANE_GAP
    )

    const hasConflicts = bars.some((b) => b.isConflict)
    const table = tables.find((t) => t.table_number === tableKey) || null

    layouts.push({
      tableKey,
      table,
      bars,
      laneCount,
      rowHeight,
      hasConflicts,
    })
  }

  return layouts
}

/**
 * Get current time in minutes since midnight
 */
export function getCurrentTimeMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Generate hour labels for timeline header
 */
export function generateHourLabels(
  startHour: number = SERVICE_START_HOUR,
  endHour: number = SERVICE_END_HOUR
): { hour: number; label: string; percent: number }[] {
  const labels: { hour: number; label: string; percent: number }[] = []
  const totalHours = endHour - startHour

  for (let hour = startHour; hour <= endHour; hour++) {
    const percent = ((hour - startHour) / totalHours) * 100
    labels.push({
      hour,
      label: formatHour(hour),
      percent,
    })
  }

  return labels
}
