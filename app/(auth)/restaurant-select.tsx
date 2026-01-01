import { useAuth, useUser } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'
import { useRestaurantStore } from '@/lib/store/restaurant'
import type { StaffRestaurant, StaffRole } from '@/lib/types'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.tableyeah.com'

function getRoleBadgeColor(role: StaffRole): string {
  switch (role) {
    case 'OWNER':
      return Neo.purple
    case 'ADMIN':
      return Neo.cyan
    case 'MANAGER':
      return Neo.lime
    case 'STAFF':
      return Neo.yellow
    default:
      return Neo.yellow
  }
}

function NeoButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor =
    variant === 'destructive'
      ? Neo.pink
      : variant === 'primary'
        ? Neo.lime
        : Neo.white

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: bgColor },
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

export default function RestaurantSelectScreen() {
  const { getToken, signOut, isLoaded } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const setRestaurant = useRestaurantStore((state) => state.setRestaurant)

  const [restaurants, setRestaurants] = useState<StaffRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded) {
      fetchRestaurants()
    }
  }, [isLoaded])

  const fetchRestaurants = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      console.log('Token obtained:', token ? `${token.slice(0, 20)}...` : 'null')
      if (!token) {
        throw new Error('No authentication token')
      }
      console.log('Fetching from:', `${API_BASE_URL}/api/admin/staff/restaurants`)
      const response = await fetch(`${API_BASE_URL}/api/admin/staff/restaurants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      console.log('Response status:', response.status)

      if (!response.ok) {
        throw new Error('Failed to fetch restaurants')
      }

      const data = await response.json()
      setRestaurants(data.restaurants || [])

      if (data.restaurants?.length === 1) {
        handleSelectRestaurant(data.restaurants[0])
      }
    } catch {
      setError('Failed to load restaurants. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRestaurant = (item: StaffRestaurant) => {
    setRestaurant({
      id: item.restaurant.id,
      slug: item.restaurant.slug,
      name: item.restaurant.name,
      timezone: item.restaurant.timezone,
      logoUrl: item.restaurant.logoUrl,
      role: item.role,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
    })
    router.replace('/(tabs)')
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.replace('/(auth)/sign-in')
    } catch {
      Alert.alert('Error', 'Failed to sign out')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Neo.black} />
            <Text style={styles.loadingText}>LOADING...</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>ERROR</Text>
            <Text style={styles.errorText}>{error}</Text>
            <NeoButton label="RETRY" onPress={fetchRestaurants} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>NO ACCESS</Text>
            <Text style={styles.errorText}>
              You don&apos;t have access to any restaurants yet. Contact your manager.
            </Text>
            <NeoButton label="SIGN OUT" onPress={handleSignOut} variant="destructive" />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SELECT RESTAURANT</Text>
          <Text style={styles.subtitle}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
        </View>

        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.restaurant.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.restaurantCard,
                pressed && styles.restaurantCardPressed,
              ]}
              onPress={() => handleSelectRestaurant(item)}
            >
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{item.restaurant.name}</Text>
                <Text style={styles.organizationName}>{item.organizationName}</Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: getRoleBadgeColor(item.role) },
                ]}
              >
                <Text style={styles.roleText}>{item.role}</Text>
              </View>
            </Pressable>
          )}
        />

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>SIGN OUT</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  content: {
    flex: 1,
    padding: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  list: {
    gap: 12,
  },
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    ...NeoShadow.default,
  },
  restaurantCardPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  organizationName: {
    fontSize: 12,
    color: Neo.black,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.7,
  },
  roleBadge: {
    borderWidth: NeoBorder.thin,
    borderColor: Neo.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  errorCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    maxWidth: 360,
    width: '100%',
    gap: 16,
    ...NeoShadow.lg,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Neo.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 14,
    color: Neo.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 22,
  },
  button: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    ...NeoShadow.sm,
  },
  buttonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  buttonText: {
    color: Neo.black,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signOutButton: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: Neo.pink,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
