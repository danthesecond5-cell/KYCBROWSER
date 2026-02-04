import { NativeModules, Platform } from 'react-native';
import { isExpoGo, safeRequireNativeModule } from './expoGoCompat';

// Only load native module if not in Expo Go
const LoopbackModule = isExpoGo() 
  ? null 
  : safeRequireNativeModule('WebRtcLoopback', null);

/**
 * Check if the native WebRTC loopback module is available
 */
export const isWebRtcLoopbackAvailable = (): boolean => {
  return !isExpoGo() && LoopbackModule !== null;
};

/**
 * Export ring buffer to Photos
 * 
 * NOTE: This feature requires a development build and is not available in Expo Go.
 */
export const exportRingBufferToPhotos = async (): Promise<void> => {
  // Check for Expo Go environment first
  if (isExpoGo()) {
    throw new Error(
      'Ring buffer export is not available in Expo Go. ' +
      'This feature requires a development build with native modules.'
    );
  }
  
  if (Platform.OS !== 'ios') {
    throw new Error('Ring buffer export is only supported on iOS.');
  }
  
  if (!LoopbackModule?.exportRingBufferToPhotos) {
    throw new Error(
      'Native WebRtcLoopback module not available. ' +
      'Make sure you are using a development build with the webrtc-loopback package installed.'
    );
  }
  
  await LoopbackModule.exportRingBufferToPhotos();
};
