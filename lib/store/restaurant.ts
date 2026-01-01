import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StaffRole } from '../types'

interface RestaurantState {
  id: string | null
  slug: string | null
  name: string | null
  timezone: string | null
  logoUrl: string | null
  role: StaffRole | null
  organizationId: string | null
  organizationName: string | null
}

interface RestaurantActions {
  setRestaurant: (restaurant: {
    id: string
    slug: string
    name: string
    timezone: string
    logoUrl: string | null
    role: StaffRole
    organizationId: string
    organizationName: string
  }) => void
  clearRestaurant: () => void
}

type RestaurantStore = RestaurantState & RestaurantActions

const initialState: RestaurantState = {
  id: null,
  slug: null,
  name: null,
  timezone: null,
  logoUrl: null,
  role: null,
  organizationId: null,
  organizationName: null,
}

export const useRestaurantStore = create<RestaurantStore>()(
  persist(
    (set) => ({
      ...initialState,
      setRestaurant: (restaurant) =>
        set({
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
          timezone: restaurant.timezone,
          logoUrl: restaurant.logoUrl,
          role: restaurant.role,
          organizationId: restaurant.organizationId,
          organizationName: restaurant.organizationName,
        }),
      clearRestaurant: () => set(initialState),
    }),
    {
      name: 'restaurant-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
