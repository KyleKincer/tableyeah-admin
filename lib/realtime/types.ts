/**
 * Realtime event type definitions
 * These match the backend schema from /tableyeah/lib/realtime.ts
 */

// Event payload types
export interface ReservationCreatedPayload {
  id: number
  uuid: string
  time: string
  covers: number
  guestName: string
  status: string
  tableIds?: number[]
}

export interface ReservationUpdatedPayload {
  id: number
  uuid: string
}

export interface ReservationStatusChangedPayload {
  id: number
  uuid: string
  previousStatus: string
  newStatus: string
  tableIds?: number[]
}

export interface ReservationTableAssignedPayload {
  id: number
  uuid: string
  tableIds: number[]
}

export interface WaitlistCreatedPayload {
  uuid: string
  guestName: string
  covers: number
  estimatedWait?: number
}

export interface WaitlistUpdatedPayload {
  uuid: string
  status?: string
}

export interface WaitlistSeatedPayload {
  uuid: string
  reservationId?: number
}

export interface ServerAssignmentsChangedPayload {
  date: string
}

export interface ServerListChangedPayload {
  action: 'created' | 'updated' | 'deleted'
  serverId: number
}

export interface GuestUpdatedPayload {
  id: number
}

// Map of event names to their payload types
export interface RealtimeEventMap {
  'reservation.created': ReservationCreatedPayload
  'reservation.updated': ReservationUpdatedPayload
  'reservation.statusChanged': ReservationStatusChangedPayload
  'reservation.tableAssigned': ReservationTableAssignedPayload
  'waitlist.created': WaitlistCreatedPayload
  'waitlist.updated': WaitlistUpdatedPayload
  'waitlist.seated': WaitlistSeatedPayload
  'server.assignmentsChanged': ServerAssignmentsChangedPayload
  'server.listChanged': ServerListChangedPayload
  'guest.updated': GuestUpdatedPayload
}

export type RealtimeEventName = keyof RealtimeEventMap

// SSE message format from the backend
export interface RealtimeMessage<E extends RealtimeEventName = RealtimeEventName> {
  id: string
  event: E
  data: RealtimeEventMap[E]
  channel: string
}

// Connection status
export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

// Callback types
export type RealtimeEventCallback<E extends RealtimeEventName = RealtimeEventName> = (
  payload: RealtimeMessage<E>
) => void
