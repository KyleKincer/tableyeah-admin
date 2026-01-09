import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApiClient } from './client'
import type {
  Reservation,
  ActivityItem,
  DashboardStats,
  GuestInfo,
  GuestDetailResponse,
  GuestTagOption,
  AdminTimeSlot,
  AvailableTable,
  TableInfo,
  WaitlistEntry,
  WaitlistStatus,
  Server,
  ServerAssignment,
  FloorPlanElement,
  Event,
  EventListItem,
  EventWithTimeslots,
  Timeslot,
  EventAvailability,
  EventReservation,
  EventRevenueSummary,
  EventPaymentSettings,
  GeneralSettings,
  NotificationSettings,
  SeatingSettings,
  BlockedDate,
  ZonesData,
  OperatingHour,
  StaffResponse,
  BrandingResponse,
  BillingResponse,
  ConnectStatus,
  // Commerce types
  OrdersResponse,
  OrderDetail,
  GiftCardsResponse,
  GiftCardDetail,
  ProductsResponse,
  ProductDetail,
  ProductVariant,
  ProductImage,
} from '../types'

interface ActivityResponse {
  items: ActivityItem[]
}

interface ReservationsResponse {
  reservations: Reservation[]
}

interface DashboardResponse {
  stats: DashboardStats
  arrivals: Reservation[]
  seated: Reservation[]
}

interface GuestsResponse {
  guests: GuestInfo[]
}

export function useActivity(range: '4h' | '24h' | '7d' = '4h') {
  const api = useApiClient()

  return useQuery({
    queryKey: ['activity', range],
    queryFn: () => api.get<ActivityResponse>(`/api/admin/activity?range=${range}`),
    // Realtime updates handle cache invalidation; fallback polling as backup
    refetchInterval: 60000,
    placeholderData: keepPreviousData,
  })
}

export function useDashboard() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardResponse>('/api/admin/dashboard'),
    // Realtime updates handle cache invalidation; fallback polling as backup
    refetchInterval: 60000,
  })
}

export function useReservations(date: string) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['reservations', date],
    queryFn: () => api.get<ReservationsResponse>(`/api/admin/reservations?date=${date}`),
    enabled: !!date,
  })
}

export function useReservation(id: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => api.get<Reservation>(`/api/admin/reservations/${id}`),
    enabled: !!id,
  })
}

interface AvailabilityResponse {
  slots: AdminTimeSlot[]
}

export function useAvailability(date: string, partySize: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['availability', date, partySize],
    queryFn: () =>
      api.get<AvailabilityResponse>(
        `/api/admin/availability?date=${date}&partySize=${partySize}`
      ),
    enabled: !!date && partySize > 0,
  })
}

interface TablesResponse {
  tables: AvailableTable[]
}

export function useAvailableTables(date: string, time: string, partySize: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['available-tables', date, time, partySize],
    queryFn: () =>
      api.get<TablesResponse>(
        `/api/admin/available-tables?date=${date}&time=${time}&partySize=${partySize}`
      ),
    enabled: !!date && !!time && partySize > 0,
  })
}

export function useGuests(search?: string) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['guests', search],
    queryFn: () => api.get<GuestsResponse>(`/api/admin/guests?search=${search || ''}`),
  })
}

export function useGuest(id: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['guest', id],
    queryFn: () => api.get<GuestDetailResponse>(`/api/admin/guests/${id}`),
    enabled: !!id,
  })
}

interface GuestTagsResponse {
  tags: GuestTagOption[]
}

export function useGuestTagOptions() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['guest-tags'],
    queryFn: () => api.get<GuestTagsResponse>('/api/admin/guest-tags'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Waitlist queries
interface WaitlistResponse {
  entries: WaitlistEntry[]
}

export function useWaitlist(date: string, status?: WaitlistStatus) {
  const api = useApiClient()
  const statusParam = status ? `&status=${status}` : ''

  return useQuery({
    queryKey: ['waitlist', date, status],
    queryFn: () => api.get<WaitlistResponse>(`/api/admin/waitlist?date=${date}${statusParam}`),
    enabled: !!date,
    // Realtime updates handle cache invalidation; fallback polling as backup
    refetchInterval: 60000,
    placeholderData: keepPreviousData,
  })
}

// Server queries
interface ServersResponse {
  servers: Server[]
}

export function useServers() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['servers'],
    queryFn: () => api.get<ServersResponse>('/api/admin/servers'),
    staleTime: 1000 * 60 * 5, // 5 minutes - servers don't change often
  })
}

interface ServerAssignmentsResponse {
  assignments: ServerAssignment[]
  assignmentsByTable: Record<number, { serverId: number; serverName: string; serverColor: string }>
}

