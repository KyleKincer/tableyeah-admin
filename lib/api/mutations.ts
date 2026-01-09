import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './client'
import type {
  Reservation,
  GuestInfo,
  GuestDetailResponse,
  GuestTagOption,
  WaitlistStatus,
  Event,
  CreateEventData,
  UpdateEventData,
  CreateTimeslotData,
  UpdateTimeslotData,
  EventPaymentSettings,
  GeneralSettings,
  NotificationSettings,
  SeatingSettings,
  BlockedDate,
  TableInfo,
  TableShape,
  OperatingHour,
  Zone,
  ZoneGroup,
  ZoneBookingRules,
  ZonePacingRule,
  StaffRole,
  InviteStaffRequest,
  BrandingAssets,
  BrandingAssetType,
  // Commerce types
  FulfillmentStatus,
  Order,
  GiftCard,
  IssueGiftCardRequest,
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  ProductVariant,
  CreateVariantRequest,
  UpdateVariantRequest,
  AdjustInventoryRequest,
  ProductImage,
} from '../types'

export function useSeatReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'SEATED',
        seated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useCompleteReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useCancelReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'ADMIN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useMarkNoShow() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'NO_SHOW',
        no_show_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useConfirmReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'CONFIRMED',
        confirmed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservation'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useUnseatReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        status: 'CONFIRMED',
        seated_at: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservation'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

interface CreateReservationData {
  date: string
  time: string
  covers: number
  name: string
  email?: string
  phone?: string
  notes?: string
  tableIds?: number[]
  isWalkIn?: boolean
}

export function useCreateReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateReservationData) =>
      api.post<Reservation>('/api/admin/reservations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useCreateWalkIn() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { covers: number; name: string; tableIds?: number[] }) =>
      api.post<Reservation>('/api/admin/reservations', {
        ...data,
        isWalkIn: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

interface UpdateReservationData {
  id: number
  notes?: string
  admin_notes?: string
  tableIds?: number[]
  serverId?: number
  // Core booking fields
  name?: string
  email?: string | null
  phone?: string | null
  covers?: number
  date?: string        // YYYY-MM-DD format
  time?: string        // HH:mm format
}

export function useUpdateReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateReservationData) =>
      api.put<Reservation>(`/api/admin/reservations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservation'] })
    },
  })
}

interface UpdateGuestData {
  id: number
  name?: string
  phone?: string
  notes?: string
}

export function useUpdateGuest() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateGuestData) =>
      api.put<GuestInfo>(`/api/admin/guests/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guest', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useAddGuestTag() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ guestId, tagOptionId }: { guestId: number; tagOptionId: number }) =>
      api.post(`/api/admin/guests/${guestId}/tags`, { tagOptionId }),
    onMutate: async ({ guestId, tagOptionId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['guest', guestId] })

      // Snapshot the previous value
      const previousGuest = queryClient.getQueryData<GuestDetailResponse>(['guest', guestId])

      // Get tag option details from cache
      const tagOptions = queryClient.getQueryData<{ tags: GuestTagOption[] }>(['guest-tags'])
      const tagOption = tagOptions?.tags.find((t) => t.id === tagOptionId)

      // Optimistically update the cache
      if (previousGuest && tagOption) {
        queryClient.setQueryData<GuestDetailResponse>(['guest', guestId], {
          ...previousGuest,
          guest: {
            ...previousGuest.guest,
            tags: [
              ...previousGuest.guest.tags,
              {
                id: tagOption.id,
                label: tagOption.label,
                color: tagOption.color,
                icon: tagOption.icon,
              },
            ],
          },
        })
      }

      return { previousGuest }
    },
    onError: (_, variables, context) => {
      // Rollback on error
      if (context?.previousGuest) {
        queryClient.setQueryData(['guest', variables.guestId], context.previousGuest)
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['guest', variables.guestId] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useRemoveGuestTag() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ guestId, tagOptionId }: { guestId: number; tagOptionId: number }) =>
      api.delete(`/api/admin/guests/${guestId}/tags?tagOptionId=${tagOptionId}`),
    onMutate: async ({ guestId, tagOptionId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['guest', guestId] })

      // Snapshot the previous value
      const previousGuest = queryClient.getQueryData<GuestDetailResponse>(['guest', guestId])

      // Optimistically update the cache
      if (previousGuest) {
        queryClient.setQueryData<GuestDetailResponse>(['guest', guestId], {
          ...previousGuest,
          guest: {
            ...previousGuest.guest,
            tags: previousGuest.guest.tags.filter((t) => t.id !== tagOptionId),
          },
        })
      }

      return { previousGuest }
    },
    onError: (_, variables, context) => {
      // Rollback on error
      if (context?.previousGuest) {
        queryClient.setQueryData(['guest', variables.guestId], context.previousGuest)
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['guest', variables.guestId] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

// Waitlist mutations

interface CreateWaitlistData {
  date: string
  time?: string | null
  covers: number
  name: string
  email?: string
  phone?: string
  notes?: string
}

export function useCreateWaitlistEntry() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateWaitlistData) =>
      api.post<{ uuid: string; success: boolean }>('/api/admin/waitlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
    },
  })
}

