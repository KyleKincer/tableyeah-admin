import { useEffect, useRef } from 'react'
import { useRealtimeContext } from './RealtimeProvider'
import type { RealtimeEventName, RealtimeMessage, RealtimeEventMap } from './types'

interface UseRealtimeOptions<E extends RealtimeEventName> {
  /**
   * Array of event names to subscribe to
   */
  events: E[]
  /**
   * Callback fired when a matching event is received
   */
  onData: (payload: {
    event: E
    data: RealtimeEventMap[E]
    channel: string
  }) => void
  /**
   * Whether the subscription is enabled (default: true)
   */
  enabled?: boolean
}

/**
 * Hook for subscribing to realtime events
 *
 * @example
 * ```tsx
 * useRealtime({
 *   events: ['reservation.created', 'reservation.statusChanged'],
 *   onData: (payload) => {
 *     console.log('Event:', payload.event, payload.data)
 *     queryClient.invalidateQueries({ queryKey: ['reservations'] })
 *   },
 * })
 * ```
 */
export function useRealtime<E extends RealtimeEventName>({
  events,
  onData,
  enabled = true,
}: UseRealtimeOptions<E>) {
  const { status, subscribe } = useRealtimeContext()

  // Keep onData callback stable reference
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  // Keep events array stable reference (compare by contents)
  const eventsRef = useRef(events)
  if (
    events.length !== eventsRef.current.length ||
    events.some((e, i) => e !== eventsRef.current[i])
  ) {
    eventsRef.current = events
  }

  useEffect(() => {
    if (!enabled || eventsRef.current.length === 0) {
      return
    }

    const unsubscribe = subscribe(eventsRef.current, (message: RealtimeMessage) => {
      // Type assertion: we know the event matches because subscribe filters
      onDataRef.current({
        event: message.event as E,
        data: message.data as RealtimeEventMap[E],
        channel: message.channel,
      })
    })

    return unsubscribe
  }, [enabled, subscribe])

  return { status }
}
