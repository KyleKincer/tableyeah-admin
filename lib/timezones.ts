/**
 * Timezone utilities for comprehensive IANA timezone support
 *
 * Provides:
 * - Full list of IANA timezones with current UTC offsets
 * - Validation function
 *
 * Matches the web app's timezone picker options
 */

import { getTimeZones } from '@vvo/tzdb'

export interface TimezoneOption {
  value: string // IANA timezone identifier (e.g., "America/New_York")
  label: string // Display label with UTC offset (e.g., "America/New_York (UTC-05:00)")
  rawLabel: string // Just the IANA name without offset
  currentOffset: string // Current UTC offset (e.g., "-05:00")
}

/**
 * Get the current UTC offset for a timezone as a string (e.g., "-05:00" or "+09:00")
 */
function getCurrentUTCOffset(timeZone: string): string {
  try {
    const now = new Date()

    // Use Intl.DateTimeFormat with timeZoneName: 'longOffset' to get offset like "GMT-05:00"
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })

    const parts = formatter.formatToParts(now)
    const offsetPart = parts.find(p => p.type === 'timeZoneName')

    if (offsetPart) {
      // Extract offset from strings like "GMT-05:00" or "GMT+09:00"
      const match = offsetPart.value.match(/GMT([+-])(\d{1,2}):(\d{2})/)
      if (match) {
        const sign = match[1]
        const hours = match[2].padStart(2, '0')
        const minutes = match[3]
        return `${sign}${hours}:${minutes}`
      }

      // Fallback: try parsing formats like "GMT-5" (without minutes)
      const simpleMatch = offsetPart.value.match(/GMT([+-])(\d{1,2})/)
      if (simpleMatch) {
        const sign = simpleMatch[1]
        const hours = simpleMatch[2].padStart(2, '0')
        return `${sign}${hours}:00`
      }
    }

    // Fallback: calculate offset by comparing what the same UTC timestamp represents
    // in UTC vs the target timezone
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const utcParts = utcFormatter.formatToParts(now)
    const tzParts = tzFormatter.formatToParts(now)

    const getValue = (parts: Intl.DateTimeFormatPart[], type: string) => {
      return parseInt(parts.find(p => p.type === type)?.value || '0', 10)
    }

    const utcHours = getValue(utcParts, 'hour')
    const tzHours = getValue(tzParts, 'hour')
    const utcMinutes = getValue(utcParts, 'minute')
    const tzMinutes = getValue(tzParts, 'minute')

    // Calculate offset in minutes
    const utcTotalMinutes = utcHours * 60 + utcMinutes
    const tzTotalMinutes = tzHours * 60 + tzMinutes
    let offsetMinutes = tzTotalMinutes - utcTotalMinutes

    // Handle day boundaries
    const utcDay = getValue(utcParts, 'day')
    const tzDay = getValue(tzParts, 'day')
    if (tzDay !== utcDay) {
      if (tzDay > utcDay) {
        offsetMinutes += 24 * 60
      } else {
        offsetMinutes -= 24 * 60
      }
    }

    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
    const offsetMins = Math.abs(offsetMinutes) % 60
    const sign = offsetMinutes >= 0 ? '+' : '-'

    return `${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`
  } catch {
    return '+00:00' // Fallback to UTC
  }
}

// Cache the timezone options since they don't change during a session
let cachedOptions: TimezoneOption[] | null = null

/**
 * Get all available timezone options with current UTC offsets
 * Returns a sorted list by offset, then alphabetically
 */
export function getTimezoneOptions(): TimezoneOption[] {
  if (cachedOptions) {
    return cachedOptions
  }

  const tzData = getTimeZones()

  // Create options with current UTC offsets
  const options: TimezoneOption[] = tzData.map(tz => {
    const offset = getCurrentUTCOffset(tz.name)
    const offsetLabel = `UTC${offset}`

    return {
      value: tz.name,
      rawLabel: tz.name,
      label: `${tz.name} (${offsetLabel})`,
      currentOffset: offset,
    }
  })

  // Sort by offset (UTC-12 to UTC+14), then alphabetically within same offset
  cachedOptions = options.sort((a, b) => {
    const offsetA = a.currentOffset
    const offsetB = b.currentOffset

    // Compare offsets first
    if (offsetA !== offsetB) {
      return offsetA.localeCompare(offsetB)
    }

    // Then alphabetically by name
    return a.rawLabel.localeCompare(b.rawLabel)
  })

  return cachedOptions
}

/**
 * Validate that a timezone string is a valid IANA timezone identifier
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') {
    return false
  }

  try {
    // Try to create a formatter with this timezone
    // If it throws, the timezone is invalid
    Intl.DateTimeFormat('en-US', { timeZone })

    // Also check if it exists in our tzdb list
    const tzData = getTimeZones()
    return tzData.some(tz => tz.name === timeZone)
  } catch {
    return false
  }
}

/**
 * Get a timezone option by value (for displaying current selection)
 */
export function getTimezoneOption(value: string): TimezoneOption | null {
  const options = getTimezoneOptions()
  return options.find(opt => opt.value === value) || null
}

/**
 * Format a timezone value for display (with offset if available)
 */
export function formatTimezone(value: string): string {
  const option = getTimezoneOption(value)
  if (option) {
    return option.label
  }

  // Fallback: try to get offset for unknown timezones
  try {
    const offset = getCurrentUTCOffset(value)
    return `${value} (UTC${offset})`
  } catch {
    return value // Just return the raw value if we can't format it
  }
}