export function useServerAssignments(date: string) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['server-assignments', date],
    queryFn: () => api.get<ServerAssignmentsResponse>(`/api/admin/servers/assignments?date=${date}`),
    enabled: !!date,
  })
}

// Tables query
interface AllTablesResponse {
  tables: TableInfo[]
}

export function useTables() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get<AllTablesResponse>('/api/admin/tables'),
    staleTime: 1000 * 60 * 5, // 5 minutes - tables don't change often
  })
}

// Floor plan elements query
interface FloorElementsResponse {
  elements: FloorPlanElement[]
}

export function useFloorPlanElements() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['floor-elements'],
    queryFn: () => api.get<FloorElementsResponse>('/api/admin/floor-elements'),
    staleTime: 1000 * 60 * 5, // 5 minutes - floor elements don't change often
  })
}

// Event queries
interface EventsResponse {
  events: EventListItem[]
}

export function useEvents() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventsResponse>('/api/admin/events'),
    staleTime: 1000 * 60, // 1 minute
  })
}

interface EventResponse {
  event: Event
}

export function useEvent(id: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await api.get<EventResponse>(`/api/admin/events/${id}`)
      return response.event
    },
    enabled: !!id,
  })
}

interface EventsForDateResponse {
  events: EventWithTimeslots[]
}

export function useEventsForDate(date: string | undefined) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['events-for-date', date],
    queryFn: () => api.get<EventsForDateResponse>(`/api/admin/events-for-date?date=${date}`),
    enabled: !!date,
  })
}

interface TimeslotsResponse {
  timeslots: Timeslot[]
  eventDate?: string
}

export function useEventTimeslots(eventId: number | undefined) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['event-timeslots', eventId],
    queryFn: () => api.get<TimeslotsResponse>(`/api/admin/events/${eventId}/timeslots`),
    enabled: !!eventId && eventId > 0,
  })
}

export function useEventAvailability(timeslotId: number, covers: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['event-availability', timeslotId, covers],
    queryFn: () =>
      api.get<EventAvailability>(
        `/api/admin/event-availability?timeslotId=${timeslotId}&covers=${covers}`
      ),
    enabled: !!timeslotId && covers > 0,
  })
}

interface EventPaymentResponse {
  event: EventPaymentSettings
  connectEnabled: boolean
}

export function useEventPayment(eventId: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['event-payment', eventId],
    queryFn: () => api.get<EventPaymentResponse>(`/api/admin/events/${eventId}/payment`),
    enabled: !!eventId,
  })
}

interface EventReservationsResponse {
  reservations: EventReservation[]
  summary: EventRevenueSummary
}

export function useEventReservations(eventId: number) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['event-reservations', eventId],
    queryFn: () => api.get<EventReservationsResponse>(`/api/admin/events/${eventId}/reservations`),
    enabled: !!eventId,
  })
}

// Settings queries

export function useGeneralSettings() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['settings', 'general'],
    queryFn: () => api.get<GeneralSettings>('/api/admin/settings/general'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useNotificationSettings() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () => api.get<NotificationSettings>('/api/admin/settings/notifications'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSeatingSettings() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['settings', 'seating'],
    queryFn: () => api.get<SeatingSettings>('/api/admin/settings/seating'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useBlockedDates() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['blocked-dates'],
    queryFn: () => api.get<BlockedDate[]>('/api/admin/blocked-dates'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Zones query - returns full zones data including groups, memberships, booking rules, pacing rules
export function useZonesData() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['zones'],
    queryFn: () => api.get<ZonesData>('/api/admin/zones'),
    staleTime: 1000 * 60 * 5, // 5 minutes - zones don't change often
  })
}

// Operating hours query
interface OperatingHoursResponse {
  hours: OperatingHour[]
}

export function useOperatingHours() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['operating-hours'],
    queryFn: () => api.get<OperatingHoursResponse>('/api/admin/operating-hours'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Occupancy timeline for pacing graph
interface OccupancySlot {
  time: string // "HH:MM"
  covers: number
}

interface OccupancyTimelineResponse {
  slots: OccupancySlot[]
  peakCovers: number
  totalCovers: number
  totalCapacity?: number
  openTime: string
  closeTime: string
}

export function useOccupancyTimeline(date: string, enabled: boolean = true) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['occupancy-timeline', date],
    queryFn: () => api.get<OccupancyTimelineResponse>(`/api/admin/occupancy-timeline?date=${date}`),
    enabled: !!date && enabled,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 60000, // Refresh every minute for live updates
    placeholderData: keepPreviousData,
  })
}

