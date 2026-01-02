import { Platform, StyleSheet, Text, View } from 'react-native'

import { Neo, NeoBorder } from '@/constants/theme'

interface TimelineHeaderProps {
  totalReservations: number
  totalCovers: number
  peakCovers?: number
}

export function TimelineHeader({
  totalReservations,
  totalCovers,
  peakCovers,
}: TimelineHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Stats summary */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalReservations}</Text>
          <Text style={styles.statLabel}>RESOS</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCovers}</Text>
          <Text style={styles.statLabel}>COVERS</Text>
        </View>
        {peakCovers !== undefined && (
          <>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.peakValue]}>{peakCovers}</Text>
              <Text style={styles.statLabel}>PEAK</Text>
            </View>
          </>
        )}
      </View>

      {/* Pinch hint */}
      <Text style={styles.hint}>PINCH TO ZOOM</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  peakValue: {
    color: Neo.pink,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black + '60',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Neo.black + '20',
  },
  hint: {
    fontSize: 9,
    fontWeight: '600',
    color: Neo.black + '40',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
