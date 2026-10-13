import {
  Alegreya_400Regular,
  Alegreya_500Medium,
  Alegreya_700Bold,
} from '@expo-google-fonts/alegreya';
import { AlegreyaSC_500Medium, AlegreyaSC_700Bold } from '@expo-google-fonts/alegreya-sc';
import {
  GrenzeGotisch_600SemiBold,
  GrenzeGotisch_700Bold,
} from '@expo-google-fonts/grenze-gotisch';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/authStore';
import { useSettings } from '@/features/settings/settingsStore';
import { useSolo } from '@/features/solo/soloStore';
import { colors } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GrenzeGotisch_600SemiBold,
    GrenzeGotisch_700Bold,
    Alegreya_400Regular,
    Alegreya_500Medium,
    Alegreya_700Bold,
    AlegreyaSC_500Medium,
    AlegreyaSC_700Bold,
  });
  const initAuth = useAuth((s) => s.init);
  const loadSettings = useSettings((s) => s.load);
  const loadSolo = useSolo((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void loadSolo();
    void initAuth();
  }, [initAuth, loadSettings, loadSolo]);

  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="matchmaking" options={{ gestureEnabled: false }} />
        <Stack.Screen name="join" />
        <Stack.Screen name="solo" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="match/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="dev" />
      </Stack>
    </SafeAreaProvider>
  );
}
