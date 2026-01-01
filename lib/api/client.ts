import { useAuth } from '@clerk/clerk-expo'
import { useRestaurantStore } from '../store/restaurant'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.tableyeah.com'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token: string | null,
  restaurantSlug: string | null
): Promise<T> {
  if (!token) {
    throw new ApiError('Not authenticated', 401)
  }

  if (!restaurantSlug) {
    throw new ApiError('No restaurant selected', 400)
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-restaurant-slug': restaurantSlug,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(error.error || `HTTP ${response.status}`, response.status)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json()
}

export function useApiClient() {
  const { getToken } = useAuth()
  const slug = useRestaurantStore((state) => state.slug)

  const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const token = await getToken()
    return apiRequest<T>(endpoint, options, token, slug)
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),

    put: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      }),

    patch: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      }),

    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  }
}
