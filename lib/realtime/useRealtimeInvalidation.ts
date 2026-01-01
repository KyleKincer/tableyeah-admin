import { useQueryClient } from '@tanstack/react-query'
import { useRealtime } from './useRealtime'
import type { RealtimeEventName, RealtimeEventMap } from './types'

// All events we want to subscribe to for cache invalidation
const ALL_EVENTS: RealtimeEventName[] = [
  'reservation.created',
  'reservation.updated',
  'reservation.statusChanged',
  'reservation.tableAssigned',
  'waitlist.created',
  'waitlist.updated',
  'waitlist.seated',
  'server.assignmentsChanged',
  'server.listChanged',
  'guest.updated',
]

/**
 * Hook that subscribes to all realtime events and invalidates
 * the appropriate React Query caches when events are received.
 *
 * Should be called once at the app level (e.g., in tabs layout).
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient()

  useRealtime({
    events: ALL_EVENTS,
    onData: (payload) => {
      const { event, data } = payload

      switch (event) {
        case 'reservation.created':
          // New reservation affects lists, activity, and dashboard stats
          queryClient.invalidateQueries({ queryKey: ['reservations'] })
          queryClient.invalidateQueries({ queryKey: ['activity'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          break

        case 'reservation.updated': {
          // Update affects specific reservation and lists
          const updateData = data as RealtimeEventMap['reservation.updated']
          queryClient.invalidateQueries({ queryKey: ['reservations'] })
          queryClient.invalidateQueries({ queryKey: ['reservation', updateData.id] })
          queryClient.invalidateQueries({ queryKey: ['activity'] })
          break
        }

        case 'reservation.statusChanged': {
          // Status change affects lists, specific reservation, activity, and dashboard
          const statusData = data as RealtimeEventMap['reservation.statusChanged']
          queryClient.invalidateQueries({ queryKey: ['reservations'] })
          queryClient.invalidateQueries({ queryKey: ['reservation', statusData.id] })
          queryClient.invalidateQueries({ queryKey: ['activity'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          break
        }

        case 'reservation.tableAssigned': {
          // Table assignment affects lists and specific reservation
          const tableData = data as RealtimeEventMap['reservation.tableAssigned']
          queryClient.invalidateQueries({ queryKey: ['reservations'] })
          queryClient.invalidateQueries({ queryKey: ['reservation', tableData.id] })
          break
        }

        case 'waitlist.created':
        case 'waitlist.updated':
          // Waitlist changes affect waitlist query
          queryClient.invalidateQueries({ queryKey: ['waitlist'] })
          break

        case 'waitlist.seated':
          // Seating from waitlist affects waitlist, reservations, and activity
          queryClient.invalidateQueries({ queryKey: ['waitlist'] })
          queryClient.invalidateQueries({ queryKey: ['reservations'] })
          queryClient.invalidateQueries({ queryKey: ['activity'] })
          break

        case 'server.assignmentsChanged':
        case 'server.listChanged':
          // Server changes not currently used in mobile app
          // But invalidate any potential server-related queries
          break

        case 'guest.updated': {
          // Guest update affects guest list and specific guest
          const guestData = data as RealtimeEventMap['guest.updated']
          queryClient.invalidateQueries({ queryKey: ['guests'] })
          queryClient.invalidateQueries({ queryKey: ['guest', guestData.id] })
          break
        }
      }
    },
  })
}
