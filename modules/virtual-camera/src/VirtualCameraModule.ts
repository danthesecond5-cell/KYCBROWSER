import { requireNativeModule } from 'expo-modules-core';

// Type definitions for the native module
export interface VirtualCameraModuleType {
  getState(): Promise<{
    status: string;
    videoUri: string | null;
    isPlaying: boolean;
    currentFrame: number;
    totalFrames: number;
    fps: number;
    width: number;
    height: number;
    error: string | null;
  }>;

  enable(config: {
    videoUri: string;
    loop: boolean;
    width: number;
    height: number;
    fps: number;
    mirror: boolean;
  }): Promise<boolean>;

  disable(): Promise<boolean>;

  setVideoSource(videoUri: string): Promise<boolean>;

  seekTo(position: number): Promise<boolean>;

  pause(): Promise<boolean>;

  resume(): Promise<boolean>;

  getCurrentFrame(): Promise<string | null>;
}

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
let VirtualCameraModule: VirtualCameraModuleType;

try {
  VirtualCameraModule = requireNativeModule('VirtualCamera');
} catch (error) {
  // Module not available - provide mock implementation for development
  console.warn('[VirtualCamera] Native module not available, using mock');
  
  VirtualCameraModule = {
    async getState() {
      return {
        status: 'disabled',
        videoUri: null,
        isPlaying: false,
        currentFrame: 0,
        totalFrames: 0,
        fps: 0,
        width: 0,
        height: 0,
        error: 'Native module not available - this feature requires a native build',
      };
    },
    async enable() {
      console.warn('[VirtualCamera] Mock: enable() called');
      return false;
    },
    async disable() {
      console.warn('[VirtualCamera] Mock: disable() called');
      return false;
    },
    async setVideoSource() {
      console.warn('[VirtualCamera] Mock: setVideoSource() called');
      return false;
    },
    async seekTo() {
      console.warn('[VirtualCamera] Mock: seekTo() called');
      return false;
    },
    async pause() {
      console.warn('[VirtualCamera] Mock: pause() called');
      return false;
    },
    async resume() {
      console.warn('[VirtualCamera] Mock: resume() called');
      return false;
    },
    async getCurrentFrame() {
      console.warn('[VirtualCamera] Mock: getCurrentFrame() called');
      return null;
    },
  };
}

export default VirtualCameraModule;
