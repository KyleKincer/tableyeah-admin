import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import EventSource, { MessageEvent } from 'react-native-sse'
import { useAuth } from '@clerk/clerk-expo'
import { useRestaurantStore } from '../store/restaurant'
import type { RealtimeStatus, RealtimeEventName, RealtimeMessage } from './types'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.tableyeah.com'

type EventListener = {
  events: RealtimeEventName[]
  callback: (message: RealtimeMessage) => void
}

interface RealtimeContextValue {
  status: RealtimeStatus
  subscribe: (events: RealtimeEventName[], callback: (message: RealtimeMessage) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider')
  }
  return ctx
}

interface RealtimeProviderProps {
  children: React.ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { getToken, isSignedIn } = useAuth()
  const restaurantId = useRestaurantStore((s) => s.id)

  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const listenersRef = useRef<Set<EventListener>>(new Set())
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Single effect that manages the entire connection lifecycle
  useEffect(() => {
    // Skip if not ready
    if (!isSignedIn || !restaurantId) {
      setStatus('disconnected')
      return
    }

    let es: EventSource | null = null
    let mounted = true
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      mounted = false
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
      if (es) {
        es.removeAllEventListeners()
        es.close()
        es = null
      }
      eventSourceRef.current = null
    }

    const connect = async () => {
      if (!mounted) return

      try {
        const token = await getTokenRef.current()
        if (!mounted || !token) {
          if (mounted) setStatus('error')
          return
        }

        const channel = `restaurant-${restaurantId}`
        const url = `${API_BASE_URL}/api/realtime?channel=${encodeURIComponent(channel)}`
        setStatus('connecting')

        es = new EventSource(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        eventSourceRef.current = es

        es.addEventListener('open', () => {
          if (!mounted) return
          setStatus('connected')
        })

        es.addEventListener('close', () => {
          if (!mounted) return
          es = null
          eventSourceRef.current = null
          setStatus('reconnecting')
          reconnectTimeout = setTimeout(() => {
            if (mounted) connect()
          }, 5000)
        })

        es.addEventListener('message', (event: MessageEvent) => {
          if (!mounted || !event.data) return
          try {
            const message = JSON.parse(event.data)
            // Skip internal protocol messages
            if (message.type === 'connected' || message.type === 'ping' || message.type === 'reconnect') {
              return
            }
            listenersRef.current.forEach((listener) => {
              if (listener.events.includes(message.event)) {
                listener.callback(message as RealtimeMessage)
              }
            })
          } catch {
            // Ignore parse errors for malformed messages
          }
        })

        es.addEventListener('error', () => {
          if (!mounted) return
          if (es) {
            es.removeAllEventListeners()
            es.close()
            es = null
          }
          eventSourceRef.current = null
          setStatus('reconnecting')
          reconnectTimeout = setTimeout(() => {
            if (mounted) connect()
          }, 5000)
        })

        es.open()
      } catch {
        if (!mounted) return
        setStatus('error')
      }
    }

    connect()
    return cleanup
  }, [isSignedIn, restaurantId]) // getToken accessed via ref

  // Handle app state (background/foreground)
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== 'active' && eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setStatus('disconnected')
      }
      // Reconnection will happen via the main effect when dependencies don't change
      // For now, user can pull-to-refresh to trigger data reload
    }

    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [])

  // Subscribe function
  const subscribe = (events: RealtimeEventName[], callback: (message: RealtimeMessage) => void) => {
    const listener: EventListener = { events, callback }
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }

  return (
    <RealtimeContext.Provider value={{ status, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  )
}
