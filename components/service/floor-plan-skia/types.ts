import type { SharedValue } from 'react-native-reanimated'
import type { SkFont } from '@shopify/react-native-skia'
import type {
  TableWithStatus,
  FloorPlanElement,
  Server,
  WaitlistEntry,
  TableShape,
} from '@/lib/types'

// Viewport transform shared values
export interface FloorPlanTransform {
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
}

// Current transform values (for React state)
export interface TransformState {
  scale: number
  translateX: number
  translateY: number
}

// Hit test result when tapping a table
export interface TableHitResult {
  table: TableWithStatus
  screenX: number
  screenY: number
}

// Turn time status
export type TurnTimeStatus = 'green' | 'amber' | 'red'

// Interaction mode
export type FloorPlanMode = 'normal' | 'walk-in' | 'seat-waitlist' | 'server-assignment'

// Server assignment record
export interface ServerAssignmentRecord {
  serverId: number
  serverName: string
  serverColor: string
}

// Canvas props (pure rendering component)
export interface SkiaFloorPlanCanvasProps {
  tables: TableWithStatus[]
  elements: FloorPlanElement[]
  selectedTableId: number | null
  pressedTableId: number | null
  serverAssignments: Record<number, ServerAssignmentRecord>
  mode: FloorPlanMode
  containerWidth: number
  containerHeight: number
  transform: TransformState

  // Gesture handlers (called from canvas)
  onTableTap: (table: TableWithStatus) => void
  onTableLongPress: (table: TableWithStatus) => void
  onBackgroundTap: () => void
  onPressIn: (tableId: number) => void
  onPressOut: () => void

  // Server assignment mode
  selectedServerId?: number | null
  pendingServerAssignments?: Record<number, ServerAssignmentRecord | null>
}

// View props (wrapper component with mode bars)
export interface SkiaFloorPlanViewProps {
  tables: TableWithStatus[]
  elements?: FloorPlanElement[]
  selectedTableId: number | null
  onTablePress: (table: TableWithStatus) => void
  onTableLongPress: (table: TableWithStatus) => void
  onBackgroundPress: () => void
  serverAssignments?: Record<number, ServerAssignmentRecord>
  mode?: FloorPlanMode
  walkInPartySize?: number | null
  onCancelMode?: () => void
  servers?: Server[]
  selectedServerId?: number | null
  pendingServerAssignments?: Record<number, ServerAssignmentRecord | null>
  onSelectServer?: (serverId: number | null) => void
  onToggleTableServer?: (tableId: number) => void
  onSaveServerAssignments?: () => void
  waitlistEntry?: WaitlistEntry | null
  onSeatWaitlistAtTable?: (tableId: number) => void
}

// Drawing context passed to draw functions
export interface DrawContext {
  containerWidth: number
  containerHeight: number
  scale: number
  translateX: number
  translateY: number
  fonts: {
    tableNumber: SkFont
    capacity: SkFont
    badge: SkFont
    elementLabel: SkFont
  }
}

// Table drawing options
export interface TableDrawOptions {
  table: TableWithStatus
  isSelected: boolean
  isPressed: boolean
  serverColor?: string
}

// Floor plan statistics
export interface FloorPlanStats {
  available: number
  seated: number
  upcoming: number
  seatedCovers: number
}