export function useUpdateWaitlistStatus() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ uuid, status }: { uuid: string; status: WaitlistStatus }) =>
      api.patch<{ success: boolean }>(`/api/admin/waitlist/${uuid}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
    },
  })
}

export function useNotifyWaitlistEntry() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (uuid: string) =>
      api.post<{ success: boolean }>(`/api/admin/waitlist/${uuid}/notify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
    },
  })
}

interface SeatWaitlistData {
  uuid: string
  tableId: number
  date: string
  time: string
}

export function useSeatWaitlistEntry() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ uuid, ...data }: SeatWaitlistData) =>
      api.post<{ success: boolean; reservationUuid: string }>(`/api/admin/waitlist/${uuid}/seat`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useDeleteWaitlistEntry() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (uuid: string) =>
      api.delete<{ success: boolean }>(`/api/admin/waitlist/${uuid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
    },
  })
}

// Server mutations

interface CreateServerData {
  name: string
  color?: string
}

interface ServerResponse {
  server: {
    id: number
    name: string
    color: string
    active: boolean
    created_at: string
  }
}

export function useCreateServer() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateServerData) =>
      api.post<ServerResponse>('/api/admin/servers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

interface UpdateServerData {
  id: number
  name?: string
  color?: string
  active?: boolean
}

export function useUpdateServer() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateServerData) =>
      api.put<ServerResponse>(`/api/admin/servers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

export function useDeleteServer() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/servers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

interface SetServerAssignmentsData {
  date: string
  assignments: Array<{ tableId: number; serverId: number | null }>
}

interface ServerAssignmentsResponse {
  assignments: Array<{
    id: number
    server_id: number
    server_name: string
    server_color: string
    table_id: number
    table_number: string
    date: string
  }>
  assignmentsByTable: Record<number, { serverId: number; serverName: string; serverColor: string }>
}

interface ServersResponse {
  servers: Array<{ id: number; name: string; color: string; active: boolean }>
}

export function useSetServerAssignments() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SetServerAssignmentsData) =>
      api.post<{ success: boolean }>('/api/admin/servers/assignments', data),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['server-assignments', variables.date] })

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData<ServerAssignmentsResponse>([
        'server-assignments',
        variables.date,
      ])

      // Get servers from cache for name/color lookup
      const serversData = queryClient.getQueryData<ServersResponse>(['servers'])
      const serversById = new Map(serversData?.servers.map((s) => [s.id, s]) || [])

      // Optimistically update the cache
      if (previousAssignments) {
        const newAssignmentsByTable = { ...previousAssignments.assignmentsByTable }

        for (const { tableId, serverId } of variables.assignments) {
          if (serverId === null) {
            // Remove assignment
            delete newAssignmentsByTable[tableId]
          } else {
            // Add/update assignment
            const server = serversById.get(serverId)
            if (server) {
              newAssignmentsByTable[tableId] = {
                serverId: server.id,
                serverName: server.name,
                serverColor: server.color,
              }
            }
          }
        }

        queryClient.setQueryData<ServerAssignmentsResponse>(
          ['server-assignments', variables.date],
          {
            ...previousAssignments,
            assignmentsByTable: newAssignmentsByTable,
          }
        )
      }

      return { previousAssignments }
    },
    onError: (_, variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(
          ['server-assignments', variables.date],
          context.previousAssignments
        )
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['server-assignments', variables.date] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useAssignServerToReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reservationId, serverId }: { reservationId: number; serverId: number | null }) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, { serverId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

// Event mutations

export function useCreateEvent() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEventData) =>
      api.post<{ success: boolean; eventId: number }>('/api/admin/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useUpdateEvent() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateEventData) =>
      api.put<{ success: boolean }>(`/api/admin/events/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] })
    },
  })
}

export function useToggleEventVisibility() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, visible }: { id: number; visible: boolean }) =>
      api.patch<{ success: boolean }>(`/api/admin/events/${id}`, { visible: !visible }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] })
    },
  })
}

export function useToggleEventActive() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.patch<{ success: boolean }>(`/api/admin/events/${id}`, { active: !active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] })
    },
  })
}

export function useDeleteEvent() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

// Timeslot mutations

export function useCreateTimeslot() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTimeslotData) =>
      api.post<{ success: boolean; timeslotId: number }>(
        `/api/admin/events/${data.eventId}/timeslots`,
        data
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeslots', variables.eventId] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] })
    },
  })
}

export function useUpdateTimeslot() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, eventId, ...data }: UpdateTimeslotData) =>
      api.put<{ success: boolean }>(`/api/admin/timeslots/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeslots', variables.eventId] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] })
    },
  })
}

