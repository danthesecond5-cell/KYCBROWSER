import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { DeveloperModeProvider } from "@/contexts/DeveloperModeContext";
import { DeviceTemplateProvider } from "@/contexts/DeviceTemplateContext";
import { VideoLibraryProvider } from "@/contexts/VideoLibraryContext";
import { ProtocolProvider } from "@/contexts/ProtocolContext";
import {
  installConsoleCapture,
  startFreezeDetection,
  stopFreezeDetection,
  onFreezeDetected,
  exportLogsReadable,
  type FreezeInfo,
} from "@/utils/logger";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="device-check" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="my-videos" options={{ presentation: "modal" }} />
      <Stack.Screen name="protected-preview" options={{ presentation: "modal" }} />
      <Stack.Screen name="test-harness" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    
    installConsoleCapture();

    // Start freeze detection with 2.5 second threshold
    startFreezeDetection(2500);
    console.log('[App] 🔍 Freeze detection enabled');
    
    // Listen for freeze events
    const unsubscribe = onFreezeDetected((freezeInfo: FreezeInfo) => {
      console.error('[App] 🥶 FREEZE DETECTED!', freezeInfo.duration, 'ms');
      
      // Show alert with option to copy logs
      Alert.alert(
        '🥶 App Freeze Detected',
        `The app was unresponsive for ${Math.round(freezeInfo.duration / 1000)} seconds.\n\nThis usually indicates a blocking operation or infinite loop.\n\nWould you like to copy the debug logs?`,
        [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'Copy Logs',
            onPress: async () => {
              try {
                const logs = exportLogsReadable();
                await Clipboard.setStringAsync(logs);
                Alert.alert('Copied', 'Debug logs copied to clipboard. You can paste them to share.');
              } catch (e) {
                console.error('Failed to copy:', e);
              }
            },
          },
        ]
      );
    });
    
    return () => {
      unsubscribe();
      stopFreezeDetection();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DeveloperModeProvider>
        <ProtocolProvider>
          <DeviceTemplateProvider>
            <VideoLibraryProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </VideoLibraryProvider>
          </DeviceTemplateProvider>
        </ProtocolProvider>
      </DeveloperModeProvider>
    </QueryClientProvider>
  );
}
