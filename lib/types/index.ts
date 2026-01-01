export type ReservationStatus =
  | 'PENDING_PAYMENT'
  | 'BOOKED'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED'

// Event payment modes
export type PaymentMode = 'NONE' | 'PREPAY_PER_PERSON' | 'DEPOSIT_PER_PERSON'

// Payment status for reservations
export type PaymentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'EXPIRED'

export interface WaitlistEntry {
  id: number
  uuid: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM or null for "any time"
  covers: number
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: WaitlistStatus
  created_at: string
  updated_at: string
}

export type StaffRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF'

export type Permission = 'view' | 'manage_reservations' | 'manage_settings' | 'manage_staff'

export interface ReservationTag {
  type: 'OCCASION' | 'DIETARY'
  label: string
  icon: string | null
}

export interface GuestTag {
  id: number
  label: string
  color: string
  icon: string | null
}

export interface GuestTagOption {
  id: number
  label: string
  color: string
  icon: string | null
  sortOrder: number
  active: boolean
}

export interface GuestInfo {
  id: number
  uuid: string
  name: string
  email: string
  imageUrl: string | null
  notes: string | null
  // From list API: totalVisits, noShows, lastVisit
  totalVisits: number
  noShows: number
  lastVisit: string | null
  // From detail API: visitCount, noShowCount (legacy names)
  visitCount?: number
  noShowCount?: number
  tags: GuestTag[]
}

export interface GuestReservation {
  id: number
  uuid: string
  reservationTime: string | null
  covers: number
  name: string
  status: ReservationStatus
  isWalkIn: boolean
  eventName: string | null
  tableNumbers: string[]
}

export interface GuestStats {
  totalVisits: number
  noShows: number
  totalCovers: number
}

export interface GuestDetailResponse {
  guest: GuestInfo & { phone: string | null }
  reservations: GuestReservation[]
  stats: GuestStats
}

export interface ServerInfo {
  id: number
  name: string
  color: string
}

// Full server record from /api/admin/servers
export interface Server extends ServerInfo {
  active: boolean
  created_at: string
}

// Server table assignment for a specific date
export interface ServerAssignment {
  id: number
  server_id: number
  server_name: string
  server_color: string
  table_id: number
  table_number: string
  date: string
}

export interface Reservation {
  id: number
  uuid: string
  time: string
  date?: string
  covers: number
  name: string
  email?: string | null
  phone?: string | null
  table_ids?: number[]
  table_numbers?: string[]
  notes?: string | null
  admin_notes?: string | null
  status: ReservationStatus
  seated_at?: string | null
  cancelled_at?: string | null
  cancelled_by?: 'GUEST' | 'ADMIN' | null
  completed_at?: string | null
  no_show_at?: string | null
  is_walk_in?: boolean
  event_id?: number | null
  event_name?: string | null
  timeslot_id?: number | null
  // Payment fields (for event reservations)
  payment_status?: PaymentStatus | null
  amount_total_cents?: number | null
  amount_due_cents?: number | null
  refunded_amount_cents?: number | null
  currency?: string | null
  tags?: ReservationTag[]
  guest?: GuestInfo | null
  server?: ServerInfo | null
  created_at?: string
  updated_at?: string
  expected_turn_time?: number  // Minutes - from API based on party size and zone settings
}

export type ActivityRange = '4h' | '24h' | '7d'

export interface ActivityItem {
  id: string
  type:
    | 'new_reservation'
    | 'confirmed'
    | 'cancellation'
    | 'seated'
    | 'completed'
    | 'no_show'
    | 'walk_in'
    | 'modification'
  reservation: Reservation
  timestamp: string
}

export interface DashboardStats {
  todayReservations: number
  todayCovers: number
  todaySeated: number
  todaySeatedCovers: number
  upcomingReservations: number
  upcomingCovers: number
  todayCancellations: number
  todayNoShows: number
  todayWalkIns: number
}

export interface StaffRestaurant {
  restaurant: {
    id: string
    slug: string
    name: string
    timezone: string
    logoUrl: string | null
  }
  role: StaffRole
  organizationId: string
  organizationName: string
}

export interface AvailableTable {
  id: number
  table_number: string
  min_capacity: number
  max_capacity: number
  zone_id: number
  zone_key: string
  zone_display_name: string
}

// Table shapes for floor plan rendering
export type TableShape = 'RECTANGLE' | 'CIRCLE' | 'SQUARE' | 'OVAL' | 'BAR'

// Floor plan element types
export type FloorPlanElementType =
  | 'WALL'
  | 'DIVIDER'
  | 'ENTRANCE'
  | 'RESTROOM'
  | 'KITCHEN'
  | 'BAR_AREA'
  | 'HOSTESS'
  | 'LABEL'
  | 'DECORATION'
  | 'PLANT'
  | 'COLUMN'

export interface FloorPlanElement {
  id: number
  type: FloorPlanElementType
  label: string | null
  position_x: number
  position_y: number
  width: number
  height: number
  rotation: number
  color: string
  z_index: number
  zone_id: number
  zone_key: string
  active: boolean
}

// Full table info from /api/admin/tables (includes positions and zone_color)
export interface TableInfo {
  id: number
  table_number: string
  min_capacity: number
  max_capacity: number
  zone_id: number
  zone_key: string
  zone_display_name: string
  zone_color: string
  // Floor plan position data
  position_x: number | null
  position_y: number | null
  shape: TableShape
  width: number
  height: number
  rotation: number
  active: boolean
}