export function useToggleTimeslot() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, eventId, active }: { id: number; eventId: number; active: boolean }) =>
      api.patch<{ success: boolean }>(`/api/admin/timeslots/${id}`, { active: !active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeslots', variables.eventId] })
    },
  })
}

export function useDeleteTimeslot() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, eventId }: { id: number; eventId: number }) =>
      api.delete<{ success: boolean }>(`/api/admin/timeslots/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeslots', variables.eventId] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] })
    },
  })
}

// Event payment mutations

export function useUpdateEventPayment() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ eventId, ...data }: { eventId: number } & Partial<EventPaymentSettings>) =>
      api.put<{ success: boolean }>(`/api/admin/events/${eventId}/payment`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-payment', variables.eventId] })
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

// Event reservation mutations

interface CreateEventReservationData {
  eventId: number
  timeslotId?: number
  covers: number
  name: string
  email?: string
  phone?: string
  notes?: string
}

export function useCreateEventReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEventReservationData) =>
      api.post<{
        success: boolean
        reservationUuid: string
        checkoutUrl?: string
        fullyPaidByGiftCard?: boolean
      }>('/api/event-checkout', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['event-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useSendPaymentLink() {
  const api = useApiClient()

  return useMutation({
    mutationFn: (reservationId: number) =>
      api.post<{ success: boolean; checkoutUrl: string }>(
        `/api/admin/reservations/${reservationId}/payment-link`
      ),
  })
}

export function useRefundReservation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, amountCents, reason }: { id: number; amountCents?: number; reason?: string }) =>
      api.post<{ success: boolean; refundedAmountCents: number }>(
        `/api/admin/reservations/${id}/refund`,
        { amountCents, reason }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['event-reservations'] })
    },
  })
}

// Settings mutations

export function useUpdateGeneralSettings() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: GeneralSettings) =>
      api.put<{ success: boolean }>('/api/admin/settings/general', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'general'] })
    },
  })
}

// Guest tag option mutations (for settings screen)

interface CreateGuestTagData {
  label: string
  color: string
  icon?: string | null
}

interface GuestTagResponse {
  tag: GuestTagOption
}

export function useCreateGuestTag() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGuestTagData) =>
      api.post<GuestTagResponse>('/api/admin/guest-tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-tags'] })
    },
  })
}

interface UpdateGuestTagData {
  id: number
  label?: string
  color?: string
  icon?: string | null
  active?: boolean
  sortOrder?: number
}

export function useUpdateGuestTag() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateGuestTagData) =>
      api.put<GuestTagResponse>(`/api/admin/guest-tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-tags'] })
    },
  })
}

