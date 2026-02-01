import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text,
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
  UIManager,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';

import { useAccelerometer, useGyroscope, useOrientation, AccelerometerData, GyroscopeData, OrientationData } from '@/hooks/useMotionSensors';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useProtocol } from '@/contexts/ProtocolContext';
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
import { isBundledSampleVideo } from '@/utils/sampleVideo';
import { APP_CONFIG } from '@/constants/app';
import type { SimulationConfig } from '@/types/browser';
import BrowserHeader from '@/components/browser/BrowserHeader';
import DevicesList from '@/components/browser/DevicesList';
import TemplateModal from '@/components/browser/TemplateModal';
import TestingWatermark from '@/components/TestingWatermark';

import ControlToolbar, { SiteSettingsModal } from '@/components/browser/ControlToolbar';
import { ProtocolSettingsModal } from '@/components/browser/modals';
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

  const {
    savedVideos,
    isVideoReady,
    pendingVideoForApply,
    setPendingVideoForApply,
  } = useVideoLibrary();


  

  
  // Protocol Context for allowlist and presentation mode
  const {
    developerModeEnabled,
    presentationMode,
    showTestingWatermark,
    activeProtocol,
    protocols,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    codexSettings,
    isAllowlisted: checkIsAllowlisted,
    httpsEnforced,
    mlSafetyEnabled,
    addAllowlistDomain,
    removeAllowlistDomain,
    updateAllowlistSettings,
  } = useProtocol();

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

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [safariModeEnabled, setSafariModeEnabled] = useState(true);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  const [showSiteSettingsModal, setShowSiteSettingsModal] = useState(false);
  const [showProtocolSettingsModal, setShowProtocolSettingsModal] = useState(false);

  const isProtocolEnabled = useMemo(
    () => protocols[activeProtocol]?.enabled ?? true,
    [protocols, activeProtocol]
  );

  const codexModeActive = activeProtocol === 'gpt52' && isProtocolEnabled;

  // Use protocol context for allowlist (only when allowlist protocol is active/enabled)
  const allowlistModeActive = activeProtocol === 'allowlist' && (protocols.allowlist?.enabled ?? true);
  const allowlistEnabled = allowlistModeActive && allowlistSettings.enabled;
  const allowedDomains = allowlistSettings.domains;

  const compatibleVideos = useMemo(() => {
    return savedVideos.filter(video => {
      const status = video.compatibility?.overallStatus;
      const isFullyCompatible = status === 'perfect' || status === 'compatible';
      return isFullyCompatible && isVideoReady(video.id);
    });
  }, [savedVideos, isVideoReady]);

  const bundledSampleVideo = useMemo(() => {
    return compatibleVideos.find(isBundledSampleVideo) || null;
  }, [compatibleVideos]);

  const protectedReplacementVideo = useMemo(() => {
    if (!protectedSettings.replacementVideoId) return null;
    return compatibleVideos.find(video => video.id === protectedSettings.replacementVideoId) || null;
  }, [compatibleVideos, protectedSettings.replacementVideoId]);

  const fallbackVideo = useMemo(() => {
    if (activeProtocol === 'protected' && protectedReplacementVideo) {
      return protectedReplacementVideo;
    }
    return bundledSampleVideo || compatibleVideos[0] || null;
  }, [activeProtocol, protectedReplacementVideo, bundledSampleVideo, compatibleVideos]);

  const fallbackVideoUri = useMemo(() => {
    return fallbackVideo ? formatVideoUriForWebView(fallbackVideo.uri) : null;
  }, [fallbackVideo]);

  const accelData = simulationActive ? simAccelData : realAccelData;
  const gyroData = simulationActive ? simGyroData : realGyroData;

  const handleAddAllowlistDomain = useCallback((value: string) => {
    addAllowlistDomain(value);
  }, [addAllowlistDomain]);

  const handleRemoveAllowlistDomain = useCallback((domain: string) => {
    removeAllowlistDomain(domain);
  }, [removeAllowlistDomain]);

  const currentWebsiteSettings = useMemo(() => 
    getWebsiteSettings(url),
    [getWebsiteSettings, url]
  );

  const currentHostname = useMemo(() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }, [url]);

  const isAllowlisted = useMemo(() => {
    return checkIsAllowlisted(currentHostname);
  }, [checkIsAllowlisted, currentHostname]);

  const allowlistStatusLabel = useMemo(() => {
    if (!allowlistModeActive) return 'Allowlist: Off';
    if (!allowlistSettings.enabled) return 'Allowlist: Disabled';
    if (allowedDomains.length === 0) {
      return allowlistSettings.blockUnlisted
        ? 'Allowlist: On (no domains)'
        : 'Allowlist: On (monitoring)';
    }
    if (isAllowlisted) return 'Allowlist: On (site allowed)';
    return allowlistSettings.blockUnlisted
      ? 'Allowlist: On (site blocked)'
      : 'Allowlist: On (site not listed)';
  }, [
    allowlistModeActive,
    allowlistSettings.enabled,
    allowedDomains.length,
    isAllowlisted,
    allowlistSettings.blockUnlisted,
  ]);

  const allowlistBlocked = allowlistEnabled && allowlistSettings.blockUnlisted && !isAllowlisted;

  useEffect(() => {
    if (!allowlistEnabled || !allowlistSettings.autoAddCurrentSite) return;
    if (!currentHostname || isAllowlisted) return;
    addAllowlistDomain(currentHostname);
  }, [
    allowlistEnabled,
    allowlistSettings.autoAddCurrentSite,
    currentHostname,
    isAllowlisted,
    addAllowlistDomain,
  ]);

  const effectiveStealthMode = useMemo(() => {
    if (activeProtocol === 'protected' || activeProtocol === 'harness') {
      return true;
    }
    if (activeProtocol === 'gpt52') {
      if (codexSettings.forceStealth) {
        return true;
      }
    }
    if (!standardSettings.stealthByDefault) {
      return false;
    }
    if (!standardSettings.respectSiteSettings) {
      return true;
    }
    return shouldUseStealthForUrl(url);
  }, [
    activeProtocol,
    codexSettings.forceStealth,
    standardSettings.stealthByDefault,
    standardSettings.respectSiteSettings,
    shouldUseStealthForUrl,
    url,
  ]);

  const protocolForceSimulation = isProtocolEnabled && (
    activeProtocol === 'protected'
    || (activeProtocol === 'harness' && harnessSettings.overlayEnabled)
    || (activeProtocol === 'gpt52' && codexSettings.forceSimulation)
  );

  const protocolMirrorVideo = isProtocolEnabled && activeProtocol === 'harness' && harnessSettings.mirrorVideo;

  const adaptiveQualityEnabled = codexModeActive && codexSettings.adaptiveQuality;
  const maxRetryAttempts = codexModeActive && codexSettings.aggressiveRetries ? 8 : 4;
  const videoLoadTimeoutMs = codexModeActive && codexSettings.aggressiveRetries ? 16000 : 12000;

  const protocolOverlayLabel = useMemo(() => {
    if (!isProtocolEnabled) {
      return '';
    }
    if (activeProtocol === 'protected') {
      return 'Protected Replacement Active';
    }
    if (activeProtocol === 'harness') {
      return harnessSettings.overlayEnabled ? 'Harness Overlay Active' : 'Harness Ready';
    }
    if (activeProtocol === 'gpt52') {
      return codexSettings.showOverlayLabel ? 'GPT-5.2 Codex High Active' : '';
    }
    if (activeProtocol === 'allowlist' && allowlistEnabled) {
      return allowlistBlocked ? 'Allowlist Blocked' : 'Allowlist Active';
    }
    return '';
  }, [
    activeProtocol,
    harnessSettings.overlayEnabled,
    codexSettings.showOverlayLabel,
    allowlistEnabled,
    allowlistBlocked,
    isProtocolEnabled,
  ]);

  const showProtocolOverlayLabel = useMemo(() => {
    if (!isProtocolEnabled) {
      return false;
    }
    if (activeProtocol === 'protected') {
      return protectedSettings.showProtectedBadge;
    }
    if (activeProtocol === 'harness') {
      return harnessSettings.showDebugInfo || harnessSettings.overlayEnabled;
    }
    if (activeProtocol === 'gpt52') {
      return codexSettings.showOverlayLabel;
    }
    return false;
  }, [
    activeProtocol,
    protectedSettings.showProtectedBadge,
    harnessSettings.showDebugInfo,
    harnessSettings.overlayEnabled,
    codexSettings.showOverlayLabel,
    isProtocolEnabled,
  ]);

  const autoInjectEnabled = isProtocolEnabled && (
    (activeProtocol === 'standard' || activeProtocol === 'allowlist' || activeProtocol === 'gpt52')
      ? standardSettings.autoInject
      : true
  );

  const simulatingDevicesCount = useMemo(() =>
    activeTemplate?.captureDevices.filter(d => d.simulationEnabled).length || 0,
    [activeTemplate]
  );

  const injectMotionData = useCallback((accel: AccelerometerData, gyro: GyroscopeData, orient: OrientationData, active: boolean) => {
    if (!standardSettings.injectMotionData) return;
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
  }, [standardSettings.injectMotionData]);

  const injectMediaConfigImmediate = useCallback(() => {
    if (!webViewRef.current || !activeTemplate || !isMountedRef.current) {
      console.log('[App] Skipping injection - not ready:', {
        hasWebView: !!webViewRef.current,
        hasTemplate: !!activeTemplate,
        isMounted: isMountedRef.current,
      });
      return;
    }

    if (!isProtocolEnabled) {
      console.log('[App] Protocol disabled - injection skipped:', activeProtocol);
      return;
    }

    if (allowlistBlocked) {
      console.log('[App] Allowlist mode active - injection disabled for:', currentHostname || url);
      return;
    }

    const normalizedDevices = activeTemplate.captureDevices.map(d => {
      const assignedUri = d.assignedVideoUri
        ? formatVideoUriForWebView(d.assignedVideoUri)
        : null;
      const resolvedUri = assignedUri || fallbackVideoUri || undefined;
      return {
        ...d,
        assignedVideoUri: resolvedUri,
        assignedVideoName: d.assignedVideoName || fallbackVideo?.name,
      };
    });

    const config = {
      stealthMode: effectiveStealthMode,
      devices: normalizedDevices,
      fallbackVideoUri,
      forceSimulation: protocolForceSimulation,
      protocolId: activeProtocol,
      overlayLabelText: protocolOverlayLabel,
      showOverlayLabel: showProtocolOverlayLabel,
      loopVideo: standardSettings.loopVideo,
      mirrorVideo: protocolMirrorVideo,
      adaptiveQuality: adaptiveQualityEnabled,
      maxRetryAttempts,
      videoLoadTimeoutMs,
      debugEnabled: developerModeEnabled,
    };

    console.log('[App] Injecting media config:', {
      stealthMode: effectiveStealthMode,
      deviceCount: activeTemplate.captureDevices.length,
      simulatingDevices: activeTemplate.captureDevices.filter(d => d.simulationEnabled && d.assignedVideoUri).map(d => d.name),
      protocol: activeProtocol,
      fallback: fallbackVideo?.name || 'none',
    });
    
    lastInjectionTimeRef.current = Date.now();
    
    const fallbackScript = createMediaInjectionScript(normalizedDevices, {
      stealthMode: effectiveStealthMode,
      fallbackVideoUri,
      forceSimulation: protocolForceSimulation,
      protocolId: activeProtocol,
      protocolLabel: protocolOverlayLabel,
      showOverlayLabel: showProtocolOverlayLabel,
      loopVideo: standardSettings.loopVideo,
      mirrorVideo: protocolMirrorVideo,
      adaptiveQuality: adaptiveQualityEnabled,
      maxRetryAttempts,
      videoLoadTimeoutMs,
      debugEnabled: developerModeEnabled,
    });

    webViewRef.current.injectJavaScript(`
      (function() {
        if (window.__updateMediaConfig) {
          window.__updateMediaConfig(${JSON.stringify(config)});
          console.log('[MediaSim] Config injected from RN - devices:', ${activeTemplate.captureDevices.length});
        } else {
          ${fallbackScript}
        }
      })();
      true;
    `);
  }, [
    activeTemplate,
    effectiveStealthMode,
    allowlistBlocked,
    currentHostname,
    url,
    fallbackVideoUri,
    fallbackVideo?.name,
    protocolForceSimulation,
    activeProtocol,
    isProtocolEnabled,
    protocolOverlayLabel,
    showProtocolOverlayLabel,
    standardSettings.loopVideo,
    protocolMirrorVideo,
    adaptiveQualityEnabled,
    maxRetryAttempts,
    videoLoadTimeoutMs,
    developerModeEnabled,
  ]);

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
    if (!autoInjectEnabled) {
      return;
    }
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
  }, [activeTemplate, effectiveStealthMode, injectMediaConfig, autoInjectEnabled]);

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
    if (!standardSettings.injectMotionData) return;
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
  }, [simulationActive, simConfig, injectMotionData, standardSettings.injectMotionData]);

  useEffect(() => {
    if (!allowlistModeActive) {
      return;
    }
    if (webViewRef.current) {
      console.log('[App] Allowlist settings changed, reloading WebView');
      webViewRef.current.reload();
    }
  }, [allowlistModeActive, allowlistSettings.enabled, allowlistSettings.domains]);

  useEffect(() => {
    if (!standardSettings.injectMotionData) return;
    if (useRealSensors && !simulationActive) {
      injectMotionData(realAccelData, realGyroData, realOrientData, true);
    }
  }, [useRealSensors, simulationActive, realAccelData, realGyroData, realOrientData, injectMotionData, standardSettings.injectMotionData]);

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

  const applySavedVideoToDevice = useCallback(async (deviceId: string, video: SavedVideo) => {
    if (activeTemplate) {
      await assignVideoToDevice(activeTemplate.id, deviceId, video.uri, video.name, true);
      injectMediaConfig();
      console.log('[App] Compatible video assigned to device:', deviceId, video.name);
    }
  }, [activeTemplate, assignVideoToDevice, injectMediaConfig]);

  const applySavedVideoToAll = useCallback(async (video: SavedVideo) => {
    if (activeTemplate) {
      await assignVideoToAllDevices(activeTemplate.id, video.uri, video.name, undefined, true);
      injectMediaConfig();
      console.log('[App] Compatible video assigned to all devices:', video.name);
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
    if (!httpsEnforced) {
      return urlString;
    }
    if (urlString.toLowerCase().startsWith('http://')) {
      return 'https://' + urlString.substring(7);
    }
    return urlString;
  }, [httpsEnforced]);

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
  const webViewAvailable = !isWeb && Boolean(
    UIManager.getViewManagerConfig?.('RNCWebView') ||
    UIManager.getViewManagerConfig?.('RCTWebView')
  );
  const webViewOriginWhitelist = useMemo(() => {
    const origins = httpsEnforced ? ['https://*'] : ['https://*', 'http://*'];
    return [...origins, 'about:blank', 'blob:*', 'data:*'];
  }, [httpsEnforced]);
  const allowLocalFileAccess = Platform.OS === 'android' && isProtocolEnabled && !allowlistBlocked;
  const mixedContentMode = Platform.OS === 'android'
    ? (httpsEnforced ? 'never' : 'always')
    : undefined;

  const requiresSetup = !isTemplateLoading && !hasMatchingTemplate && templates.filter(t => t.isComplete).length === 0;

  const getBeforeLoadScript = useCallback(() => {
    const devices = (activeTemplate?.captureDevices || []).map(d => {
      const assignedUri = d.assignedVideoUri
        ? formatVideoUriForWebView(d.assignedVideoUri)
        : null;
      const resolvedUri = assignedUri || fallbackVideoUri || undefined;
      return {
        ...d,
        assignedVideoUri: resolvedUri,
        assignedVideoName: d.assignedVideoName || fallbackVideo?.name,
      };
    });
    const spoofScript = safariModeEnabled ? SAFARI_SPOOFING_SCRIPT : NO_SPOOFING_SCRIPT;
    const shouldInjectMedia = isProtocolEnabled && !allowlistBlocked;
    const injectionOptions = {
      stealthMode: effectiveStealthMode,
      fallbackVideoUri,
      forceSimulation: protocolForceSimulation,
      protocolId: activeProtocol,
      protocolLabel: protocolOverlayLabel,
      showOverlayLabel: showProtocolOverlayLabel,
      loopVideo: standardSettings.loopVideo,
      mirrorVideo: protocolMirrorVideo,
      adaptiveQuality: adaptiveQualityEnabled,
      maxRetryAttempts,
      videoLoadTimeoutMs,
      debugEnabled: developerModeEnabled,
    };
    const script =
      CONSOLE_CAPTURE_SCRIPT +
      spoofScript +
      (shouldInjectMedia ? createMediaInjectionScript(devices, injectionOptions) : '') +
      VIDEO_SIMULATION_TEST_SCRIPT;
    console.log('[App] Preparing before-load script with', {
      devices: devices.length,
      stealth: effectiveStealthMode,
      allowlisted: shouldInjectMedia,
      protocol: activeProtocol,
      fallback: fallbackVideo?.name || 'none',
    });
    return script;
  }, [
    activeTemplate,
    safariModeEnabled,
    effectiveStealthMode,
    allowlistBlocked,
    fallbackVideoUri,
    fallbackVideo?.name,
    protocolForceSimulation,
    activeProtocol,
    protocolOverlayLabel,
    showProtocolOverlayLabel,
    standardSettings.loopVideo,
    protocolMirrorVideo,
    adaptiveQualityEnabled,
    maxRetryAttempts,
    videoLoadTimeoutMs,
    developerModeEnabled,
    isProtocolEnabled,
  ]);

  const getAfterLoadScript = useCallback(() => {
    return standardSettings.injectMotionData ? MOTION_INJECTION_SCRIPT : '';
  }, [standardSettings.injectMotionData]);

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

  const handleOpenInBrowser = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unsupported URL', 'This device cannot open the URL.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('[App] Failed to open browser:', error);
      Alert.alert('Error', 'Unable to open the browser.');
    }
  }, [url]);



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
      
      {/* Testing Watermark */}
      <TestingWatermark 
        visible={showTestingWatermark && !presentationMode}
        position="top-right"
        variant="minimal"
        showPulse={true}
      />
      
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
            ) : !webViewAvailable ? (
              <View style={styles.webViewFallback}>
                <Text style={styles.webViewFallbackTitle}>WebView unavailable</Text>
                <Text style={styles.webViewFallbackText}>
                  Expo Snack does not include the native WebView module by default. Open the
                  target URL in your browser to continue testing.
                </Text>
                <TouchableOpacity style={styles.webViewFallbackButton} onPress={handleOpenInBrowser}>
                  <Text style={styles.webViewFallbackButtonText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
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
                    if (autoInjectEnabled) {
                      injectMediaConfig();
                      console.log('[App] WebView loaded, media config injected');
                    }
                  }, 100);
                }}
                onNavigationStateChange={(navState) => {
                  setCanGoBack(navState.canGoBack);
                  setCanGoForward(navState.canGoForward);
                  
                  if (navState.url) {
                    const normalizedUrl = httpsEnforced ? forceHttps(navState.url) : navState.url;
                    setInputUrl(normalizedUrl);
                    if (httpsEnforced && navState.url !== normalizedUrl) {
                      setUrl(normalizedUrl);
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
                    } else if (data.type === 'mediaInjectionReady') {
                      console.log('[WebView Injection Ready]', data.payload);
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
                  if (httpsEnforced && request.url.toLowerCase().startsWith('http://')) {
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
                originWhitelist={webViewOriginWhitelist}
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                cacheEnabled
                allowsBackForwardNavigationGestures
                contentMode="mobile"
                applicationNameForUserAgent="Safari/604.1"
                allowFileAccess={allowLocalFileAccess}
                allowFileAccessFromFileURLs={allowLocalFileAccess}
                allowUniversalAccessFromFileURLs={allowLocalFileAccess}
                mixedContentMode={mixedContentMode}
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
            onOpenMyVideos={() => router.push('/my-videos')}
            onOpenProtocols={() => setShowProtocolSettingsModal(true)}

            onOpenSiteSettings={() => setShowSiteSettingsModal(true)}
            allowlistStatusLabel={allowlistStatusLabel}
            allowlistBlocked={allowlistBlocked}
            protocolEnabled={isProtocolEnabled}
            simulationActive={simulationActive}
            useRealSensors={useRealSensors}
            accelData={accelData}
            gyroData={gyroData}
            simConfig={simConfig}
            onToggleSimulation={toggleSimulation}
            onToggleRealSensors={toggleRealSensors}
            onSetSimConfig={setSimConfig}
            onApplyVideoToDevice={applySavedVideoToDevice}
            onApplyVideoToAll={applySavedVideoToAll}
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
              stealthMode={effectiveStealthMode}
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

      <ProtocolSettingsModal
        visible={showProtocolSettingsModal}
        currentHostname={currentHostname}
        onClose={() => setShowProtocolSettingsModal(false)}
      />

      {/* Testing Watermark Overlay */}
      <TestingWatermark
        visible={showTestingWatermark && presentationMode}
        mlSafetyEnabled={mlSafetyEnabled}
        httpsEnforced={httpsEnforced}
        protocolName={protocols[activeProtocol]?.name?.replace('Protocol ', 'P')}
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
  webViewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#111111',
  },
  webViewFallbackTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
    textAlign: 'center',
  },
  webViewFallbackText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  webViewFallbackButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  webViewFallbackButtonText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '600' as const,
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
