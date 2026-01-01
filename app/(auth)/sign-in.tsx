import { useOAuth, useSignIn } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Neo, NeoBorder, NeoShadow } from '@/constants/theme'

WebBrowser.maybeCompleteAuthSession()

function NeoButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'oauth'
}) {
  const [pressed, setPressed] = useState(false)

  const bgColor =
    variant === 'primary'
      ? Neo.lime
      : variant === 'oauth'
        ? Neo.yellow
        : Neo.white

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: bgColor },
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Neo.black} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' })
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  const handleOAuthSignIn = useCallback(
    async (provider: 'google') => {
      try {
        setOauthLoading(provider)

        const oauthFlow = provider === 'google' ? startGoogleOAuth : null
        if (!oauthFlow) return

        const { createdSessionId, setActive: setOAuthActive } = await oauthFlow()

        if (createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: createdSessionId })
          router.replace('/(auth)/restaurant-select')
        }
      } catch (err: unknown) {
        const error = err as { errors?: { message: string }[] }
        console.error('OAuth error:', err)
        Alert.alert(
          'Sign In Failed',
          error.errors?.[0]?.message || 'Could not complete sign in'
        )
      } finally {
        setOauthLoading(null)
      }
    },
    [startGoogleOAuth, router]
  )

  const handleSignIn = async () => {
    if (!isLoaded) return

    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password')
      return
    }

    setLoading(true)
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/(auth)/restaurant-select')
      } else {
        Alert.alert('Error', 'Sign in could not be completed')
      }
    } catch (err: unknown) {
      const error = err as { errors?: { message: string }[] }
      Alert.alert(
        'Sign In Failed',
        error.errors?.[0]?.message || 'Please check your credentials and try again'
      )
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = loading || oauthLoading !== null

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>TY</Text>
            </View>
            <Text style={styles.title}>TABLEYEAH</Text>
            <Text style={styles.subtitle}>ADMIN</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <NeoButton
              label="CONTINUE WITH GOOGLE"
              onPress={() => handleOAuthSignIn('google')}
              loading={oauthLoading === 'google'}
              disabled={isDisabled}
              variant="oauth"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isDisabled}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!isDisabled}
                onSubmitEditing={handleSignIn}
              />
            </View>

            <NeoButton
              label="SIGN IN"
              onPress={handleSignIn}
              loading={loading}
              disabled={isDisabled}
              variant="primary"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Neo.cream,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: Neo.black,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...NeoShadow.default,
  },
  logoText: {
    color: Neo.lime,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Neo.black,
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 8,
    textTransform: 'uppercase',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formCard: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 24,
    gap: 16,
    ...NeoShadow.lg,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Neo.black,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    backgroundColor: Neo.white,
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 14,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Neo.black,
  },
  button: {
    borderWidth: NeoBorder.default,
    borderColor: Neo.black,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...NeoShadow.sm,
  },
  buttonPressed: {
    ...NeoShadow.pressed,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Neo.black,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: Neo.black,
  },
  dividerText: {
    color: Neo.black,
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 16,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