export function useDeleteGuestTag() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/guest-tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-tags'] })
    },
  })
}

// Notification settings mutations

export function useUpdateNotificationSettings() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: NotificationSettings) =>
      api.put<{ success: boolean }>('/api/admin/settings/notifications', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] })
    },
  })
}

// Seating settings mutations

export function useUpdateSeatingSettings() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SeatingSettings) =>
      api.put<{ success: boolean }>('/api/admin/settings/seating', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'seating'] })
    },
  })
}

// Blocked dates mutations

interface CreateBlockedDateData {
  date: string
  reason?: string | null
}

export function useCreateBlockedDate() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBlockedDateData) =>
      api.post<BlockedDate>('/api/admin/blocked-dates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates'] })
    },
  })
}

export function useDeleteBlockedDate() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/blocked-dates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates'] })
    },
  })
}

// Table mutations

interface CreateTableData {
  tableNumber: string
  minCapacity: number
  maxCapacity: number
  zoneId: number
  shape?: TableShape
}

interface TableResponse {
  table: {
    id: number
    table_number: string
    min_capacity: number
    max_capacity: number
    zone_id: number
    shape: TableShape
    active: boolean
  }
}

export function useCreateTable() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTableData) =>
      api.post<TableResponse>('/api/admin/tables', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

interface UpdateTableData {
  id: number
  tableNumber?: string
  minCapacity?: number
  maxCapacity?: number
  zoneId?: number
  shape?: TableShape
  active?: boolean
}

export function useUpdateTable() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTableData) =>
      api.put<TableResponse>(`/api/admin/tables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

export function useDeleteTable() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

// Operating hours mutations

interface CreateOperatingHourData {
  dayOfWeek: number
  openTime: string
  closeTime: string
  reservationStartTime?: string | null
  lastSeatingTime?: string | null
  slotDuration?: number
  capacity?: number
}

interface OperatingHourResponse {
  hour: OperatingHour
}

export function useCreateOperatingHour() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOperatingHourData) =>
      api.post<OperatingHourResponse>('/api/admin/operating-hours', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-hours'] })
    },
  })
}

interface UpdateOperatingHourData {
  id: number
  openTime?: string
  closeTime?: string
  reservationStartTime?: string | null
  lastSeatingTime?: string | null
  slotDuration?: number
  capacity?: number
  active?: boolean
}

export function useUpdateOperatingHour() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOperatingHourData) =>
      api.put<OperatingHourResponse>(`/api/admin/operating-hours/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-hours'] })
    },
  })
}

export function useDeleteOperatingHour() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/operating-hours/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-hours'] })
    },
  })
}

// Zone mutations

interface CreateZoneData {
  displayName: string
  key: string
  emoji?: string | null
  color?: string
  active?: boolean
  publicBookable?: boolean
}

interface ZoneResponse {
  id: number
  success: boolean
}