// Table with computed service status (for floor plan)
export type TableStatus = 'available' | 'occupied' | 'upcoming' | 'seated'

export interface TableWithStatus extends TableInfo {
  status: TableStatus
  currentReservation?: {
    id: number
    name: string
    covers: number
    time: string
    notes: string | null
    seatedAt: string | null
    status: ReservationStatus
  }
  upcomingReservations?: {
    id: number
    name: string
    covers: number
    time: string
    notes: string | null
  }[]
}

export interface AdminTimeSlot {
  time: string
  status: 'available' | 'limited' | 'full'
  availableTableCount: number
  availableTables: AvailableTable[]
  maxSingleTableCapacity: number
  combinedCapacity: number
  suggestedTableIds: number[]
}

// Event types
export interface Event {
  id: number
  name: string
  date: string // ISO timestamp
  capacity: number
  active: boolean
  visible: boolean
  guestDescriptionMd: string | null
  paymentMode: PaymentMode
  pricePerPersonCents: number | null
  depositPerPersonCents: number | null
  currency: string
  refundPolicyMd: string | null
  reservationCount: number
  totalCovers: number
  createdAt: string
}

// Lighter version for lists
export interface EventListItem {
  id: number
  name: string
  date: string
  capacity: number
  active: boolean
  visible: boolean
  paymentMode: PaymentMode
  pricePerPersonCents: number | null
  depositPerPersonCents: number | null
  currency: string
  reservationCount: number
  totalCovers: number
}

// Event timeslot
export interface Timeslot {
  id: number
  eventId: number
  startTime: string // ISO timestamp
  endTime: string // ISO timestamp
  capacity: number
  active: boolean
  bookedCovers: number
  reservationCount: number
}

// Event with its timeslots (for date-based queries)
export interface EventWithTimeslots extends EventListItem {
  timeslots: Timeslot[]
}

// Event availability check result
export interface EventAvailability {
  available: boolean
  capacityOk: boolean
  tablesFit: boolean
  remainingCapacity: number
  reason?: string
  suggestedTableIds: number[]
}

// Event reservation with payment info
export interface EventReservation {
  id: number
  uuid: string
  name: string
  email: string | null
  phone: string | null
  covers: number
  status: ReservationStatus
  paymentStatus: PaymentStatus | null
  amountTotalCents: number | null
  refundedAmountCents: number | null
  currency: string | null
  createdAt: string
  timeslotStartTime: string | null
}

// Event revenue summary
export interface EventRevenueSummary {
  totalCollected: number
  totalRefunded: number
  netRevenue: number
  coversRevenue: number
  addOnsRevenue: number
  paidReservations: number
  pendingPayments: number
  refundedReservations: number
  currency: string
}

// Create event input
export interface CreateEventData {
  name: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  capacity: number
  active?: boolean
  visible?: boolean
  guestDescriptionMd?: string
  paymentMode?: PaymentMode
  pricePerPersonCents?: number
  depositPerPersonCents?: number
  currency?: string
  refundPolicyMd?: string
}

// Update event input
export interface UpdateEventData {
  id: number
  name?: string
  date?: string
  time?: string
  capacity?: number
  active?: boolean
  visible?: boolean
  guestDescriptionMd?: string
  paymentMode?: PaymentMode
  pricePerPersonCents?: number
  depositPerPersonCents?: number
  currency?: string
  refundPolicyMd?: string
}

// Create timeslot input
export interface CreateTimeslotData {
  eventId: number
  eventDate: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  capacity: number
}

// Update timeslot input
export interface UpdateTimeslotData {
  id: number
  eventId: number
  startTime?: string
  endTime?: string
  capacity?: number
  active?: boolean
}

// Event payment settings
export interface EventPaymentSettings {
  paymentMode: PaymentMode
  pricePerPersonCents: number | null
  depositPerPersonCents: number | null
  currency: string
  refundPolicyMd: string | null
}

// General restaurant settings
export interface GeneralSettings {
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  websiteUrl: string | null
  timezone: string
}

// Notification settings
export interface NotificationSettings {
  reminderEnabled: boolean
  reminderHoursBefore: number
  postVisitEnabled: boolean
  postVisitDelayHours: number
  smsEnabled: boolean
  smsPhoneRequired: boolean
  staffNotificationsEnabled: boolean
  staffNotifyOnNewBooking: boolean
  staffNotifyOnConfirmation: boolean
  staffNotifyOnCancellation: boolean
  staffNotifyOnModification: boolean
  staffNotificationEmails: string | null
}

// Seating settings
export interface SeatingSettings {
  turnTime2Top: number
  turnTime4Top: number
  turnTime6Top: number
  turnTimeLarge: number
  maxPartySizePublic: number
  allowMultiTablePublic: boolean
}

// Blocked date
export interface BlockedDate {
  id: number
  date: string // YYYY-MM-DD
  reason: string | null
  createdAt: string
}

// Zone (dining area)
export interface Zone {
  id: number
  key: string
  displayName: string
  emoji: string | null
  color: string
  sortOrder: number
  active: boolean
  publicBookable: boolean
}

// Operating hours
export interface OperatingHour {
  id: number
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  openTime: string // HH:MM
  closeTime: string // HH:MM
  reservationStartTime: string | null
  lastSeatingTime: string | null
  slotDuration: number // minutes
  capacity: number
  active: boolean
}
