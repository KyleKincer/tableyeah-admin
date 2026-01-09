# TableYeah Admin - Mobile App Guide

This document provides context for developing and maintaining the TableYeah Admin mobile app.

## Design System: Neo-Brutalism

### Core Principles
- **Hard-edged shadows** with NO blur (offset only)
- **Thick borders** (2-4px solid black)
- **Vibrant, saturated colors** - never muted
- **Rectangular elements** - NO rounded corners (borderRadius: 0)
- **Cream background** (#FFF8E7) - not white
- **Monospace fonts** for data/metadata (Menlo on iOS, monospace on Android)

### Color Palette

```typescript
// From constants/theme.ts
const Neo = {
  // Primary accent colors
  yellow: '#FFE600',
  lime: '#C8FF00',
  cyan: '#00FFFF',
  pink: '#FF6B9D',
  orange: '#e65d0e',
  purple: '#A855F7',
  blue: '#3B82F6',

  // Neutrals
  black: '#0A0A0A',
  white: '#FAFAFA',
  cream: '#FFF8E7',

  // Reservation status colors
  status: {
    booked: '#3B82F6',     // blue
    confirmed: '#C8FF00',  // lime
    seated: '#00FFFF',     // cyan
    completed: '#6B7280',  // gray
    cancelled: '#FF6B9D',  // pink
    noShow: '#e65d0e',     // orange
  }
}
```

### Shadow Patterns

| Level | Offset | Use Case |
|-------|--------|----------|
| sm | 2px | Buttons, small interactive elements |
| default | 4px | Cards, list items |
| lg | 6px | Modals, elevated panels |
| pressed | 1px + translate(2,2) | Active/pressed state |

### Typography

- **Display text**: fontWeight 800, textTransform uppercase, letterSpacing -0.5
- **Labels**: Menlo/monospace, fontSize 11, textTransform uppercase, letterSpacing 1
- **Body**: System font, regular weight

### Button Interaction Pattern

```typescript
// Default state
style={[styles.button, NeoShadow.sm]}

// Pressed state
style={[
  styles.button,
  NeoShadow.pressed,
  { transform: [{ translateX: 2 }, { translateY: 2 }] }
]}
```

Always add haptic feedback on press using `expo-haptics`.

### Component Styling Rules

1. **Cards**: 3px border + 4px shadow + white bg
2. **Buttons**: 3px border + 2px shadow + color bg (lime=primary, pink=destructive, white=secondary)
3. **Inputs**: 3px border + monospace font
4. **Tags/Badges**: 2px border + color bg + uppercase text

### Toggle Switch Pattern (IMPORTANT)

**NEVER use React Native's built-in `<Switch>` component.** Always use the custom `NeoSwitch` component from `@/components/ui/NeoSwitch` for toggle switches.

```typescript
import { NeoSwitch } from '@/components/ui/NeoSwitch'

<NeoSwitch
  label="Active"
  description="Optional description text"
  value={isActive}
  onToggle={() => setIsActive(!isActive)}
  disabled={isPending}
/>
```

The NeoSwitch provides:
- Rectangular track with thin black border (no rounded corners)
- Black square knob that slides left/right
- Lime background when on, white when off
- Haptic feedback on toggle
- Proper accessibility attributes

---

## Architecture

### Tech Stack
- **Framework**: React Native with Expo (SDK 52+)
- **Routing**: Expo Router (file-based)
- **State**: TanStack React Query (server) + Zustand (app)
- **Auth**: Clerk with expo-secure-store
- **Styling**: StyleSheet + theme constants

### File Structure

```
app/
├── (auth)/              # Auth screens (sign-in, restaurant-select)
├── (tabs)/              # Main tab navigation
│   ├── index.tsx        # Dashboard
│   ├── reservations.tsx # Reservations list
│   ├── guests.tsx       # Guests list
│   └── settings.tsx     # Settings
├── reservation/
│   ├── [id].tsx         # Reservation detail modal
│   └── create.tsx       # Create reservation
└── _layout.tsx          # Root layout with providers

lib/
├── api/
│   ├── client.ts        # Fetch wrapper with auth headers
│   ├── queries.ts       # React Query hooks (useReservations, etc.)
│   └── mutations.ts     # Mutation hooks (useSeatReservation, etc.)
├── store/
│   └── restaurant.ts    # Zustand store for selected restaurant
├── hooks/
│   └── useDeviceType.ts # Detect tablet vs phone
└── types/
    └── index.ts         # TypeScript interfaces

components/
├── reservation/         # Reservation-specific components
├── ui/                  # Reusable UI components
└── ...

constants/
└── theme.ts             # Neo design tokens (colors, shadows, borders)
```

### API Patterns

**Authentication:**
- JWT token from Clerk stored in expo-secure-store
- Passed in `Authorization: Bearer <token>` header
- Restaurant scope via `x-restaurant-slug` header

**API Client:**
```typescript
const api = useApiClient()
const data = await api.get<ResponseType>('/api/admin/endpoint')
const result = await api.post<ResponseType>('/api/admin/endpoint', body)
```

**React Query Conventions:**
- Query keys: `['reservations', date]`, `['reservation', id]`, etc.
- staleTime: 60 seconds default
- Real-time data: 15-30 second refetch intervals
- Invalidate related queries on mutations

### Key API Endpoints

```
# Core
GET  /api/admin/activity?range=4h|24h|7d       # Activity feed
GET  /api/admin/dashboard                       # Dashboard stats

# Reservations
GET  /api/admin/reservations?date=YYYY-MM-DD    # Reservations by date
GET  /api/admin/reservations/[id]               # Single reservation
PUT  /api/admin/reservations/[id]               # Update reservation
POST /api/admin/reservations                    # Create reservation

# Guests
GET  /api/admin/guests?search=...               # Search guests
GET  /api/admin/guests/[id]                     # Single guest

# Availability
GET  /api/admin/availability?date=...&partySize=...              # Time slots
GET  /api/admin/available-tables?date=...&time=...&partySize=... # Available tables

# Events
GET  /api/admin/events                          # List all events
POST /api/admin/events                          # Create event
GET  /api/admin/events/[id]                     # Single event
PUT  /api/admin/events/[id]                     # Update event (full)
PATCH /api/admin/events/[id]                    # Update event (partial)
DELETE /api/admin/events/[id]                   # Delete event
GET  /api/admin/events-for-date?date=...        # Events for date

# Timeslots
GET  /api/admin/events/[id]/timeslots           # List timeslots for event
POST /api/admin/events/[id]/timeslots           # Create timeslot
GET  /api/admin/timeslots/[id]                  # Single timeslot
PATCH /api/admin/timeslots/[id]                 # Update timeslot
DELETE /api/admin/timeslots/[id]                # Delete timeslot

# Event Payments
GET  /api/admin/events/[id]/payment             # Payment settings
PUT  /api/admin/events/[id]/payment             # Update payment settings
GET  /api/admin/events/[id]/reservations        # Event reservations with revenue

# Event Availability
GET  /api/admin/event-availability?timeslotId=...&covers=...
```

---

## Reservation Status Flow

```
PENDING_PAYMENT → BOOKED → CONFIRMED → SEATED → COMPLETED
                    ↓          ↓          ↓
                CANCELLED  CANCELLED  COMPLETED
                    ↓          ↓
                 NO_SHOW    NO_SHOW
```

**Actions by Status:**
- BOOKED: Confirm, Seat, Cancel, No-Show
- CONFIRMED: Seat, Cancel, No-Show
- SEATED: Complete, Unseat (revert to CONFIRMED), Cancel, No-Show
- COMPLETED/CANCELLED/NO_SHOW: No actions (final states)

---

## Device Responsiveness

Use `useDeviceType()` hook to detect tablet:

```typescript
const { isTablet } = useDeviceType()

// Tablet = width >= 768px
// Use for side-by-side layouts, larger touch targets, etc.
```

---

## Common Patterns

### Status Badge Component
```typescript
function StatusBadge({ status }: { status: ReservationStatus }) {
  const bgColor = getStatusColor(status)
  const textColor = [Neo.lime, Neo.cyan, Neo.yellow].includes(bgColor)
    ? Neo.black
    : Neo.white

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{status}</Text>
    </View>
  )
}
```

### Pressable with Neo Shadow
```typescript
function NeoButton({ label, onPress, variant = 'primary' }) {
  const [pressed, setPressed] = useState(false)
  const bgColor = variant === 'primary' ? Neo.lime
                : variant === 'destructive' ? Neo.pink
                : Neo.white

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: bgColor },
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}
```

### Pull-to-Refresh
```typescript
<FlatList
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Neo.black}
    />
  }
/>
```

---

## Navigation & Headers

Configure navigation headers in `app/_layout.tsx` using Expo Router's Stack options:

```typescript
<Stack
  screenOptions={{
    headerStyle: { backgroundColor: Neo.yellow },
    headerTintColor: Neo.black,
    headerTitleStyle: {
      fontWeight: '800',
      fontSize: 14,
    },
    headerBackTitle: 'BACK',
    headerShadowVisible: false,
    headerTitleAlign: 'center',
  }}
>
  <Stack.Screen
    name="reservation/create"
    options={{
      presentation: 'modal',
      title: 'NEW RESERVATION',
      headerStyle: { backgroundColor: Neo.lime },
    }}
  />
</Stack>
```

**Note:** `letterSpacing` is not allowed in `headerTitleStyle` - it will cause TypeScript errors.

---

## Accessibility

Add these accessibility props to interactive elements:

```typescript
<Pressable
  accessibilityLabel="Create new reservation"
  accessibilityRole="button"
  accessibilityHint="Opens the create reservation screen"
  accessibilityState={{ selected: isSelected }}
>
```

For checkbox-like elements (table selection, etc.):
```typescript
accessibilityRole="checkbox"
accessibilityState={{ checked: isSelected }}
```

Ensure minimum touch targets of 44x44 points.

---

## iPad Split Layout

Use `useDeviceType()` to implement master-detail layout:

```typescript
const { isTablet, isLandscape } = useDeviceType()
const useSplitLayout = isTablet && isLandscape

{useSplitLayout ? (
  <View style={styles.splitContainer}>
    <View style={styles.listPane}>{listContent}</View>
    <View style={styles.detailPane}>
      <DetailPanel reservationId={selectedId} />
    </View>
  </View>
) : (
  listContent
)}
```

Styles:
```typescript
splitContainer: { flex: 1, flexDirection: 'row' },
listPane: { width: '40%', borderRightWidth: 3, borderRightColor: Neo.black },
detailPane: { flex: 1 },
```

---

## API Endpoints - Important Notes

**Tables endpoint requires parameters:**
```typescript
// WRONG - endpoint doesn't exist:
GET /api/admin/tables

// CORRECT - requires date, time, and partySize:
GET /api/admin/available-tables?date=YYYY-MM-DD&time=HH:MM&partySize=N
```

Use `useAvailableTables(date, time, partySize)` query hook with all 3 parameters.

---

## Web App Reference

The main web app is at `/home/kck/src/tableyeah`. Key directories:
- `app/admin/` - Staff dashboard pages
- `app/api/admin/` - API routes used by mobile
- `components/admin/` - Web UI components (reference for feature parity)
- `lib/` - Shared business logic

When porting features, reference the web implementation for:
- API request/response shapes
- Business logic and validation rules
- UI/UX patterns to translate to mobile

---

## Backend Shared API Pattern

The backend consolidates business logic into shared `lib/` files that are used by both:
- **API routes** (`app/api/admin/`) - Used by this mobile app
- **Server actions** (`app/admin/` pages) - Used by web app

### Shared Files

| Backend File | Operations | Mobile Hooks |
|--------------|------------|--------------|
| `lib/events.ts` | Event/timeslot CRUD | useEvent, useCreateEvent, etc. |
| `lib/reservations.ts` | Status updates, queries | useSeatReservation, etc. |

### When Adding New Features

1. **Check if backend endpoint exists** - See Key API Endpoints above
2. **If missing, add to backend**:
   - Create shared function in `/home/kck/src/tableyeah/lib/`
   - Create API route in `/home/kck/src/tableyeah/app/api/admin/`
   - API route should use the shared lib function
3. **Add mobile hooks** - Create query/mutation hooks in `lib/api/`

### Example Flow

```typescript
// 1. Backend: lib/events.ts (shared logic)
export async function updateEvent(id, restaurantId, timeZone, data) { ... }

// 2. Backend: app/api/admin/events/[id]/route.ts (API for mobile)
export async function PUT(request) {
  const result = await updateEvent(id, tenant.id, tenant.timezone, body)
  return NextResponse.json(result)
}

// 3. Mobile: lib/api/mutations.ts
export function useUpdateEvent() {
  return useMutation({
    mutationFn: (data) => api.put(`/api/admin/events/${data.eventId}`, data),
  })
}
```

This ensures the web app and mobile app share identical business logic.
