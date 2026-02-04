/**
 * Expo Go Compatibility Layer
 * 
 * This module provides utilities for detecting and handling Expo Go environment
 * to ensure graceful degradation of features that require custom native modules.
 * 
 * Expo Go has certain limitations:
 * 1. No custom native modules (only Expo SDK modules are supported)
 * 2. No native code compilation (Swift/Kotlin that isn't part of Expo SDK)
 * 3. Limited native APIs (only those provided by Expo SDK)
 * 
 * This utility helps the app:
 * - Detect when running in Expo Go vs Development Build
 * - Provide fallback implementations for unavailable features
 * - Guide developers on which features require development builds
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Cache the detection result
let _isExpoGo: boolean | null = null;
let _detectionAttempted = false;

/**
 * Expo Go environment types
 */
export type ExpoEnvironment = 'expo-go' | 'development-build' | 'standalone' | 'unknown';

/**
 * Feature availability status
 */
export interface FeatureAvailability {
  available: boolean;
  reason?: string;
  fallbackAvailable: boolean;
  fallbackDescription?: string;
}

/**
 * Native module availability map
 */
export interface NativeModuleStatus {
  nativeMediaBridge: FeatureAvailability;
  virtualCamera: FeatureAvailability;
  webrtcLoopback: FeatureAvailability;
  reactNativeWebrtc: FeatureAvailability;
}

/**
 * Protocol compatibility map
 */
export interface ProtocolCompatibility {
  protocol0: FeatureAvailability;
  protocol1: FeatureAvailability;
  protocol2: FeatureAvailability;
  protocol3: FeatureAvailability;
  advancedProtocol: FeatureAvailability;
  webrtcBridge: FeatureAvailability;
  websocketBridge: FeatureAvailability;
}

/**
 * Check if the app is running in Expo Go
 * 
 * @returns true if running in Expo Go, false otherwise
 */
export function isExpoGo(): boolean {
  if (_detectionAttempted && _isExpoGo !== null) {
    return _isExpoGo;
  }
  
  _detectionAttempted = true;
  
  try {
    // Method 1: Check Constants.executionEnvironment (Expo SDK 46+)
    const executionEnvironment = Constants.executionEnvironment;
    if (executionEnvironment) {
      _isExpoGo = executionEnvironment === 'storeClient';
      return _isExpoGo;
    }
    
    // Method 2: Check Constants.appOwnership (older method)
    const appOwnership = Constants.appOwnership;
    if (appOwnership) {
      _isExpoGo = appOwnership === 'expo';
      return _isExpoGo;
    }
    
    // Method 3: Check if expo-dev-client is active
    // In Expo Go, expoConfig will have certain characteristics
    const expoConfig = Constants.expoConfig;
    if (expoConfig) {
      // Development builds typically have custom native modules
      // Expo Go doesn't
      const hasDevClient = !!(Constants as any).manifest2?.extra?.expoGo === false;
      _isExpoGo = !hasDevClient;
      return _isExpoGo;
    }
    
    // Method 4: Try to detect by checking for development build indicators
    // @ts-ignore - accessing potentially undefined property
    const manifest = Constants.manifest || Constants.manifest2;
    if (manifest && typeof manifest === 'object') {
      // Expo Go manifests have specific patterns
      const isExpoGoManifest = !!(manifest as any)?.extra?.expoClient;
      _isExpoGo = isExpoGoManifest;
      return _isExpoGo;
    }
    
    // Default: Assume Expo Go for safety (fallback behavior)
    _isExpoGo = true;
    return _isExpoGo;
    
  } catch (error) {
    console.warn('[ExpoGoCompat] Detection failed, assuming Expo Go environment:', error);
    _isExpoGo = true;
    return _isExpoGo;
  }
}

/**
 * Get the current Expo environment type
 */