// Team/Staff queries
export function useStaffMembers() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffResponse>('/api/admin/staff'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Branding queries
export function useBranding() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get<BrandingResponse>('/api/admin/settings/branding'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Billing queries
export function useBilling() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get<BillingResponse>('/api/admin/billing'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Stripe Connect status
export function useConnectStatus() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['connect-status'],
    queryFn: () => api.get<ConnectStatus>('/api/connect/status'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// ============================================
// Commerce Queries (Orders, Gift Cards, Products)
// ============================================

// Orders
export function useOrders(params?: {
  search?: string
  status?: string
  fulfillmentStatus?: string
  limit?: number
  offset?: number
}) {
  const api = useApiClient()
  const queryParams = new URLSearchParams()

  if (params?.search) queryParams.set('search', params.search)
  if (params?.status) queryParams.set('status', params.status)
  if (params?.fulfillmentStatus) queryParams.set('fulfillmentStatus', params.fulfillmentStatus)
  if (params?.limit) queryParams.set('limit', params.limit.toString())
  if (params?.offset) queryParams.set('offset', params.offset.toString())

  const queryString = queryParams.toString()
  const endpoint = `/api/admin/orders${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.get<OrdersResponse>(endpoint),
    staleTime: 1000 * 60, // 1 minute
    placeholderData: keepPreviousData,
  })
}

interface OrderDetailResponse {
  order: Omit<OrderDetail, 'items'>
  items: OrderDetail['items']
}

export function useOrder(orderId: number | null) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await api.get<OrderDetailResponse>(`/api/admin/orders/${orderId}`)
      // Transform the response to match OrderDetail type
      return {
        ...response.order,
        items: response.items,
      } as OrderDetail
    },
    enabled: orderId !== null,
    staleTime: 1000 * 60, // 1 minute
  })
}

// Gift Cards
export function useGiftCards(params?: {
  search?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const api = useApiClient()
  const queryParams = new URLSearchParams()

  if (params?.search) queryParams.set('search', params.search)
  if (params?.status) queryParams.set('status', params.status)
  if (params?.limit) queryParams.set('limit', params.limit.toString())
  if (params?.offset) queryParams.set('offset', params.offset.toString())

  const queryString = queryParams.toString()
  const endpoint = `/api/admin/gift-cards${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['gift-cards', params],
    queryFn: () => api.get<GiftCardsResponse>(endpoint),
    staleTime: 1000 * 60, // 1 minute
    placeholderData: keepPreviousData,
  })
}

interface GiftCardDetailResponse {
  giftCard: Omit<GiftCardDetail, 'transactions' | 'activeHoldsCents'>
  transactions: GiftCardDetail['transactions']
  activeHolds: Array<{ amountCents: number }>
  purchaseOrder: unknown
}

export function useGiftCard(giftCardId: number | null) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['gift-card', giftCardId],
    queryFn: async () => {
      const response = await api.get<GiftCardDetailResponse>(`/api/admin/gift-cards/${giftCardId}`)
      // Transform the response to match GiftCardDetail type
      const activeHoldsCents = response.activeHolds?.reduce((sum, h) => sum + h.amountCents, 0) || 0
      return {
        ...response.giftCard,
        transactions: response.transactions,
        activeHoldsCents,
      } as GiftCardDetail
    },
    enabled: giftCardId !== null,
    staleTime: 1000 * 60, // 1 minute
  })
}

// Products
export function useProducts() {
  const api = useApiClient()

  return useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<ProductsResponse>('/api/admin/products'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useProduct(productId: number | null) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      // Fetch products list, variants, and images in parallel
      const [productsResponse, variantsResponse, imagesResponse] = await Promise.all([
        api.get<ProductsResponse>('/api/admin/products'),
        api.get<{ variants: ProductVariant[] }>(`/api/admin/products/variants?productId=${productId}`),
        api.get<{ images: ProductImage[] }>(`/api/admin/products/images?productId=${productId}`),
      ])

      // Find the product in the list
      const product = productsResponse.products.find(p => p.id === productId)
      if (!product) {
        throw new Error('Product not found')
      }

      return {
        ...product,
        variants: variantsResponse.variants || [],
        images: imagesResponse.images || [],
      } as ProductDetail
    },
    enabled: productId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useProductVariants(productId: number | null) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => api.get<{ variants: ProductVariant[] }>(`/api/admin/products/variants?productId=${productId}`),
    enabled: productId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useProductImages(productId: number | null) {
  const api = useApiClient()

  return useQuery({
    queryKey: ['product-images', productId],
    queryFn: () => api.get<{ images: ProductImage[] }>(`/api/admin/products/images?productId=${productId}`),
    enabled: productId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
