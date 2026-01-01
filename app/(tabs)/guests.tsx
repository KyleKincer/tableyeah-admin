import { useState, useCallback, useRef } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useGuests } from '@/lib/api/queries'
import { ContactActionSheet, type ContactInfo, type RowPosition } from '@/components/ui/ContactActionSheet'
import type { GuestInfo } from '@/lib/types'

function GuestRow({
  guest,
  onPress,
  onLongPress,
}: {
  guest: GuestInfo
  onPress: () => void
  onLongPress: (position: RowPosition) => void
}) {
  const [pressed, setPressed] = useState(false)
  const rowRef = useRef<View>(null)
  const initials = guest.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const hasWarning = guest.noShows > 0
  const visits = guest.totalVisits || 0

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    rowRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress({ y, height })
    })
  }

  return (
    <View ref={rowRef} collapsable={false}>
      <Pressable
        style={[styles.guestRow, pressed && styles.guestRowPressed]}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityLabel={`${guest.name}, ${visits} visits${hasWarning ? `, ${guest.noShows} no-shows` : ''}`}
        accessibilityRole="button"
        accessibilityHint="Hold for contact options"
      >
      {/* Avatar */}
      <View style={[styles.avatar, hasWarning && styles.avatarWarning]}>
        {guest.imageUrl ? (
          <Image source={{ uri: guest.imageUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{initials}</Text>
        )}
      </View>

      {/* Name & Email */}
      <View style={styles.guestInfo}>
        <Text style={styles.guestName} numberOfLines={1}>
          {guest.name}
        </Text>
        <Text style={styles.guestEmail} numberOfLines={1}>
          {guest.email}
        </Text>
      </View>

      {/* Visit Count */}
      <View style={styles.visitBox}>
        <Text style={styles.visitNumber}>{visits}</Text>
        <Text style={styles.visitLabel}>VISITS</Text>
      </View>

      {/* No-Show Warning */}
      {hasWarning && (
        <View style={styles.warningBadge}>
          <Text style={styles.warningText}>{guest.noShows}</Text>
        </View>
      )}

      {/* Arrow indicator */}
      <Text style={styles.arrow}>→</Text>
      </Pressable>
    </View>
  )
}

export default function GuestsScreen() {
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useGuests(search)
  const [refreshing, setRefreshing] = useState(false)
  const [actionSheetContact, setActionSheetContact] = useState<ContactInfo | null>(null)
  const [actionSheetPosition, setActionSheetPosition] = useState<RowPosition | null>(null)
  const router = useRouter()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleGuestPress = useCallback(
    (guest: GuestInfo) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      router.push(`/guest/${guest.id}`)
    },
    [router]
  )

  const guests = data?.guests || []

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="SEARCH GUESTS..."
            placeholderTextColor={Neo.black + '60'}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isLoading && !data ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      ) : guests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {search ? 'NO GUESTS FOUND' : 'NO GUESTS YET'}
          </Text>
          {search && (
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <GuestRow
              guest={item}
              onPress={() => handleGuestPress(item)}
              onLongPress={(position) => {
                setActionSheetContact({
                  name: item.name,
                  email: item.email,
                })
                setActionSheetPosition(position)
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Neo.black}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: Neo.white,
    borderBottomWidth: NeoBorder.default,
    borderBottomColor: Neo.black,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    ...NeoShadow.sm,
  },
  searchIcon: {
    fontSize: 18,
    color: Neo.black,
    paddingLeft: 14,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Neo.black,
    letterSpacing: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 14,
    ...NeoShadow.default,
  },
  guestRowPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: Neo.lime,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarWarning: {
    backgroundColor: Neo.orange,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  guestEmail: {
    fontSize: 12,
    color: Neo.black,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  visitBox: {
    alignItems: 'center',
    minWidth: 44,
  },
  visitNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  visitLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  warningBadge: {
    backgroundColor: Neo.pink,
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningText: {
    fontSize: 12,
    fontWeight: '900',
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  arrow: {
    fontSize: 16,
    fontWeight: '800',
    color: Neo.black,
    opacity: 0.4,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.6,
  },
  loadingCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    ...NeoShadow.lg,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
