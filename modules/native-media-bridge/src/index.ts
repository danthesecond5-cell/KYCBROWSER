/**
 * Native Media Bridge Module
 * 
 * This module provides native media bridge functionality for WebRTC-based
 * video injection at the native level.
 * 
 * EXPO GO COMPATIBILITY:
 * This module requires a development build and is NOT available in Expo Go.
 * When running in Expo Go, use Protocol 0 (WebView-based injection) instead.
 */

// Safe import with Expo Go detection
let NativeMediaBridgeModule: any = null;
let isExpoGoEnvironment = false;

try {
  // Check if we're in Expo Go
  const Constants = require('expo-constants').default;
  const executionEnvironment = Constants.executionEnvironment;
  isExpoGoEnvironment = executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
  
  if (!isExpoGoEnvironment) {
    const { requireNativeModule } = require('expo-modules-core');
    NativeMediaBridgeModule = requireNativeModule('NativeMediaBridge');
  } else {
    console.log('[NativeMediaBridge] Running in Expo Go - native module not available');
    console.log('[NativeMediaBridge] Use Protocol 0 (WebView injection) for video injection');
  }
} catch (e) {
  // Module not available
  console.warn('[NativeMediaBridge] Native module not available:', e);
}

/**
 * Check if the native media bridge is available
 */
export function isAvailable(): boolean {
  return !isExpoGoEnvironment && NativeMediaBridgeModule !== null;
}

/**
 * Check if running in Expo Go
 */
export function isExpoGo(): boolean {
  return isExpoGoEnvironment;
}

/**
 * Get a message explaining why the module is unavailable
 */
export function getUnavailableReason(): string | null {
  if (isExpoGoEnvironment) {
    return 'Native Media Bridge requires a development build and is not available in Expo Go. Use Protocol 0 (WebView injection) instead.';
  }
  if (!NativeMediaBridgeModule) {
    return 'Native Media Bridge module is not installed.';
  }
  return null;
}

export default NativeMediaBridgeModule;
