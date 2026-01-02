import { differenceInMinutes, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { Neo, NeoBorder } from '@/constants/theme'

interface SeatingProgressBarProps {
  seatedAt: string
  expectedMinutes: number
  /** Update interval in ms. Set to 0 to disable auto-updates. Default: 30000 (30s) */
  updateInterval?: number
}

export function SeatingProgressBar({
  seatedAt,
  expectedMinutes,
  updateInterval = 30000,
}: SeatingProgressBarProps) {
  const [, forceUpdate] = useState(0)

  // Auto-update at interval
  useEffect(() => {
    if (updateInterval <= 0) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), updateInterval)
    return () => clearInterval(interval)
  }, [updateInterval])

  const elapsedMinutes = differenceInMinutes(new Date(), parseISO(seatedAt))
  const percentage = Math.min((elapsedMinutes / expectedMinutes) * 100, 100)

  const barColor =
    percentage < 75 ? Neo.lime : percentage <= 100 ? Neo.yellow : Neo.pink

  return (
    <View style={styles.progressBar}>
      <View
        style={[
          styles.progressFill,
          { width: `${percentage}%`, backgroundColor: barColor },
        ]}
      />
      <View style={styles.progressLabelPill}>
        <Text style={styles.progressLabel}>
          {elapsedMinutes}m/{expectedMinutes}m
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  progressBar: {
    height: 18,
    backgroundColor: Neo.black,
    borderTopWidth: NeoBorder.thin,
    borderTopColor: Neo.black,
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressLabelPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Neo.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
