import { useCallback, useState, useEffect } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import type { Server } from '@/lib/types'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Spring config for snappy but smooth animations
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
}

interface ServerAssignmentPillProps {
  servers: Server[]
  selectedServerId: number | null
  pendingAssignmentsCount: number
  hasChanges: boolean
  onSelectServer: (serverId: number | null) => void
  onSave: () => void
  onCancel: () => void
}

export function ServerAssignmentPill({
  servers,
  selectedServerId,
  pendingAssignmentsCount,
  hasChanges,
  onSelectServer,
  onSave,
  onCancel,
}: ServerAssignmentPillProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showServerPicker, setShowServerPicker] = useState(false)
  const expandProgress = useSharedValue(0)

  const activeServers = servers.filter((s) => s.active)
  const selectedServer = activeServers.find((s) => s.id === selectedServerId)

  // Animate expand/collapse
  useEffect(() => {
    expandProgress.value = withSpring(isExpanded ? 1 : 0, SPRING_CONFIG)
  }, [isExpanded, expandProgress])

  // Auto-show server picker when expanding without a server selected
  useEffect(() => {
    if (isExpanded && !selectedServerId) {
      setShowServerPicker(true)
    }
  }, [isExpanded, selectedServerId])

  const handleToggleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsExpanded((prev) => !prev)
  }, [])

  const handleToggleServerPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowServerPicker((prev) => !prev)
  }, [])

  const handleSelectServer = useCallback(
    (serverId: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onSelectServer(serverId)
      setShowServerPicker(false)
    },
    [onSelectServer]
  )

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setIsExpanded(false)
    setShowServerPicker(false)
    onSave()
  }, [onSave])

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsExpanded(false)
    setShowServerPicker(false)
    onCancel()
  }, [onCancel])

  // Animated styles for the collapsed pill
  const collapsedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0]),
    transform: [
      { scale: interpolate(expandProgress.value, [0, 0.5], [1, 0.8]) },
    ],
  }))

  // Animated styles for the expanded pill
  const expandedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.5, 1], [0, 1]),
    transform: [
      { scale: interpolate(expandProgress.value, [0.3, 1], [0.9, 1]) },
      { translateY: interpolate(expandProgress.value, [0.3, 1], [10, 0]) },
    ],
  }))

  return (
    <View style={styles.container}>
      {/* Server Picker Popover - inline, directly above pill */}
      {showServerPicker && isExpanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[styles.inlinePopover, NeoShadow.default]}
        >
          <Text style={styles.popoverTitle}>SELECT SERVER</Text>
          <View style={styles.serverGrid}>
            {activeServers.map((server) => {
              const isSelected = selectedServerId === server.id
              return (
                <Pressable
                  key={server.id}
                  style={[
                    styles.serverGridItem,
                    { borderColor: server.color },
                    isSelected && { backgroundColor: server.color },
                  ]}
                  onPress={() => handleSelectServer(server.id)}
                >
                  <View
                    style={[
                      styles.gridItemDot,
                      { backgroundColor: server.color },
                      isSelected && styles.gridItemDotSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.gridItemText,
                      isSelected && styles.gridItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {server.name}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Animated.View>
      )}

      {/* Collapsed state */}
      {!isExpanded && (
        <AnimatedPressable
          style={[styles.collapsedPill, NeoShadow.sm, collapsedAnimatedStyle]}
          onPress={handleToggleExpand}
          accessibilityLabel="Open server assignment"
          accessibilityRole="button"
        >
          {selectedServer ? (
            <View style={styles.collapsedWithServer}>
              <View style={[styles.serverDot, { backgroundColor: selectedServer.color }]} />
              <Text style={styles.collapsedServerName} numberOfLines={1}>
                {selectedServer.name}
              </Text>
              {hasChanges && (
                <Animated.View
                  style={styles.changeIndicator}
                  entering={FadeIn.duration(200)}
                />
              )}
            </View>
          ) : (
            <Ionicons name="people-outline" size={20} color={Neo.black} />
          )}
        </AnimatedPressable>
      )}

      {/* Expanded state */}
      {isExpanded && (
        <Animated.View style={[expandedAnimatedStyle]}>
          <View style={[styles.expandedPill, NeoShadow.default]}>
            {/* Cancel button - left side */}
            <Pressable
              style={[styles.actionButton, styles.cancelButton, styles.cancelButtonLeft]}
              onPress={handleCancel}
              accessibilityLabel="Cancel assignments"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={18} color={Neo.black} />
            </Pressable>

            {/* Server selector chip */}
            <Pressable
              style={[
                styles.serverSelector,
                selectedServer && { borderColor: selectedServer.color },
              ]}
              onPress={handleToggleServerPicker}
              accessibilityLabel="Select server"
              accessibilityRole="button"
            >
              {selectedServer ? (
                <>
                  <View style={[styles.selectorDot, { backgroundColor: selectedServer.color }]} />
                  <Text style={styles.selectorText} numberOfLines={1}>
                    {selectedServer.name}
                  </Text>
                </>
              ) : (
                <Text style={styles.selectorPlaceholder}>Select server</Text>
              )}
              <Ionicons
                name={showServerPicker ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Neo.black}
                style={styles.selectorChevron}
              />
            </Pressable>

            {/* Table count (when server selected) */}
            {selectedServerId && (
              <Animated.View
                entering={FadeIn.duration(150)}
                style={styles.tableCountContainer}
              >
                <Text style={styles.tableCount}>
                  {pendingAssignmentsCount} {pendingAssignmentsCount === 1 ? 'TBL' : 'TBLS'}
                </Text>
              </Animated.View>
            )}

            {/* Save button - right side */}
            <Pressable
              style={[
                styles.actionButton,
                styles.saveButton,
                styles.saveButtonRight,
                !hasChanges && styles.actionButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasChanges}
              accessibilityLabel="Save assignments"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={18} color={Neo.black} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    left: 16,
    alignItems: 'flex-end',
  },
  collapsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
  },
  collapsedWithServer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapsedServerName: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    maxWidth: 80,
  },
  changeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Neo.orange,
    marginLeft: 2,
  },
  expandedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
  },
  serverSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 6,
    backgroundColor: Neo.white,
    borderWidth: 2,
    borderColor: Neo.black,
  },
  selectorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
    maxWidth: 100,
  },
  selectorPlaceholder: {
    fontSize: 13,
    fontWeight: '600',
    color: Neo.black,
    opacity: 0.5,
  },
  selectorChevron: {
    marginLeft: 2,
    opacity: 0.6,
  },
  serverDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  tableCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableCount: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingHorizontal: 8,
    opacity: 0.7,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Neo.black,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  saveButton: {
    backgroundColor: Neo.lime,
  },
  saveButtonRight: {
    marginLeft: 0,
    marginRight: 6,
    marginVertical: 6,
  },
  cancelButton: {
    backgroundColor: Neo.white,
  },
  cancelButtonLeft: {
    marginLeft: 6,
    marginRight: 0,
    marginVertical: 6,
  },
  // Inline popover styles
  inlinePopover: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 12,
    marginBottom: 8,
    maxWidth: 320,
  },
  popoverTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 10,
    opacity: 0.6,
  },
  serverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serverGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Neo.white,
    borderWidth: 2,
    minWidth: 90,
  },
  gridItemDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Neo.black,
  },
  gridItemDotSelected: {
    borderColor: Neo.white,
  },
  gridItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: Neo.black,
  },
  gridItemTextSelected: {
    color: Neo.black,
  },
})
