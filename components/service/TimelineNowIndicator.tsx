import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Neo } from '@/constants/theme'
import { minutesToPercent } from './timeline/utils'
import {
  NOW_LINE_WIDTH,
  NOW_MARKER_SIZE,
  TABLE_LABEL_WIDTH,
  ZOOM_LEVELS,
} from './timeline/constants'

interface TimelineNowIndicatorProps {
  nowMinutes: number
  serviceStartHour: number
  serviceEndHour: number
  zoomIndex: number
  height: number
}

function TimelineNowIndicatorComponent({
  nowMinutes,
  serviceStartHour,
  serviceEndHour,
  zoomIndex,
  height,
}: TimelineNowIndicatorProps) {
  // Calculate position
  const percent = minutesToPercent(nowMinutes, serviceStartHour, serviceEndHour)

  // Apply zoom factor
  const hoursVisible = ZOOM_LEVELS[zoomIndex]
  const totalMinutes = (serviceEndHour - serviceStartHour) * 60
  const visibleMinutes = hoursVisible * 60
  const widthMultiplier = totalMinutes / visibleMinutes

  const left = `${percent * widthMultiplier}%`

  // Check if NOW is outside service hours
  const serviceStartMinutes = serviceStartHour * 60
  const serviceEndMinutes = serviceEndHour * 60
  if (nowMinutes < serviceStartMinutes || nowMinutes > serviceEndMinutes) {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          left: left as `${number}%`,
          height,
          marginLeft: TABLE_LABEL_WIDTH,
        },
      ]}
      pointerEvents="none"
    >
      {/* Diamond marker at top */}
      <View style={styles.marker} />

      {/* Vertical line */}
      <View style={styles.line} />
    </View>
  )
}

export const TimelineNowIndicator = memo(TimelineNowIndicatorComponent)

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    width: NOW_LINE_WIDTH,
    alignItems: 'center',
    zIndex: 100,
    transform: [{ translateX: -NOW_LINE_WIDTH / 2 }],
  },
  marker: {
    width: NOW_MARKER_SIZE,
    height: NOW_MARKER_SIZE,
    backgroundColor: Neo.pink,
    borderWidth: 2,
    borderColor: Neo.black,
    transform: [{ rotate: '45deg' }],
    marginBottom: -NOW_MARKER_SIZE / 2,
  },
  line: {
    flex: 1,
    width: NOW_LINE_WIDTH,
    backgroundColor: Neo.pink,
  },
})
