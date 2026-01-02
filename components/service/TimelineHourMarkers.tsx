import { memo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { Neo, NeoBorder } from '@/constants/theme'
import { generateHourLabels } from './timeline/utils'
import {
  TABLE_LABEL_WIDTH,
  HOUR_MARKER_HEIGHT,
  ZOOM_LEVELS,
} from './timeline/constants'

interface TimelineHourMarkersProps {
  serviceStartHour: number
  serviceEndHour: number
  zoomIndex: number
  scrollOffsetMinutes: number
}

function TimelineHourMarkersComponent({
  serviceStartHour,
  serviceEndHour,
  zoomIndex,
  scrollOffsetMinutes,
}: TimelineHourMarkersProps) {
  const labels = generateHourLabels(serviceStartHour, serviceEndHour)

  // Calculate zoom-based width multiplier
  const hoursVisible = ZOOM_LEVELS[zoomIndex]
  const totalMinutes = (serviceEndHour - serviceStartHour) * 60
  const visibleMinutes = hoursVisible * 60
  const widthMultiplier = totalMinutes / visibleMinutes

  return (
    <View style={styles.container}>
      {/* Fixed spacer for table label column */}
      <View style={styles.labelSpacer} />

      {/* Hour markers */}
      <View style={styles.markersArea}>
        {labels.map(({ hour, label, percent }) => {
          // Apply zoom to position
          const left = `${percent * widthMultiplier}%`

          return (
            <View
              key={hour}
              style={[styles.marker, { left: left as `${number}%` }]}
            >
              <Text style={styles.markerText}>{label}</Text>
              <View style={styles.markerLine} />
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const TimelineHourMarkers = memo(TimelineHourMarkersComponent)

const styles = StyleSheet.create({
  container: {
    height: HOUR_MARKER_HEIGHT,
    flexDirection: 'row',
    backgroundColor: Neo.cream,
    borderBottomWidth: NeoBorder.thin,
    borderBottomColor: Neo.black,
  },
  labelSpacer: {
    width: TABLE_LABEL_WIDTH,
    borderRightWidth: NeoBorder.thin,
    borderRightColor: Neo.black,
    backgroundColor: Neo.cream,
  },
  markersArea: {
    flex: 1,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    transform: [{ translateX: -12 }], // Center the marker on position
  },
  markerText: {
    fontSize: 10,
    fontWeight: '700',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markerLine: {
    width: 1,
    flex: 1,
    backgroundColor: Neo.black + '30',
    marginTop: 4,
  },
})