export function getExpoEnvironment(): ExpoEnvironment {
  try {
    const executionEnvironment = Constants.executionEnvironment;
    
    if (executionEnvironment === 'storeClient') {
      return 'expo-go';
    }
    
    if (executionEnvironment === 'standalone') {
      return 'standalone';
    }
    
    if (executionEnvironment === 'bare') {
      return 'development-build';
    }
    
    // Check app ownership as fallback
    const appOwnership = Constants.appOwnership;
    if (appOwnership === 'expo') {
      return 'expo-go';
    }
    if (appOwnership === 'standalone') {
      return 'standalone';
    }
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a specific native module is available
 */
export function isNativeModuleAvailable(moduleName: string): boolean {
  if (isExpoGo()) {
    // In Expo Go, custom native modules are never available
    const customModules = [
      'NativeMediaBridge',
      'VirtualCamera',
      'WebRtcLoopback',
    ];
    
    if (customModules.includes(moduleName)) {
      return false;
    }
  }
  
  try {
    const { NativeModules } = require('react-native');
    return NativeModules[moduleName] != null;
  } catch {
    return false;
  }
}

/**
 * Check if react-native-webrtc is available
 */
export function isWebRTCAvailable(): boolean {
  if (isExpoGo()) {
    // react-native-webrtc requires custom native code
    return false;
  }
  
  try {
    require('react-native-webrtc');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the availability status of all native modules
 */
export function getNativeModuleStatus(): NativeModuleStatus {
  const inExpoGo = isExpoGo();
  
  return {
    nativeMediaBridge: {
      available: !inExpoGo && isNativeModuleAvailable('NativeMediaBridge'),
      reason: inExpoGo ? 'Not available in Expo Go - requires development build' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based injection (Protocol 0) provides equivalent functionality',
    },
    virtualCamera: {
      available: !inExpoGo && isNativeModuleAvailable('VirtualCamera'),
      reason: inExpoGo ? 'Not available in Expo Go - requires development build' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based canvas rendering provides equivalent functionality',
    },
    webrtcLoopback: {
      available: !inExpoGo && isNativeModuleAvailable('WebRtcLoopback'),
      reason: inExpoGo ? 'Not available in Expo Go - requires development build' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based WebRTC injection provides equivalent functionality',
    },
    reactNativeWebrtc: {
      available: !inExpoGo && isWebRTCAvailable(),
      reason: inExpoGo ? 'Not available in Expo Go - requires development build' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based WebRTC APIs work in Expo Go',
    },
  };
}

/**
 * Get the compatibility status of all protocols
 */
export function getProtocolCompatibility(): ProtocolCompatibility {
  const inExpoGo = isExpoGo();
  
  return {
    // Protocol 0: Pure WebView/JavaScript - FULLY COMPATIBLE with Expo Go
    protocol0: {
      available: true,
      fallbackAvailable: true,
      fallbackDescription: 'Primary injection method - works in all environments',
    },
    
    // Protocol 1: MediaStream constructor override - FULLY COMPATIBLE (WebView-based)
    protocol1: {
      available: true,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based MediaStream override - works in all environments',
    },
    
    // Protocol 2: Descriptor-level hook - FULLY COMPATIBLE (WebView-based)
    protocol2: {
      available: true,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based property descriptor override - works in all environments',
    },
    
    // Protocol 3: Proxy-based intercept - FULLY COMPATIBLE (WebView-based)
    protocol3: {
      available: true,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based Proxy intercept - works in all environments',
    },
    
    // Advanced Protocol: Partially available (native parts require dev build)
    advancedProtocol: {
      available: true, // JavaScript parts work
      reason: inExpoGo ? 'Native acceleration unavailable, using JavaScript fallback' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'JavaScript-based processing with WebView injection',
    },
    
    // WebRTC Bridge: Limited in Expo Go
    webrtcBridge: {
      available: !inExpoGo,
      reason: inExpoGo ? 'Native WebRTC requires development build' : undefined,
      fallbackAvailable: true,
      fallbackDescription: 'WebView-based WebRTC (Protocol 0) provides equivalent functionality',
    },
    
    // WebSocket Bridge: FULLY COMPATIBLE
    websocketBridge: {
      available: true,
      fallbackAvailable: true,
      fallbackDescription: 'Works in all environments',
    },
  };
}

/**
 * Get a summary of Expo Go compatibility for display
 */
export function getCompatibilitySummary(): {
  environment: ExpoEnvironment;
  isExpoGo: boolean;
  recommendedProtocol: string;
  availableFeatures: string[];
  unavailableFeatures: string[];
  warnings: string[];
} {
  const env = getExpoEnvironment();
  const inExpoGo = isExpoGo();
  const moduleStatus = getNativeModuleStatus();
  const protocolCompat = getProtocolCompatibility();
  
  const availableFeatures: string[] = [];
  const unavailableFeatures: string[] = [];
  const warnings: string[] = [];
  
  // Check protocols
  if (protocolCompat.protocol0.available) {
    availableFeatures.push('Protocol 0 (Primary WebView Injection)');
  }
  if (protocolCompat.protocol1.available) {
    availableFeatures.push('Protocol 1 (MediaStream Override)');
  }
  if (protocolCompat.protocol2.available) {
    availableFeatures.push('Protocol 2 (Descriptor Hook)');
  }
  if (protocolCompat.protocol3.available) {
    availableFeatures.push('Protocol 3 (Proxy Intercept)');
  }
  if (protocolCompat.websocketBridge.available) {
    availableFeatures.push('WebSocket Video Bridge');
  }
  
  // Check native modules
  if (!moduleStatus.nativeMediaBridge.available) {
    unavailableFeatures.push('Native Media Bridge (use Protocol 0 instead)');
  }
  if (!moduleStatus.virtualCamera.available) {
    unavailableFeatures.push('Virtual Camera (use WebView injection instead)');
  }
  if (!moduleStatus.webrtcLoopback.available) {
    unavailableFeatures.push('Native WebRTC Loopback (use Protocol 0 instead)');
  }
  if (!moduleStatus.reactNativeWebrtc.available) {
    unavailableFeatures.push('react-native-webrtc (use WebView WebRTC instead)');
  }
  
  // Add warnings for Expo Go
  if (inExpoGo) {
    warnings.push('Running in Expo Go - some native features are unavailable');
    warnings.push('Protocol 0 (WebView injection) is the recommended approach');
    warnings.push('For full native features, create a development build');
  }
  
  return {
    environment: env,
    isExpoGo: inExpoGo,
    recommendedProtocol: 'protocol0', // Protocol 0 works everywhere
    availableFeatures,
    unavailableFeatures,
    warnings,
  };
}

/**
 * Log compatibility information to console
 */
export function logCompatibilityInfo(): void {
  const summary = getCompatibilitySummary();
  
  console.log('====================================');
  console.log('Expo Go Compatibility Check');
  console.log('====================================');
  console.log(`Environment: ${summary.environment}`);
  console.log(`Is Expo Go: ${summary.isExpoGo}`);
  console.log(`Platform: ${Platform.OS}`);
  console.log(`Recommended Protocol: ${summary.recommendedProtocol}`);
  console.log('');
  
  console.log('✓ Available Features:');
  summary.availableFeatures.forEach(f => console.log(`  - ${f}`));
  console.log('');
  
  if (summary.unavailableFeatures.length > 0) {
    console.log('✗ Unavailable Features:');
    summary.unavailableFeatures.forEach(f => console.log(`  - ${f}`));
    console.log('');
  }
  
  if (summary.warnings.length > 0) {
    console.log('⚠ Warnings:');
    summary.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  console.log('====================================');
}

/**
 * Helper to safely require a native module with fallback
 */
export function safeRequireNativeModule<T>(
  moduleName: string,
  fallback: T
): T {
  if (isExpoGo()) {
    console.log(`[ExpoGoCompat] Skipping native module "${moduleName}" in Expo Go`);
    return fallback;
  }
  
  try {
    const { NativeModules } = require('react-native');
    const module = NativeModules[moduleName];
    
    if (module) {
      return module as T;
    }
    
    console.warn(`[ExpoGoCompat] Native module "${moduleName}" not found, using fallback`);
    return fallback;
  } catch (error) {
    console.warn(`[ExpoGoCompat] Failed to require "${moduleName}":`, error);
    return fallback;
  }
}

/**
 * Helper to safely require react-native-webrtc with fallback
 */
export function safeRequireWebRTC(): any | null {
  if (isExpoGo()) {
    console.log('[ExpoGoCompat] react-native-webrtc not available in Expo Go');
    return null;
  }
  
  try {
    return require('react-native-webrtc');
  } catch {
    console.warn('[ExpoGoCompat] react-native-webrtc not installed');
    return null;
  }
}

/**
 * Wrap a function to only execute in non-Expo-Go environments
 */
export function requireDevelopmentBuild<T extends (...args: any[]) => any>(
  fn: T,
  fallbackFn?: T
): T {
  return ((...args: Parameters<T>) => {
    if (isExpoGo()) {
      if (fallbackFn) {
        return fallbackFn(...args);
      }
      console.warn('[ExpoGoCompat] This feature requires a development build');
      return undefined;
    }
    return fn(...args);
  }) as T;
}

// Export default for convenient importing
export default {
  isExpoGo,
  getExpoEnvironment,
  isNativeModuleAvailable,
  isWebRTCAvailable,
  getNativeModuleStatus,
  getProtocolCompatibility,
  getCompatibilitySummary,
  logCompatibilityInfo,
  safeRequireNativeModule,
  safeRequireWebRTC,
  requireDevelopmentBuild,
};
