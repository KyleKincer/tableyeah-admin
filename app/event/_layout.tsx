import { Stack } from 'expo-router'

import { Neo, NeoBorder } from '@/constants/theme'

export default function EventLayout() {
  return (
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
        contentStyle: {
          borderTopWidth: NeoBorder.default,
          borderTopColor: Neo.black,
        },
      }}
    >
      <Stack.Screen
        name="create"
        options={{
          title: 'NEW EVENT',
          presentation: 'modal',
          headerStyle: { backgroundColor: Neo.lime },
        }}
      />
      <Stack.Screen
        name="[id]/index"
        options={{
          title: 'EVENT',
        }}
      />
      <Stack.Screen
        name="[id]/timeslots"
        options={{
          title: 'TIMESLOTS',
          headerStyle: { backgroundColor: Neo.cyan },
        }}
      />
      <Stack.Screen
        name="[id]/pricing"
        options={{
          title: 'PRICING',
          headerStyle: { backgroundColor: Neo.lime },
        }}
      />
      <Stack.Screen
        name="[id]/reservations"
        options={{
          title: 'RESERVATIONS',
          headerStyle: { backgroundColor: Neo.yellow },
        }}
      />
    </Stack>
  )
}
