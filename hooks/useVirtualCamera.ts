/**
 * useVirtualCamera Hook
 * 
 * This hook provides easy integration between the VirtualCamera native module
 * and the WebView-based video injection system.
 * 
 * Usage:
 * ```tsx
 * import { useVirtualCamera } from '@/hooks/useVirtualCamera';
 * 
 * function MyComponent() {
 *   const { 
 *     isEnabled, 
 *     enable, 
 *     disable,
 *     isAvailable,
 *     state,
 *   } = useVirtualCamera();
 *   
 *   const handleEnable = async () => {
 *     await enable('/path/to/video.mp4');
 *   };
 *   
 *   return (
 *     <View>
 *       <Button 
 *         title={isEnabled ? 'Disable Virtual Camera' : 'Enable Virtual Camera'}
 *         onPress={isEnabled ? disable : handleEnable}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// Import the virtual camera module
// This will use the mock implementation if native module is not available
import VirtualCamera, { 
  VirtualCameraConfig, 
  VirtualCameraState, 
  VirtualCameraEvent 
} from '../modules/virtual-camera/src';

export type VirtualCameraHookState = {
  /** Whether the virtual camera module is available (native build required) */
  isAvailable: boolean;
  /** Whether the virtual camera is currently enabled */
  isEnabled: boolean;
  /** Whether the virtual camera is currently playing video */
  isPlaying: boolean;
  /** Current frame number */
  currentFrame: number;
  /** Total number of frames in the video */
  totalFrames: number;
  /** Video FPS */
  fps: number;
  /** Video width */
  width: number;
  /** Video height */
  height: number;
  /** Current video URI */
  videoUri: string | null;
  /** Error message if any */
  error: string | null;
  /** Loading state */
  isLoading: boolean;
};

export type VirtualCameraHookActions = {
  /** Enable the virtual camera with a video source */
  enable: (videoUri: string, options?: Partial<VirtualCameraConfig>) => Promise<boolean>;
  /** Disable the virtual camera */
  disable: () => Promise<boolean>;
  /** Set a new video source */
  setVideoSource: (videoUri: string) => Promise<boolean>;
  /** Seek to a position in the video (seconds) */
  seekTo: (position: number) => Promise<boolean>;
  /** Pause video playback */
  pause: () => Promise<boolean>;
  /** Resume video playback */
  resume: () => Promise<boolean>;
  /** Get current frame as base64 image */
  getCurrentFrame: () => Promise<string | null>;
  /** Refresh state from native module */
  refreshState: () => Promise<void>;
};

export type UseVirtualCameraReturn = VirtualCameraHookState & VirtualCameraHookActions;

const initialState: VirtualCameraHookState = {
  isAvailable: false,
  isEnabled: false,
  isPlaying: false,
  currentFrame: 0,
  totalFrames: 0,
  fps: 0,
  width: 0,
  height: 0,
  videoUri: null,
  error: null,
  isLoading: false,
};

export function useVirtualCamera(): UseVirtualCameraReturn {
  const [state, setState] = useState<VirtualCameraHookState>(initialState);
  const subscriptionRef = useRef<any>(null);

  // Check if module is available on mount
  useEffect(() => {
    const isAvailable = VirtualCamera.isAvailable();
    setState(prev => ({ ...prev, isAvailable }));

    if (isAvailable) {
      // Subscribe to events
      subscriptionRef.current = VirtualCamera.addListener(handleEvent);

      // Get initial state
      refreshState();
    }

    return () => {
      if (subscriptionRef.current) {
        VirtualCamera.removeSubscription(subscriptionRef.current);
      }
    };
  }, []);

  const handleEvent = useCallback((event: VirtualCameraEvent) => {
    switch (event.type) {
      case 'statusChanged':
        setState(prev => ({
          ...prev,
          isEnabled: event.payload.status === 'enabled',
        }));
        break;
        
      case 'frameRendered':
        setState(prev => ({
          ...prev,
          currentFrame: event.payload.frame,
          totalFrames: event.payload.total,
        }));
        break;
        
      case 'videoLoaded':
        setState(prev => ({
          ...prev,
          fps: event.payload.fps,
          width: event.payload.width,
          height: event.payload.height,
          totalFrames: event.payload.totalFrames,
        }));
        break;
        
      case 'error':
        setState(prev => ({
          ...prev,
          error: event.payload.message,
          isLoading: false,
        }));
        break;
    }
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const nativeState = await VirtualCamera.getState();
      setState(prev => ({
        ...prev,
        isEnabled: nativeState.status === 'enabled',
        isPlaying: nativeState.isPlaying,
        currentFrame: nativeState.currentFrame,
        totalFrames: nativeState.totalFrames,
        fps: nativeState.fps,
        width: nativeState.width,
        height: nativeState.height,
        videoUri: nativeState.videoUri,
        error: nativeState.error,
      }));
    } catch (error) {
      console.error('[useVirtualCamera] Failed to refresh state:', error);
    }
  }, []);

  const enable = useCallback(async (
    videoUri: string, 
    options?: Partial<VirtualCameraConfig>
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const config: VirtualCameraConfig = {
        videoUri,
        loop: options?.loop ?? true,
        width: options?.width ?? 1080,
        height: options?.height ?? 1920,
        fps: options?.fps ?? 30,
        mirror: options?.mirror ?? false,
      };

      const result = await VirtualCamera.enable(config);

      if (result) {
        setState(prev => ({
          ...prev,
          isEnabled: true,
          isLoading: false,
          videoUri,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to enable virtual camera',
        }));
      }

      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to enable virtual camera',
      }));
      return false;
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    try {
      const result = await VirtualCamera.disable();

      if (result) {
        setState(prev => ({
          ...prev,
          isEnabled: false,
          isPlaying: false,
          currentFrame: 0,
        }));
      }

      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to disable virtual camera',
      }));
      return false;
    }
  }, []);

  const setVideoSource = useCallback(async (videoUri: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await VirtualCamera.setVideoSource(videoUri);

      if (result) {
        setState(prev => ({ ...prev, isLoading: false, videoUri }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to set video source',
        }));
      }

      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to set video source',
      }));
      return false;
    }
  }, []);

  const seekTo = useCallback(async (position: number): Promise<boolean> => {
    return VirtualCamera.seekTo(position);
  }, []);

  const pause = useCallback(async (): Promise<boolean> => {
    const result = await VirtualCamera.pause();
    if (result) {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
    return result;
  }, []);

  const resume = useCallback(async (): Promise<boolean> => {
    const result = await VirtualCamera.resume();
    if (result) {
      setState(prev => ({ ...prev, isPlaying: true }));
    }
    return result;
  }, []);

  const getCurrentFrame = useCallback(async (): Promise<string | null> => {
    return VirtualCamera.getCurrentFrame();
  }, []);

  return {
    ...state,
    enable,
    disable,
    setVideoSource,
    seekTo,
    pause,
    resume,
    getCurrentFrame,
    refreshState,
  };
}

export default useVirtualCamera;
