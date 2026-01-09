import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol'
import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'

interface MoreMenuItemProps {
  icon: IconSymbolName
  label: string
  onPress: () => void
}

export function MoreMenuItem({ icon, label, onPress }: MoreMenuItemProps) {
  const [pressed, setPressed] = useState(false)

  const handlePressIn = () => {
    setPressed(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handlePressOut = () => {
    setPressed(false)
  }

  return (
    <Pressable
      style={[
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconContainer}>
        <IconSymbol name={icon} size={28} color={Neo.black} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <IconSymbol name="chevron.right" size={20} color={Neo.black + '60'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    ...NeoShadow.default,
  },
  containerPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  iconContainer: {
    width: 44,
    height: 44,
    backgroundColor: Neo.cream,
    borderWidth: 2,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Neo.black,
  },
})