export function useCreateZone() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateZoneData) =>
      api.post<ZoneResponse>('/api/admin/zones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

interface UpdateZoneData {
  id: number
  displayName?: string
  key?: string
  emoji?: string | null
  color?: string
  active?: boolean
  publicBookable?: boolean
}

export function useUpdateZone() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateZoneData) =>
      api.put<{ success: boolean }>(`/api/admin/zones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

export function useDeleteZone() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })
}

// Zone group mutations

interface CreateZoneGroupData {
  displayName: string
  key: string
  emoji?: string | null
  active?: boolean
  publicVisible?: boolean
}

export function useCreateZoneGroup() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateZoneGroupData) =>
      api.post<ZoneResponse>('/api/admin/zone-groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

interface UpdateZoneGroupData {
  id: number
  displayName?: string
  key?: string
  emoji?: string | null
  active?: boolean
  publicVisible?: boolean
}

export function useUpdateZoneGroup() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateZoneGroupData) =>
      api.put<{ success: boolean }>(`/api/admin/zone-groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

export function useDeleteZoneGroup() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/zone-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

// Zone memberships mutation

export function useUpdateZoneMemberships() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, groupIds }: { zoneId: number; groupIds: number[] }) =>
      api.put<{ success: boolean }>(`/api/admin/zones/${zoneId}/memberships`, { groupIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

// Zone booking rules mutation

interface UpdateZoneBookingRulesData {
  zoneId: number
  minPartySize?: number | null
  maxPartySize?: number | null
  turnTime2Top?: number | null
  turnTime4Top?: number | null
  turnTime6Top?: number | null
  turnTimeLarge?: number | null
  allowMultiTable?: boolean | null
  allowCrossZone?: boolean
}

export function useUpdateZoneBookingRules() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, ...data }: UpdateZoneBookingRulesData) =>
      api.put<{ success: boolean }>(`/api/admin/zones/${zoneId}/booking-rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

// Zone pacing rule mutations

interface CreateZonePacingRuleData {
  zoneId: number
  dayOfWeek?: number | null
  startTime?: string | null
  endTime?: string | null
  maxCoversPerSlot?: number | null
  maxPartiesPerSlot?: number | null
  active?: boolean
}

interface PacingRuleResponse {
  id: number
  success: boolean
}

export function useCreateZonePacingRule() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, ...data }: CreateZonePacingRuleData) =>
      api.post<PacingRuleResponse>(`/api/admin/zones/${zoneId}/pacing-rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

interface UpdateZonePacingRuleData {
  id: number
  dayOfWeek?: number | null
  startTime?: string | null
  endTime?: string | null
  maxCoversPerSlot?: number | null
  maxPartiesPerSlot?: number | null
  active?: boolean
}

export function useUpdateZonePacingRule() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateZonePacingRuleData) =>
      api.put<{ success: boolean }>(`/api/admin/pacing-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

export function useDeleteZonePacingRule() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/pacing-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

// Reassign reservation to different table(s)
export function useReassignReservationTable() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reservationId, tableIds }: { reservationId: number; tableIds: number[] }) =>
      api.put<Reservation>(`/api/admin/reservations/${reservationId}`, {
        tableIds, // Backend expects camelCase
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['tables-with-status'] })
      queryClient.invalidateQueries({ queryKey: ['occupancy-timeline'] })
    },
  })
}

// ============================================
// Team/Staff Management Mutations
// ============================================

export function useInviteStaff() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: InviteStaffRequest) =>
      api.post<{ success: boolean; staffId: number }>('/api/admin/staff/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export function useUpdateStaffRole() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: StaffRole }) =>
      api.patch<{ success: boolean }>(`/api/admin/staff/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export function useRemoveStaff() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export function useRevokeInvitation() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ success: boolean }>(`/api/admin/staff/invitations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// ============================================
// Branding Settings Mutations
// ============================================

export function useUpdateBranding() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<BrandingAssets>) =>
      api.put<{ success: boolean }>('/api/admin/settings/branding', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}

export function useGenerateBrandColors() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assetType: BrandingAssetType) =>
      api.post<{ success: boolean; primaryColor: string; accentColor: string }>(
        '/api/admin/settings/branding/generate-colors',
        { assetType }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}

export function useUpdateBrandColors() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { primaryColor?: string; accentColor?: string }) =>
      api.put<{ success: boolean }>('/api/admin/settings/branding/colors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}

interface UploadBrandingImageResult {
  url: string
}

export function useUploadBrandingImage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      assetType,
      uri,
      mimeType,
    }: {
      assetType: BrandingAssetType
      uri: string
      mimeType: string
    }) => {
      // Create form data for upload
      const formData = new FormData()
      formData.append('assetType', assetType)
      formData.append('file', {
        uri,
        type: mimeType,
        name: `${assetType}.${mimeType.split('/')[1] || 'jpg'}`,
      } as unknown as Blob)

      return api.postFormData<UploadBrandingImageResult>(
        '/api/admin/uploads/restaurant-branding/mobile',
        formData
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}

// ============================================
// Billing/Subscription Mutations
// ============================================

interface CheckoutResponse {
  url: string
}

export function useCreateCheckout() {
  const api = useApiClient()

  return useMutation({
    mutationFn: () =>
      api.post<CheckoutResponse>('/api/billing/checkout', {}),
  })
}

interface PortalResponse {
  url: string
}

export function useCreatePortalSession() {
  const api = useApiClient()

  return useMutation({
    mutationFn: () =>
      api.post<PortalResponse>('/api/billing/portal', {}),
  })
}

interface ConnectOnboardResponse {
  url: string
}

export function useStartConnectOnboarding() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      api.post<ConnectOnboardResponse>('/api/connect/onboard', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect-status'] })
    },
  })
}

// ============================================
// Commerce Mutations (Orders, Gift Cards, Products)
// ============================================

// Orders

export function useUpdateOrderFulfillment() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, fulfillmentStatus }: { orderId: number; fulfillmentStatus: FulfillmentStatus }) =>
      api.put<Order>('/api/admin/orders', { id: orderId, fulfillmentStatus }),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}

// Gift Cards

export function useIssueGiftCard() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: IssueGiftCardRequest) =>
      api.post<GiftCard>('/api/admin/gift-cards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
    },
  })
}

export function useAdjustGiftCardBalance() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ giftCardId, amountCents, note }: { giftCardId: number; amountCents: number; note?: string }) =>
      api.put<GiftCard>(`/api/admin/gift-cards/${giftCardId}`, {
        action: 'adjust',
        amountCents,
        note,
      }),
    onSuccess: (_, { giftCardId }) => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      queryClient.invalidateQueries({ queryKey: ['gift-card', giftCardId] })
    },
  })
}

export function useVoidGiftCard() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ giftCardId, note }: { giftCardId: number; note?: string }) =>
      api.put<GiftCard>(`/api/admin/gift-cards/${giftCardId}`, {
        action: 'void',
        note,
      }),
    onSuccess: (_, { giftCardId }) => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      queryClient.invalidateQueries({ queryKey: ['gift-card', giftCardId] })
    },
  })
}

// Products

export function useCreateProduct() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProductRequest) =>
      api.post<Product>('/api/admin/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateProduct() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateProductRequest) =>
      api.put<Product>('/api/admin/products', data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', id] })
    },
  })
}

export function useDeleteProduct() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: number) =>
      api.delete<{ success: boolean }>(`/api/admin/products?id=${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// Product Variants

export function useCreateVariant() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateVariantRequest) =>
      api.post<ProductVariant>('/api/admin/products/variants', data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
    },
  })
}

