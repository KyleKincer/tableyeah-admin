import { create } from 'zustand'

export type ServiceMode = 'normal' | 'walk-in' | 'seat-waitlist' | 'server-assignment'

interface ServiceState {
  // View state
  isLiveMode: boolean
  selectedDate: Date
  selectedZoneId: number | null

  // Selection
  selectedTableId: number | null
  selectedReservationId: number | null

  // Modes
  mode: ServiceMode
  walkInTableId: number | null
  walkInPartySize: number | null
  waitlistEntryUuid: string | null
  assigningServerId: number | null
  pendingServerAssignments: { tableId: number; serverId: number | null }[]
}

interface ServiceActions {
  // View controls
  setLiveMode: (live: boolean) => void
  setSelectedDate: (date: Date) => void
  setSelectedZone: (zoneId: number | null) => void

  // Selection
  selectTable: (tableId: number | null) => void
  selectReservation: (id: number | null) => void
  clearSelection: () => void

  // Walk-in mode
  enterWalkInMode: (tableId?: number, partySize?: number) => void
  setWalkInPartySize: (size: number) => void
  exitWalkInMode: () => void

  // Seat waitlist mode
  enterSeatWaitlistMode: (entryUuid: string) => void
  exitSeatWaitlistMode: () => void

  // Server assignment mode
  enterServerAssignmentMode: (serverId: number) => void
  toggleTableAssignment: (tableId: number) => void
  exitServerAssignmentMode: () => void
  getPendingAssignments: () => { tableId: number; serverId: number | null }[]

  // Reset all state
  reset: () => void
}

type ServiceStore = ServiceState & ServiceActions

const initialState: ServiceState = {
  isLiveMode: true,
  selectedDate: new Date(),
  selectedZoneId: null,
  selectedTableId: null,
  selectedReservationId: null,
  mode: 'normal',
  walkInTableId: null,
  walkInPartySize: null,
  waitlistEntryUuid: null,
  assigningServerId: null,
  pendingServerAssignments: [],
}

export const useServiceStore = create<ServiceStore>((set, get) => ({
  ...initialState,

  // View controls
  setLiveMode: (live) => set({ isLiveMode: live }),
  setSelectedDate: (date) => set({ selectedDate: date, isLiveMode: false }),
  setSelectedZone: (zoneId) => set({ selectedZoneId: zoneId }),

  // Selection
  selectTable: (tableId) =>
    set({
      selectedTableId: tableId,
      selectedReservationId: null,
    }),
  selectReservation: (id) =>
    set({
      selectedReservationId: id,
      selectedTableId: null,
    }),
  clearSelection: () =>
    set({
      selectedTableId: null,
      selectedReservationId: null,
    }),

  // Walk-in mode
  enterWalkInMode: (tableId, partySize) =>
    set({
      mode: 'walk-in',
      walkInTableId: tableId ?? null,
      walkInPartySize: partySize ?? null,
      selectedReservationId: null,
    }),
  setWalkInPartySize: (size) =>
    set({
      walkInPartySize: size,
    }),
  exitWalkInMode: () =>
    set({
      mode: 'normal',
      walkInTableId: null,
      walkInPartySize: null,
    }),

  // Seat waitlist mode
  enterSeatWaitlistMode: (entryUuid) =>
    set({
      mode: 'seat-waitlist',
      waitlistEntryUuid: entryUuid,
      selectedReservationId: null,
    }),
  exitSeatWaitlistMode: () =>
    set({
      mode: 'normal',
      waitlistEntryUuid: null,
    }),

  // Server assignment mode
  enterServerAssignmentMode: (serverId) =>
    set({
      mode: 'server-assignment',
      assigningServerId: serverId,
      pendingServerAssignments: [],
      selectedTableId: null,
      selectedReservationId: null,
    }),
  toggleTableAssignment: (tableId) => {
    const { pendingServerAssignments, assigningServerId } = get()
    const existing = pendingServerAssignments.find((a) => a.tableId === tableId)

    if (existing) {
      // Toggle: if currently assigning this server, unassign; otherwise assign
      const newAssignments = pendingServerAssignments.filter((a) => a.tableId !== tableId)
      if (existing.serverId !== assigningServerId) {
        newAssignments.push({ tableId, serverId: assigningServerId })
      } else {
        newAssignments.push({ tableId, serverId: null })
      }
      set({ pendingServerAssignments: newAssignments })
    } else {
      // New assignment
      set({
        pendingServerAssignments: [
          ...pendingServerAssignments,
          { tableId, serverId: assigningServerId },
        ],
      })
    }
  },
  exitServerAssignmentMode: () =>
    set({
      mode: 'normal',
      assigningServerId: null,
      pendingServerAssignments: [],
    }),
  getPendingAssignments: () => get().pendingServerAssignments,

  // Reset
  reset: () => set(initialState),
}))
