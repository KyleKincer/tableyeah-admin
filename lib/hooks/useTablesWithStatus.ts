import { useMemo } from 'react'
import { addMinutes, parseISO, format } from 'date-fns'
import { useTables, useReservations } from '@/lib/api/queries'
import type { TableInfo, TableWithStatus, TableStatus, Reservation } from '@/lib/types'

/**
 * Compute table statuses based on current reservations.
 * This mirrors the web app's getTablesWithStatus logic.
 */
function computeTableStatuses(
  tables: TableInfo[],
  reservations: Reservation[],
  currentTime: Date
): TableWithStatus[] {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()

  // Parse time string to minutes since midnight
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Default turn time in minutes
  const DEFAULT_TURN_TIME = 75

  return tables.map((table) => {
    // Find reservations for this table
    const tableReservations = reservations.filter((r) =>
      r.table_ids?.includes(table.id)
    )

    // Find seated reservation (current)
    const seatedRes = tableReservations.find((r) => r.status === 'SEATED')
    if (seatedRes) {
      return {
        ...table,
        status: 'seated' as TableStatus,
        currentReservation: {
          id: seatedRes.id,
          name: seatedRes.name,
          covers: seatedRes.covers,
          time: seatedRes.time,
          notes: seatedRes.notes || null,
          seatedAt: seatedRes.seated_at || null,
          status: seatedRes.status,
        },
      }
    }

    // Find upcoming reservations (within next 30 minutes or past due but not seated)
    const upcomingWindow = 30 // minutes
    const upcomingRes = tableReservations.filter((r) => {
      if (!['BOOKED', 'CONFIRMED'].includes(r.status)) return false
      const resMinutes = timeToMinutes(r.time)
      // Consider upcoming if within 30 minutes ahead or up to 15 minutes late
      return resMinutes >= currentMinutes - 15 && resMinutes <= currentMinutes + upcomingWindow
    })

    if (upcomingRes.length > 0) {
      const nextRes = upcomingRes.sort((a, b) => a.time.localeCompare(b.time))[0]
      return {
        ...table,
        status: 'upcoming' as TableStatus,
        currentReservation: {
          id: nextRes.id,
          name: nextRes.name,
          covers: nextRes.covers,
          time: nextRes.time,
          notes: nextRes.notes || null,
          seatedAt: null,
          status: nextRes.status,
        },
        upcomingReservations: upcomingRes.map((r) => ({
          id: r.id,
          name: r.name,
          covers: r.covers,
          time: r.time,
          notes: r.notes || null,
        })),
      }
    }

    // Find any other booked/confirmed reservations later today
    const futureRes = tableReservations.filter((r) => {
      if (!['BOOKED', 'CONFIRMED'].includes(r.status)) return false
      const resMinutes = timeToMinutes(r.time)
      return resMinutes > currentMinutes + upcomingWindow
    })

    if (futureRes.length > 0) {
      return {
        ...table,
        status: 'available' as TableStatus,
        upcomingReservations: futureRes.map((r) => ({
          id: r.id,
          name: r.name,
          covers: r.covers,
          time: r.time,
          notes: r.notes || null,
        })),
      }
    }

    // Table is available
    return {
      ...table,
      status: 'available' as TableStatus,
    }
  })
}

interface UseTablesWithStatusResult {
  tables: TableWithStatus[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to get tables with their current service status.
 * Combines table data with reservation data to compute statuses.
 */
export function useTablesWithStatus(date: string): UseTablesWithStatusResult {
  const {
    data: tablesData,
    isLoading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useTables()

  const {
    data: reservationsData,
    isLoading: reservationsLoading,
    error: reservationsError,
    refetch: refetchReservations,
  } = useReservations(date)

  const tablesWithStatus = useMemo(() => {
    if (!tablesData?.tables || !reservationsData?.reservations) {
      return []
    }

    return computeTableStatuses(
      tablesData.tables,
      reservationsData.reservations,
      new Date()
    )
  }, [tablesData?.tables, reservationsData?.reservations])

  const refetch = async () => {
    await Promise.all([refetchTables(), refetchReservations()])
  }

  return {
    tables: tablesWithStatus,
    isLoading: tablesLoading || reservationsLoading,
    error: tablesError || reservationsError || null,
    refetch,
  }
}
