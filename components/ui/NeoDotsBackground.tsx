import { StyleSheet, View } from 'react-native'
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg'

import { Neo } from '@/constants/theme'

interface NeoDotsBackgroundProps {
  /**
   * Dot radius in pixels. Default: 1.5
   */
  dotRadius?: number
  /**
   * Grid spacing in pixels (distance between dot centers). Default: 24
   */
  gridSize?: number
  /**
   * Dot color. Default: rgba(10, 10, 10, 0.15) (Neo.black with 15% opacity)
   */
  dotColor?: string
  /**
   * Opacity of the dots (0-1). Default: 0.15
   */
  dotOpacity?: number
}

/**
 * Neo-brutalist dots background pattern matching the web app's floor plan.
 * Uses SVG pattern for cross-platform compatibility.
 *
 * Based on web app implementation:
 * `radial-gradient(circle, rgba(10, 10, 10, 0.15) 1.5px, transparent 1.5px)`
 * with `backgroundSize: 24px 24px`
 */
export function NeoDotsBackground({
  dotRadius = 1.5,
  gridSize = 24,
  dotColor = Neo.black,
  dotOpacity = 0.15,
}: NeoDotsBackgroundProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="neo-dots"
            x="0"
            y="0"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={gridSize / 2}
              cy={gridSize / 2}
              r={dotRadius}
              fill={dotColor}
              opacity={dotOpacity}
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#neo-dots)" />
      </Svg>
    </View>
  )
}