export function useUpdateVariant() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, ...data }: UpdateVariantRequest & { productId: number }) =>
      api.put<ProductVariant>('/api/admin/products/variants', data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
    },
  })
}

export function useDeleteVariant() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId, productId }: { variantId: number; productId: number }) =>
      api.delete<{ success: boolean }>(`/api/admin/products/variants?id=${variantId}`),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
    },
  })
}

export function useAdjustInventory() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, ...data }: AdjustInventoryRequest & { productId: number }) =>
      api.patch<ProductVariant>('/api/admin/products/variants', data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
    },
  })
}

// Product Images

interface UploadProductImageResult {
  image: ProductImage
}

export function useUploadProductImage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      productId,
      uri,
      mimeType,
      altText,
    }: {
      productId: number
      uri: string
      mimeType: string
      altText?: string
    }) => {
      const formData = new FormData()
      formData.append('productId', productId.toString())
      formData.append('file', {
        uri,
        type: mimeType,
        name: `product-${productId}-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`,
      } as any)
      if (altText) formData.append('altText', altText)

      return api.postFormData<UploadProductImageResult>(
        '/api/admin/uploads/product-image/mobile',
        formData
      )
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] })
    },
  })
}

export function useDeleteProductImage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ imageId, productId }: { imageId: number; productId: number }) =>
      api.delete<{ success: boolean }>(`/api/admin/products/images?id=${imageId}`),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] })
    },
  })
}

export function useSetPrimaryImage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ imageId, productId }: { imageId: number; productId: number }) =>
      api.put<{ success: boolean }>('/api/admin/products/images', { id: imageId, setAsPrimary: true }),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] })
    },
  })
}

export function useReorderProductImages() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, imageIds }: { productId: number; imageIds: number[] }) =>
      api.patch<{ success: boolean }>('/api/admin/products/images', { productId, imageIds }),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] })
    },
  })
}
