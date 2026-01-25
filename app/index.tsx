import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text,
  StyleSheet, 
  Platform, 
  InteractionManager,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';

import { useAccelerometer, useGyroscope, useOrientation, AccelerometerData, GyroscopeData, OrientationData } from '@/hooks/useMotionSensors';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { CompatibilityCheckModal, ImportProgressModal } from '@/components/browser/modals';
import type { ImportProgress } from '@/components/browser/modals';
import type { CompatibilityResult } from '@/utils/videoCompatibilityChecker';
import type { SavedVideo } from '@/utils/videoManager';
import { PATTERN_PRESETS } from '@/constants/motionPatterns';
import { 
  SAFARI_USER_AGENT, 
  SAFARI_SPOOFING_SCRIPT, 
  NO_SPOOFING_SCRIPT, 
  MOTION_INJECTION_SCRIPT,
  CONSOLE_CAPTURE_SCRIPT,
  VIDEO_SIMULATION_TEST_SCRIPT,
  createMediaInjectionScript,
} from '@/constants/browserScripts';
import { clearAllDebugLogs } from '@/utils/logger';
import { formatVideoUriForWebView } from '@/utils/videoServing';
import { APP_CONFIG } from '@/constants/app';
import type { SimulationConfig } from '@/types/browser';
import BrowserHeader from '@/components/browser/BrowserHeader';
import DevicesList from '@/components/browser/DevicesList';
import TemplateModal from '@/components/browser/TemplateModal';

import ControlToolbar, { SiteSettingsModal } from '@/components/browser/ControlToolbar';
import SetupRequired from '@/components/SetupRequired';


