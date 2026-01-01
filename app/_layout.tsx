import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter, useSegments, router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Pressable, Text, Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { useRestaurantStore } from '@/lib/store/restaurant'
import { RealtimeProvider } from '@/lib/realtime'
import { Neo } from '@/constants/theme'

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Auth will not work until this is set.'
  )
}

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Ignore errors
    }
  },
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
})

export const unstable_settings = {
  anchor: '(tabs)',
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  const restaurantSlug = useRestaurantStore((state) => state.slug)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (isSignedIn && !restaurantSlug && !inAuthGroup) {
      router.replace('/(auth)/restaurant-select')
    } else if (isSignedIn && restaurantSlug && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [isSignedIn, isLoaded, restaurantSlug, segments, router])

  return <>{children}</>
}

function RootLayoutNav() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: Neo.yellow,
            },
            headerTintColor: Neo.black,
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 14,
            },
            headerBackTitle: 'BACK',
            headerShadowVisible: false,
            headerTitleAlign: 'center',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="event" options={{ headerShown: false }} />
          <Stack.Screen
            name="reservation/[id]"
            options={{
              presentation: 'modal',
              title: 'RESERVATION',
              headerStyle: { backgroundColor: Neo.cream },
            }}
          />
          <Stack.Screen
            name="reservation/create"
            options={{
              presentation: 'fullScreenModal',
              title: 'NEW RESERVATION',
              headerStyle: { backgroundColor: Neo.lime },
              headerLeft: () => (
                <Pressable
                  onPress={() => router.back()}
                  style={{ paddingHorizontal: 8 }}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: Neo.black,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                  >
                    CANCEL
                  </Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="activity"
            options={{
              title: 'ACTIVITY',
              headerStyle: { backgroundColor: Neo.cream },
            }}
          />
          <Stack.Screen
            name="guest/[id]"
            options={{
              presentation: 'modal',
              title: 'GUEST PROFILE',
              headerStyle: { backgroundColor: Neo.lime },
            }}
          />
          <Stack.Screen
            name="waitlist/create"
            options={{
              presentation: 'fullScreenModal',
              title: 'ADD TO WAITLIST',
              headerStyle: { backgroundColor: Neo.purple },
              headerTintColor: Neo.white,
              headerLeft: () => (
                <Pressable
                  onPress={() => router.back()}
                  style={{ paddingHorizontal: 8 }}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: Neo.white,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                  >
                    CANCEL
                  </Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="waitlist/seat"
            options={{
              presentation: 'modal',
              title: 'SEAT GUEST',
              headerStyle: { backgroundColor: Neo.cyan },
            }}
          />
          <Stack.Screen
            name="settings/servers"
            options={{
              title: 'SERVERS',
              headerStyle: { backgroundColor: Neo.blue },
              headerTintColor: Neo.white,
            }}
          />
          <Stack.Screen
            name="settings/table-assignments"
            options={{
              title: 'TABLE ASSIGNMENTS',
              headerStyle: { backgroundColor: Neo.cyan },
            }}
          />
          <Stack.Screen
            name="settings/general"
            options={{
              title: 'GENERAL SETTINGS',
              headerStyle: { backgroundColor: Neo.cream },
            }}
          />
          <Stack.Screen
            name="settings/guest-tags"
            options={{
              title: 'GUEST TAGS',
              headerStyle: { backgroundColor: Neo.purple },
              headerTintColor: Neo.white,
            }}
          />
          <Stack.Screen
            name="settings/notifications"
            options={{
              title: 'NOTIFICATIONS',
              headerStyle: { backgroundColor: Neo.cyan },
            }}
          />
          <Stack.Screen
            name="settings/reservations"
            options={{
              title: 'RESERVATIONS',
              headerStyle: { backgroundColor: Neo.orange },
              headerTintColor: Neo.white,
            }}
          />
          <Stack.Screen
            name="settings/tables"
            options={{
              title: 'TABLES',
              headerStyle: { backgroundColor: Neo.blue },
              headerTintColor: Neo.white,
            }}
          />
          <Stack.Screen
            name="settings/hours"
            options={{
              title: 'OPERATING HOURS',
              headerStyle: { backgroundColor: Neo.orange },
              headerTintColor: Neo.white,
            }}
          />
        </Stack>
      </AuthGate>
      <StatusBar style="dark" />
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY || ''}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <QueryClientProvider client={queryClient}>
            <RealtimeProvider>
              <RootLayoutNav />
            </RealtimeProvider>
          </QueryClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  )
}