export default function MotionBrowserScreen() {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    isMountedRef.current = true;
    clearAllDebugLogs();
    console.log('[App] Component mounted - logs cleared');
    return () => {
      isMountedRef.current = false;
      console.log('[App] Component unmounting');
      if (pendingInjectionRef.current) {
        clearTimeout(pendingInjectionRef.current);
        pendingInjectionRef.current = null;
      }
    };
  }, []);

  const { 
    activeTemplate, 
    templates, 
    setActiveTemplate,
    assignVideoToDevice,
    assignVideoToAllDevices,
    clearVideoFromDevice,
    toggleDeviceSimulation,
    stealthMode,
    toggleStealthMode,
    websiteSettings,
    getWebsiteSettings,
    saveWebsiteSettings,
    deleteWebsiteSettings,
    shouldUseStealthForUrl,
    hasMatchingTemplate,
    currentDeviceInfo,
    isLoading: isTemplateLoading,
  } = useDeviceTemplate();

  const { saveLocalVideo, checkCompatibility, processingState, clearProcessingState, pendingVideoForApply, setPendingVideoForApply } = useVideoLibrary();

  const [compatibilityModalVisible, setCompatibilityModalVisible] = useState(false);
  const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityResult | null>(null);
  const [isCheckingCompatibility, setIsCheckingCompatibility] = useState(false);
  const [checkingVideoName, setCheckingVideoName] = useState<string>('');
  const [pendingSavedVideo, setPendingSavedVideo] = useState<SavedVideo | null>(null);
  const [pendingApplyTarget, setPendingApplyTarget] = useState<'all' | string | null>(null);
  const [importingVideoName, setImportingVideoName] = useState<string>('');

  

  

  const [url, setUrl] = useState<string>(APP_CONFIG.WEBVIEW.DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState<string>(APP_CONFIG.WEBVIEW.DEFAULT_URL);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const { data: realAccelData } = useAccelerometer(50);
  const { data: realGyroData } = useGyroscope(50);
  const { data: realOrientData } = useOrientation(50);
  
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [useRealSensors, setUseRealSensors] = useState<boolean>(false);
  const [simConfig, setSimConfig] = useState<SimulationConfig>({
    pattern: 'walking',
    intensity: 1.0,
    frequency: 1.0,
    noise: 0.1,
  });
  const [simAccelData, setSimAccelData] = useState<AccelerometerData>({ x: 0, y: 0, z: 9.8 });
  const [simGyroData, setSimGyroData] = useState<GyroscopeData>({ x: 0, y: 0, z: 0 });
  const [simOrientData, setSimOrientData] = useState<OrientationData>({ alpha: 0, beta: 0, gamma: 0 });
  const timeRef = useRef<number>(0);
  const isApplyingVideoRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const lastInjectionTimeRef = useRef<number>(0);
  const pendingInjectionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [autoAcceptPermissions, setAutoAcceptPermissions] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [safariModeEnabled, setSafariModeEnabled] = useState(true);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  const [showSiteSettingsModal, setShowSiteSettingsModal] = useState(false);

  const accelData = simulationActive ? simAccelData : realAccelData;
  const gyroData = simulationActive ? simGyroData : realGyroData;

  const currentWebsiteSettings = useMemo(() => 
    getWebsiteSettings(url),
    [getWebsiteSettings, url]
  );

  const effectiveStealthMode = useMemo(() =>
    shouldUseStealthForUrl(url),
    [shouldUseStealthForUrl, url]
  );

  const simulatingDevicesCount = useMemo(() =>
    activeTemplate?.captureDevices.filter(d => d.simulationEnabled).length || 0,
    [activeTemplate]
  );

  const injectMotionData = useCallback((accel: AccelerometerData, gyro: GyroscopeData, orient: OrientationData, active: boolean) => {
    if (!webViewRef.current) return;
    
    const message = JSON.stringify({
      type: 'motion',
      payload: {
        acceleration: { x: accel.x, y: accel.y, z: accel.z - 9.8 },
        accelerationIncludingGravity: accel,
        rotationRate: { alpha: gyro.x, beta: gyro.y, gamma: gyro.z },
        orientation: orient,
        active: active,
        interval: 50,
      }
    });
    
    webViewRef.current.injectJavaScript(`
      window.__updateMotionData && window.__updateMotionData(${message}.payload);
      true;
    `);
  }, []);

  const injectMediaConfigImmediate = useCallback(() => {
    if (!webViewRef.current || !activeTemplate || !isMountedRef.current) {
      console.log('[App] Skipping injection - not ready:', {
        hasWebView: !!webViewRef.current,
        hasTemplate: !!activeTemplate,
        isMounted: isMountedRef.current,
      });
      return;
    }

    const normalizedDevices = activeTemplate.captureDevices.map(d => {
      if (!d.assignedVideoUri) return d;
      return {
        ...d,
        assignedVideoUri: formatVideoUriForWebView(d.assignedVideoUri),
      };
    });
    
    const config = {
      stealthMode: effectiveStealthMode,
      devices: normalizedDevices,
    };
    
    console.log('[App] Injecting media config:', {
      stealthMode: effectiveStealthMode,
      deviceCount: activeTemplate.captureDevices.length,
      simulatingDevices: activeTemplate.captureDevices.filter(d => d.simulationEnabled && d.assignedVideoUri).map(d => d.name),
    });
    
    lastInjectionTimeRef.current = Date.now();
    
    webViewRef.current.injectJavaScript(`
      (function() {
        if (window.__updateMediaConfig) {
          window.__updateMediaConfig(${JSON.stringify(config)});
          console.log('[MediaSim] Config injected from RN - devices:', ${activeTemplate.captureDevices.length});
        } else {
          console.warn('[MediaSim] __updateMediaConfig not available yet');
        }
      })();
      true;
    `);
  }, [activeTemplate, effectiveStealthMode]);

  const injectMediaConfig = useCallback(() => {
    if (!isMountedRef.current) {
      console.log('[App] Skipping debounced injection - component unmounted');
      return;
    }
    
    const now = Date.now();
    const timeSinceLastInjection = now - lastInjectionTimeRef.current;
    
    if (pendingInjectionRef.current) {
      clearTimeout(pendingInjectionRef.current);
      pendingInjectionRef.current = null;
    }
    
    if (timeSinceLastInjection < 300) {
      console.log('[App] Debouncing injection, last was', timeSinceLastInjection, 'ms ago');
      pendingInjectionRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          injectMediaConfigImmediate();
        }
        pendingInjectionRef.current = null;
      }, 300 - timeSinceLastInjection);
      return;
    }
    
    injectMediaConfigImmediate();
  }, [injectMediaConfigImmediate]);

  useEffect(() => {
    if (!isMountedRef.current) {
      console.log('[App] Skipping auto-inject - component not mounted');
      return;
    }
    if (isApplyingVideoRef.current) {
      console.log('[App] Skipping injectMediaConfig - apply in progress');
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !isApplyingVideoRef.current) {
        console.log('[App] Auto-injecting media config (activeTemplate changed or stealth changed)');
        injectMediaConfig();
      }
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [activeTemplate, effectiveStealthMode, injectMediaConfig]);

  // Safety: Reset stuck applying ref on mount and periodically
  useEffect(() => {
    const checkStuckRef = setInterval(() => {
      if (isApplyingVideoRef.current) {
        console.warn('[App] WARNING: isApplyingVideoRef has been true for interval check');
      }
    }, 5000);
    
    return () => clearInterval(checkStuckRef);
  }, []);

  useEffect(() => {
    if (!simulationActive) return;

    const preset = PATTERN_PRESETS[simConfig.pattern];
    const interval = setInterval(() => {
      timeRef.current += 0.05;
      const t = timeRef.current;
      const freq = preset.freq * simConfig.frequency;
      const intensity = simConfig.intensity;
      const noise = simConfig.noise;

      const addNoise = (val: number) => val + (Math.random() - 0.5) * noise * 2;

      const newAccel: AccelerometerData = {
        x: addNoise(preset.baseAccel.x + Math.sin(t * freq * 2 * Math.PI) * preset.accelAmplitude.x * intensity),
        y: addNoise(preset.baseAccel.y + Math.sin(t * freq * 2 * Math.PI + Math.PI / 3) * preset.accelAmplitude.y * intensity),
        z: addNoise(preset.baseAccel.z + Math.cos(t * freq * 2 * Math.PI) * preset.accelAmplitude.z * intensity),
      };

      const newGyro: GyroscopeData = {
        x: addNoise(preset.baseGyro.x + Math.sin(t * freq * 2 * Math.PI + Math.PI / 4) * preset.gyroAmplitude.x * intensity),
        y: addNoise(preset.baseGyro.y + Math.cos(t * freq * 2 * Math.PI) * preset.gyroAmplitude.y * intensity),
        z: addNoise(preset.baseGyro.z + Math.sin(t * freq * Math.PI) * preset.gyroAmplitude.z * intensity),
      };

      const newOrient: OrientationData = {
        alpha: (t * 20 * simConfig.frequency) % 360,
        beta: Math.sin(t * freq * Math.PI) * 30 * intensity,
        gamma: Math.cos(t * freq * Math.PI) * 20 * intensity,
      };

      setSimAccelData(newAccel);
      setSimGyroData(newGyro);
      setSimOrientData(newOrient);
      injectMotionData(newAccel, newGyro, newOrient, true);
    }, 50);

    return () => clearInterval(interval);
  }, [simulationActive, simConfig, injectMotionData]);

  useEffect(() => {
    if (useRealSensors && !simulationActive) {
      injectMotionData(realAccelData, realGyroData, realOrientData, true);
    }
  }, [useRealSensors, simulationActive, realAccelData, realGyroData, realOrientData, injectMotionData]);

  const toggleToolbar = useCallback(() => {
    setToolbarExpanded(prev => !prev);
  }, []);

  const toggleSimulation = useCallback(() => {
    if (!simulationActive) {
      timeRef.current = 0;
      setUseRealSensors(false);
    } else {
      injectMotionData(simAccelData, simGyroData, simOrientData, false);
    }
    setSimulationActive(!simulationActive);
  }, [simulationActive, simAccelData, simGyroData, simOrientData, injectMotionData]);

  const toggleRealSensors = useCallback(() => {
    if (!useRealSensors) {
      setSimulationActive(false);
    } else {
      injectMotionData(realAccelData, realGyroData, realOrientData, false);
    }
    setUseRealSensors(!useRealSensors);
  }, [useRealSensors, realAccelData, realGyroData, realOrientData, injectMotionData]);

  const runCompatibilityCheckAndApply = useCallback(async (video: SavedVideo, applyTarget: 'all' | string) => {
    console.log('[VideoSim] ========== START COMPATIBILITY CHECK ==========');
    console.log('[VideoSim] Video details:', {
      id: video.id,
      name: video.name,
      uri: video.uri,
      fileSize: video.fileSize,
      metadata: video.metadata,
    });
    console.log('[VideoSim] Apply target:', applyTarget);
    
    // Add timeout to prevent infinite hangs
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Compatibility check timed out after 30 seconds')), 30000);
    });
    
    try {
      console.log('[VideoSim] Setting up modal state...');
      setCheckingVideoName(video.name);
      setCompatibilityResult(null);
      setCompatibilityModalVisible(true);
      setIsCheckingCompatibility(true);
      setPendingSavedVideo(video);
      setPendingApplyTarget(applyTarget);
      console.log('[VideoSim] Modal state set successfully');
      
      console.log('[VideoSim] Calling checkCompatibility with video object directly...');
      const result = await Promise.race([
        checkCompatibility(video),
        timeoutPromise,
      ]);
      console.log('[VideoSim] checkCompatibility returned:', result ? 'result object' : 'null');
      
      console.log('[VideoSim] Updating state with result...');
      setIsCheckingCompatibility(false);
      setCompatibilityResult(result);
      
      if (result) {
        console.log('[VideoSim] Compatibility result details:', {
          overallStatus: result.overallStatus,
          score: result.score,
          readyForSimulation: result.readyForSimulation,
          itemCount: result.items?.length,
          modifications: result.modifications,
        });
      } else {
        console.error('[VideoSim] ERROR: checkCompatibility returned null!');
        // Still allow proceeding with a warning result
        setCompatibilityResult({
          overallStatus: 'warning',
          score: 50,
          items: [],
          summary: 'Could not fully analyze video. It may still work.',
          readyForSimulation: true,
          requiresModification: false,
          modifications: [],
        });
      }
      console.log('[VideoSim] ========== END COMPATIBILITY CHECK ==========');
    } catch (error) {
      console.error('[VideoSim] CRITICAL ERROR in runCompatibilityCheckAndApply:', error);
      console.error('[VideoSim] Error stack:', error instanceof Error ? error.stack : 'No stack');
      setIsCheckingCompatibility(false);
      
      // Provide a fallback result so the user can still try using the video
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      if (isTimeout) {
        console.log('[VideoSim] Timeout occurred, providing fallback result');
        setCompatibilityResult({
          overallStatus: 'warning',
          score: 50,
          items: [],
          summary: 'Analysis timed out. Video may still work - try applying it.',
          readyForSimulation: true,
          requiresModification: false,
          modifications: [],
        });
      } else {
        setCompatibilityResult(null);
        setCompatibilityModalVisible(false);
        setPendingSavedVideo(null);
        setPendingApplyTarget(null);
        Alert.alert('Error', `Failed to check video compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [checkCompatibility]);

  useEffect(() => {
    if (pendingVideoForApply && activeTemplate) {
      console.log('[VideoSim] ========== PENDING VIDEO EFFECT TRIGGERED ==========');
      console.log('[VideoSim] Timestamp:', new Date().toISOString());
      console.log('[VideoSim] Pending video from my-videos:', {
        name: pendingVideoForApply.name,
        id: pendingVideoForApply.id,
        uri: pendingVideoForApply.uri,
      });
      console.log('[VideoSim] Active template:', activeTemplate.id);
      console.log('[VideoSim] Current apply ref state:', isApplyingVideoRef.current);
      
      // Reset stuck ref if needed
      if (isApplyingVideoRef.current) {
        console.warn('[VideoSim] Resetting stuck isApplyingVideoRef before processing new video');
        isApplyingVideoRef.current = false;
      }
      
      // Capture video and clear pending immediately to prevent race conditions
      const videoToProcess = pendingVideoForApply;
      const templateId = activeTemplate.id;
      setPendingVideoForApply(null);
      
      // Video from my-videos is ALREADY compatibility checked - apply it directly
      // without opening another modal (which causes freeze due to modal conflicts)
      console.log('[VideoSim] Video already checked in my-videos, applying directly...');
      isApplyingVideoRef.current = true;
      
      // Use a longer delay to let the navigation animation complete first
      const timeoutId = setTimeout(async () => {
        try {
          console.log('[VideoSim] Applying video directly (skipping redundant check):', videoToProcess.name);
          console.log('[VideoSim] Timestamp:', new Date().toISOString());
          
          // Apply to all devices directly - no modal needed
          await assignVideoToAllDevices(templateId, videoToProcess.uri, videoToProcess.name, undefined, true);
          console.log('[VideoSim] Video applied successfully');
          
          isApplyingVideoRef.current = false;
          
          // Inject the updated config after a short delay
          setTimeout(() => {
            injectMediaConfig();
            console.log('[VideoSim] Media config injected after apply');
          }, 100);
          
          Alert.alert('Success', `Video "${videoToProcess.name}" applied to all cameras. Reload the page to see changes.`);
          console.log('[VideoSim] ========== PENDING VIDEO APPLY COMPLETE ==========');
        } catch (error) {
          console.error('[VideoSim] ERROR applying pending video:', error);
          console.error('[VideoSim] Error stack:', error instanceof Error ? error.stack : 'No stack');
          isApplyingVideoRef.current = false;
          Alert.alert('Error', `Failed to apply video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }, 350); // Longer delay to let modal dismiss animation complete
      
      return () => {
        clearTimeout(timeoutId);
        isApplyingVideoRef.current = false;
      };
    }
  }, [pendingVideoForApply, activeTemplate, setPendingVideoForApply, assignVideoToAllDevices, injectMediaConfig]);

  const handleApplyCompatibleVideo = useCallback(async () => {
    console.log('[VideoSim] ========== START APPLY VIDEO ==========');
    console.log('[VideoSim] Timestamp:', new Date().toISOString());
    console.log('[VideoSim] Apply state check:', {
      hasPendingSavedVideo: !!pendingSavedVideo,
      pendingVideoName: pendingSavedVideo?.name,
      pendingVideoUri: pendingSavedVideo?.uri,
      pendingApplyTarget,
      compatibilityReady: compatibilityResult?.readyForSimulation,
      hasActiveTemplate: !!activeTemplate,
      activeTemplateId: activeTemplate?.id,
      isApplyingVideoRefCurrent: isApplyingVideoRef.current,
    });
    
    if (!pendingSavedVideo || !pendingApplyTarget || !compatibilityResult?.readyForSimulation || !activeTemplate) {
      console.error('[VideoSim] Cannot apply video - validation failed:', {
        noPendingSavedVideo: !pendingSavedVideo,
        noPendingApplyTarget: !pendingApplyTarget,
        notReady: !compatibilityResult?.readyForSimulation,
        noActiveTemplate: !activeTemplate,
      });
      return;
    }
    
    // Prevent double-click
    if (isApplyingVideoRef.current) {
      console.warn('[VideoSim] Apply already in progress, ignoring duplicate call');
      return;
    }
    
    // Capture values before any state changes
    const videoToApply = pendingSavedVideo;
    const targetToApply = pendingApplyTarget;
    const templateId = activeTemplate.id;
    
    // Prevent double-injection by marking apply as in progress
    isApplyingVideoRef.current = true;
    console.log('[VideoSim] isApplyingVideoRef set to TRUE');
    
    // Close modal first to prevent UI freeze
    console.log('[VideoSim] Closing modal first to prevent freeze...');
    setCompatibilityModalVisible(false);
    
    // Clear pending state immediately to prevent re-triggers
    setPendingSavedVideo(null);
    setPendingApplyTarget(null);
    
    // Safety timeout to reset ref if something hangs
    const safetyTimeout = setTimeout(() => {
      if (isApplyingVideoRef.current) {
        console.error('[VideoSim] SAFETY TIMEOUT: Resetting isApplyingVideoRef after 15s');
        isApplyingVideoRef.current = false;
      }
    }, 15000);
    
    try {
      console.log('[VideoSim] Applying compatible video:', videoToApply.name);
      console.log('[VideoSim] Video URI:', videoToApply.uri);
      console.log('[VideoSim] Target:', targetToApply);
      
      // Allow UI to update before heavy operations
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('[VideoSim] UI tick complete, starting assignment...');
      
      if (targetToApply === 'all') {
        console.log('[VideoSim] Assigning to all devices...');
        await assignVideoToAllDevices(templateId, videoToApply.uri, videoToApply.name, undefined, true);
        console.log('[VideoSim] All devices assignment complete');
      } else {
        console.log('[VideoSim] Assigning to single device:', targetToApply);
        await assignVideoToDevice(templateId, targetToApply, videoToApply.uri, videoToApply.name);
        console.log('[VideoSim] Single device assignment complete');
      }
      
      clearTimeout(safetyTimeout);
      
      // Allow useEffect to handle injection now
      isApplyingVideoRef.current = false;
      console.log('[VideoSim] isApplyingVideoRef set to FALSE');
      
      // Defer the media config injection to next tick
      setTimeout(() => {
        console.log('[VideoSim] Injecting media config after apply...');
        injectMediaConfig();
        console.log('[VideoSim] Media config injected');
      }, 100);
      
      console.log('[VideoSim] ========== APPLY VIDEO SUCCESS ==========');
      Alert.alert('Success', `Video applied to ${targetToApply === 'all' ? 'all cameras' : 'device'}. Reload the page to see changes.`);
    } catch (error) {
      clearTimeout(safetyTimeout);
      console.error('[VideoSim] CRITICAL ERROR in handleApplyCompatibleVideo:', error);
      console.error('[VideoSim] Error stack:', error instanceof Error ? error.stack : 'No stack');
      isApplyingVideoRef.current = false;
      console.log('[VideoSim] isApplyingVideoRef reset to FALSE after error');
      Alert.alert('Error', `Failed to apply video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [pendingSavedVideo, pendingApplyTarget, compatibilityResult, activeTemplate, assignVideoToAllDevices, assignVideoToDevice, injectMediaConfig]);

  const pickMediaFromPhotos = useCallback(async (deviceId: string | null) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant media library access to upload files.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && activeTemplate) {
        const media = result.assets[0];
        const mediaUri = media.uri;
        const isVideo = media.type === 'video';
        const defaultExt = isVideo ? 'mp4' : 'jpg';
        const fileName = media.fileName || mediaUri.split('/').pop() || `uploaded_file.${defaultExt}`;
        
        console.log('[Media Upload] Saving video to library first:', fileName);
        setImportingVideoName(fileName);
        
        const savedVideo = await saveLocalVideo(mediaUri, fileName);
        
        setImportingVideoName('');
        clearProcessingState();
        
        if (!savedVideo) {
          Alert.alert('Error', 'Failed to save video to library. Please try again.');
          return;
        }
        
        console.log('[Media Upload] Video saved to library:', savedVideo.id);
        console.log('[Media Upload] Running compatibility check before applying...');
        
        const applyTarget = deviceId || 'all';
        runCompatibilityCheckAndApply(savedVideo, applyTarget);
      }
    } catch (error) {
      console.error('[Media Upload] Error picking file from photos:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  }, [activeTemplate, saveLocalVideo, runCompatibilityCheckAndApply, clearProcessingState]);

  const pickMediaFromFiles = useCallback(async (deviceId: string | null) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && activeTemplate) {
        const file = result.assets[0];
        const fileUri = file.uri;
        const fileName = file.name || fileUri.split('/').pop() || 'uploaded_file';
        const mimeType = file.mimeType || '';
        
        console.log('[Media Upload] Saving video from Files to library first:', fileName, 'mime:', mimeType);
        setImportingVideoName(fileName);
        
        const savedVideo = await saveLocalVideo(fileUri, fileName);
        
        setImportingVideoName('');
        clearProcessingState();
        
        if (!savedVideo) {
          Alert.alert('Error', 'Failed to save video to library. Please try again.');
          return;
        }
        
        console.log('[Media Upload] Video saved to library:', savedVideo.id);
        console.log('[Media Upload] Running compatibility check before applying...');
        
        const applyTarget = deviceId || 'all';
        runCompatibilityCheckAndApply(savedVideo, applyTarget);
      }
    } catch (error) {
      console.error('[Media Upload] Error picking file from Files:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  }, [activeTemplate, saveLocalVideo, runCompatibilityCheckAndApply, clearProcessingState]);

  const showMediaPickerOptions = useCallback((deviceId: string | null) => {
    Alert.alert(
      'Select Source',
      'Choose where to pick your video or photo from',
      [
        {
          text: 'Photos Library',
          onPress: () => pickMediaFromPhotos(deviceId),
        },
        {
          text: 'Files App',
          onPress: () => pickMediaFromFiles(deviceId),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, [pickMediaFromPhotos, pickMediaFromFiles]);

  const pickMediaForDevice = useCallback(async (deviceId: string) => {
    showMediaPickerOptions(deviceId);
  }, [showMediaPickerOptions]);

  const pickMediaForAllDevices = useCallback(async () => {
    showMediaPickerOptions(null);
  }, [showMediaPickerOptions]);

  const applyVideoUrlToDevice = useCallback(async (deviceId: string, url: string, autoEnableSim: boolean = false) => {
    if (url.trim() && activeTemplate) {
      await assignVideoToDevice(activeTemplate.id, deviceId, url.trim(), 'URL Video', autoEnableSim);
      Keyboard.dismiss();
      console.log('[App] Video assigned to device:', deviceId, 'autoEnableSim:', autoEnableSim);
    }
  }, [activeTemplate, assignVideoToDevice]);

  const applyVideoToAllDevices = useCallback(async (url: string, videoName: string, autoEnableSim: boolean = false) => {
    if (url.trim() && activeTemplate) {
      await assignVideoToAllDevices(activeTemplate.id, url.trim(), videoName, undefined, autoEnableSim);
      injectMediaConfig();
      console.log('[App] Video assigned to all devices, autoEnableSim:', autoEnableSim);
    }
  }, [activeTemplate, assignVideoToAllDevices, injectMediaConfig]);

  const handleToggleDeviceSimulation = useCallback(async (deviceId: string) => {
    if (activeTemplate) {
      await toggleDeviceSimulation(activeTemplate.id, deviceId);
      injectMediaConfig();
    }
  }, [activeTemplate, toggleDeviceSimulation, injectMediaConfig]);

  const handleClearDeviceVideo = useCallback(async (deviceId: string) => {
    if (activeTemplate) {
      await clearVideoFromDevice(activeTemplate.id, deviceId);
    }
  }, [activeTemplate, clearVideoFromDevice]);

  const forceHttps = useCallback((urlString: string): string => {
    if (urlString.toLowerCase().startsWith('http://')) {
      return 'https://' + urlString.substring(7);
    }
    return urlString;
  }, []);

  const normalizeUrl = useCallback((input: string): string => {
    let normalized = input.trim();
    if (!normalized.match(/^https?:\/\//i)) {
      if (normalized.includes('.') && !normalized.includes(' ')) {
        normalized = 'https://' + normalized;
      } else {
        normalized = 'https://www.google.com/search?q=' + encodeURIComponent(normalized);
      }
    }
    return forceHttps(normalized);
  }, [forceHttps]);

  const handleNavigate = useCallback(() => {
    Keyboard.dismiss();
    const normalizedUrl = normalizeUrl(inputUrl);
    setUrl(normalizedUrl);
    setInputUrl(normalizedUrl);
  }, [inputUrl, normalizeUrl]);

  const isWeb = Platform.OS === 'web';

  const requiresSetup = !isTemplateLoading && !hasMatchingTemplate && templates.filter(t => t.isComplete).length === 0;

  const getBeforeLoadScript = useCallback(() => {
    const devices = (activeTemplate?.captureDevices || []).map(d => {
      if (!d.assignedVideoUri) return d;
      return {
        ...d,
        assignedVideoUri: formatVideoUriForWebView(d.assignedVideoUri),
      };
    });
    const spoofScript = safariModeEnabled ? SAFARI_SPOOFING_SCRIPT : NO_SPOOFING_SCRIPT;
    const script =
      CONSOLE_CAPTURE_SCRIPT +
      spoofScript +
      createMediaInjectionScript(devices, effectiveStealthMode) +
      VIDEO_SIMULATION_TEST_SCRIPT;
    console.log('[App] Preparing before-load script with', devices.length, 'devices, stealth:', effectiveStealthMode);
    return script;
  }, [activeTemplate, safariModeEnabled, effectiveStealthMode]);

  const getAfterLoadScript = useCallback(() => {
    return MOTION_INJECTION_SCRIPT;
  }, []);

  const toggleSafariMode = useCallback(() => {
    setSafariModeEnabled(prev => !prev);
    setTimeout(() => {
      webViewRef.current?.reload();
    }, 100);
  }, []);

  const handleTestWebcam = useCallback(() => {
    const testUrl = APP_CONFIG.WEBVIEW.TEST_URL;
    setUrl(testUrl);
    setInputUrl(testUrl);
    console.log('[App] Navigating to webcam test:', testUrl);
  }, []);



  const handleSaveWebsiteSettings = useCallback(async (siteUrl: string, settings: { useStealthByDefault: boolean; applyToSubdomains: boolean }) => {
    await saveWebsiteSettings(siteUrl, settings);
    console.log('[App] Website settings saved for:', siteUrl);
  }, [saveWebsiteSettings]);

  const handleDeleteWebsiteSettings = useCallback(async (id: string) => {
    await deleteWebsiteSettings(id);
    console.log('[App] Website settings deleted:', id);
  }, [deleteWebsiteSettings]);

  if (requiresSetup) {
    return (
      <SetupRequired
        currentDeviceInfo={currentDeviceInfo}
        templates={templates}
        isLoading={isTemplateLoading}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <BrowserHeader
            inputUrl={inputUrl}
            setInputUrl={setInputUrl}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            safariModeEnabled={safariModeEnabled}
            onGoBack={() => webViewRef.current?.goBack()}
            onGoForward={() => webViewRef.current?.goForward()}
            onReload={() => webViewRef.current?.reload()}
            onToggleSafariMode={toggleSafariMode}
            onSettings={() => router.push('/device-check')}
            onNavigate={handleNavigate}
            onTestWebcam={handleTestWebcam}
          />

          <View style={styles.webViewContainer}>
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#00ff88" />
              </View>
            )}
            {isWeb ? (
              <View style={styles.greenScreen} />
            ) : (
              <WebView
                ref={webViewRef}
                source={{ uri: url }}
                style={styles.webView}
                userAgent={safariModeEnabled ? SAFARI_USER_AGENT : undefined}
                injectedJavaScriptBeforeContentLoaded={getBeforeLoadScript()}
                injectedJavaScript={getAfterLoadScript()}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => {
                  setIsLoading(false);
                  setTimeout(() => {
                    injectMediaConfig();
                    console.log('[App] WebView loaded, media config injected');
                  }, 100);
                }}
                onNavigationStateChange={(navState) => {
                  setCanGoBack(navState.canGoBack);
                  setCanGoForward(navState.canGoForward);
                  
                  if (navState.url) {
                    const httpsUrl = forceHttps(navState.url);
                    setInputUrl(httpsUrl);
                    if (navState.url !== httpsUrl) {
                      setUrl(httpsUrl);
                    }
                  }
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'console') {
                      const logLevel = data.level || 'log';
                      const timestamp = new Date().toISOString();
                      console.log(`[WebView ${logLevel.toUpperCase()}] [${timestamp}]`, data.message);
                    } else if (data.type === 'error') {
                      console.error('[WebView ERROR]', data.message, data.stack || '');
                    } else if (data.type === 'mediaAccess') {
                      console.log('[WebView Media Access]', data.device, data.action);
                    } else if (data.type === 'videoError') {
                      console.error('[WebView Video Error]', data.payload?.error?.message);
                      const errorMsg = data.payload?.error?.message || 'Video failed to load';
                      const solution = data.payload?.error?.solution || 'Try uploading the video from your device instead';
                      Alert.alert(
                        'Video Load Failed',
                        `${errorMsg}\n\n${solution}`,
                        [
                          { text: 'Upload from Device', onPress: () => setShowDevicesModal(true) },
                          { text: 'OK', style: 'cancel' }
                        ]
                      );
                    } else if (data.type === 'streamHealth') {
                      if (!data.payload?.healthy) {
                        console.warn('[WebView Stream Health] Degraded FPS:', data.payload?.fps);
                      }
                    }
                  } catch {
                    console.log('[WebView Raw Message]', event.nativeEvent.data);
                  }
                }}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('[WebView Load Error]', nativeEvent.description || nativeEvent);
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('[WebView HTTP Error]', nativeEvent.statusCode, nativeEvent.url);
                }}
                onShouldStartLoadWithRequest={(request) => {
                  if (request.url.toLowerCase().startsWith('http://')) {
                    const httpsUrl = forceHttps(request.url);
                    setUrl(httpsUrl);
                    setInputUrl(httpsUrl);
                    return false;
                  }
                  return true;
                }}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                originWhitelist={['*']}
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                cacheEnabled
                allowsBackForwardNavigationGestures
                contentMode="mobile"
                applicationNameForUserAgent="Safari/604.1"
                allowFileAccess={Platform.OS === 'android'}
                allowFileAccessFromFileURLs={Platform.OS === 'android'}
                allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
                mixedContentMode={Platform.OS === 'android' ? 'always' : undefined}
              />
            )}
          </View>

          <ControlToolbar
            isExpanded={toolbarExpanded}
            onToggleExpanded={toggleToolbar}
            activeTemplate={activeTemplate}
            stealthMode={stealthMode}
            isSimulating={simulatingDevicesCount > 0}
            simulatingDevicesCount={simulatingDevicesCount}
            activeCamerasCount={activeTemplate?.captureDevices.length || 0}
            currentUrl={url}
            currentWebsiteSettings={currentWebsiteSettings}
            onStealthModeToggle={toggleStealthMode}
            onOpenDevices={() => setShowDevicesModal(true)}

            onOpenSiteSettings={() => setShowSiteSettingsModal(true)}
            simulationActive={simulationActive}
            useRealSensors={useRealSensors}
            accelData={accelData}
            gyroData={gyroData}
            simConfig={simConfig}
            onToggleSimulation={toggleSimulation}
            onToggleRealSensors={toggleRealSensors}
            onSetSimConfig={setSimConfig}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TemplateModal
        visible={showTemplateModal}
        templates={templates}
        activeTemplateId={activeTemplate?.id || null}
        onClose={() => setShowTemplateModal(false)}
        onSelect={setActiveTemplate}
        onCreateNew={() => router.push('/device-check')}
      />

      <Modal
        visible={showDevicesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDevicesModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Camera Devices</Text>
              <TouchableOpacity onPress={() => setShowDevicesModal(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DevicesList
              activeTemplate={activeTemplate}
              autoAcceptPermissions={autoAcceptPermissions}
              stealthMode={effectiveStealthMode}
              onAutoAcceptToggle={() => setAutoAcceptPermissions(!autoAcceptPermissions)}
              onStealthModeToggle={toggleStealthMode}
              onTemplateHeaderPress={() => {
                setShowDevicesModal(false);
                setShowTemplateModal(true);
              }}
              onDeviceCheckPress={() => {
                setShowDevicesModal(false);
                router.push('/device-check');
              }}
              onOpenMyVideos={() => {
                // Avoid stacking a router modal on top of an RN Modal (can cause freezes on dismiss)
                setShowDevicesModal(false);
                requestAnimationFrame(() => {
                  setTimeout(() => router.push('/my-videos'), 0);
                });
              }}
              onPickVideo={pickMediaForDevice}
              onPickVideoForAll={pickMediaForAllDevices}
              onApplyVideoUrl={applyVideoUrlToDevice}
              onApplyVideoToAll={applyVideoToAllDevices}
              onRestartRequired={() => {
                console.log('[App] Restart required - reloading WebView with updated config');
                setTimeout(() => {
                  webViewRef.current?.reload();
                }, 50);
              }}
              onToggleDeviceSimulation={handleToggleDeviceSimulation}
              onClearDeviceVideo={handleClearDeviceVideo}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>



      <SiteSettingsModal
        visible={showSiteSettingsModal}
        currentUrl={url}
        currentSettings={currentWebsiteSettings}
        globalStealthMode={stealthMode}
        allSiteSettings={websiteSettings}
        onClose={() => setShowSiteSettingsModal(false)}
        onSave={handleSaveWebsiteSettings}
        onDelete={handleDeleteWebsiteSettings}
      />

      <CompatibilityCheckModal
        visible={compatibilityModalVisible}
        onClose={() => {
          setCompatibilityModalVisible(false);
          setPendingSavedVideo(null);
          setPendingApplyTarget(null);
        }}
        result={compatibilityResult}
        isChecking={isCheckingCompatibility}
        videoName={checkingVideoName}
        onApply={compatibilityResult?.readyForSimulation ? handleApplyCompatibleVideo : undefined}
      />

      <ImportProgressModal
        visible={processingState.isProcessing && processingState.stage !== 'complete'}
        progress={{
          progress: processingState.progress,
          stage: processingState.stage as ImportProgress['stage'],
          message: processingState.message,
        }}
        videoName={importingVideoName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  greenScreen: {
    flex: 1,
    backgroundColor: '#00FF00',
    aspectRatio: 9 / 16,
    alignSelf: 'center',
    maxHeight: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#00ff88',
  },
});
