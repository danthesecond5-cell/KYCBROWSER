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
import type { ProtocolType } from '@/contexts/ProtocolContext';
import type { SavedVideo } from '@/utils/videoManager';
import { PATTERN_PRESETS } from '@/constants/motionPatterns';
import { 
  SAFARI_USER_AGENT, 
  SAFARI_SPOOFING_SCRIPT, 
  NO_SPOOFING_SCRIPT, 
  MOTION_INJECTION_SCRIPT,
  CONSOLE_CAPTURE_SCRIPT,
  MEDIARECORDER_POLYFILL_SCRIPT,
  VIDEO_SIMULATION_TEST_SCRIPT,
  createMediaInjectionScript,
  createProtocol0Script,
  createWebSocketInjectionScript,
  createWorkingInjectionScript,
} from '@/constants/browserScripts';
import { createAdvancedProtocol2Script } from '@/utils/advancedProtocol/browserScript';
import { createWebRtcLoopbackInjectionScript } from '@/constants/webrtcLoopback';
import { WebRtcLoopbackBridge } from '@/utils/webrtcLoopbackBridge';
import { NATIVE_WEBRTC_BRIDGE_SCRIPT } from '@/constants/nativeWebRTCBridge';
import { clearAllDebugLogs } from '@/utils/logger';
import { NativeWebRTCBridge } from '@/utils/nativeWebRTCBridge';
import {
  formatVideoUriForWebView,
  getDefaultFallbackVideoUri,
  isBase64VideoUri,
  isBlobUri,
  isLocalFileUri,
} from '@/utils/videoServing';
import { isBundledSampleVideo } from '@/utils/sampleVideo';
import {
  handleNativeGumOffer,
  handleNativeGumIceCandidate,
  closeNativeGumSession,
} from '@/utils/nativeMediaBridge';
import { APP_CONFIG } from '@/constants/app';
import type { SimulationConfig } from '@/types/browser';
import BrowserHeader from '@/components/browser/BrowserHeader';
import DevicesList from '@/components/browser/DevicesList';
import TemplateModal from '@/components/browser/TemplateModal';
import TestingWatermark from '@/components/TestingWatermark';

import ControlToolbar, { SiteSettingsModal } from '@/components/browser/ControlToolbar';
import { ProtocolSettingsModal, PermissionRequestModal } from '@/components/browser/modals';
import SetupRequired from '@/components/SetupRequired';

type CameraPermissionRequest = {
  requestId: string;
  url?: string;
  origin?: string;
  wantsVideo: boolean;
  wantsAudio: boolean;
  requestedFacing?: string | null;
  requestedDeviceId?: string | null;
};

type PermissionAction = 'simulate' | 'real' | 'deny';

export default function MotionBrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const webrtcLoopbackBridge = useMemo(() => new WebRtcLoopbackBridge(), []);

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
  
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (enterpriseWebKitRef.current !== enterpriseWebKitEnabled) {
      enterpriseWebKitRef.current = enterpriseWebKitEnabled;
      console.log('[App] Enterprise WebKit toggled - reloading WebView');
      setWebViewKey(prev => prev + 1);
    }
  }, [enterpriseWebKitEnabled]);

  useEffect(() => {
    nativeBridgeRef.current = new NativeWebRTCBridge(webViewRef);
    return () => {
      nativeBridgeRef.current?.dispose();
      nativeBridgeRef.current = null;
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
    setActiveProtocol,
    protocols,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    webrtcLoopbackSettings,
    isAllowlisted: checkIsAllowlisted,
    httpsEnforced,
    mlSafetyEnabled,
    enterpriseWebKitEnabled,
  } = useProtocol();

  useEffect(() => {
    webrtcLoopbackBridge.setWebViewRef(webViewRef);
  }, [webrtcLoopbackBridge]);

  useEffect(() => {
    webrtcLoopbackBridge.updateSettings(webrtcLoopbackSettings);
  }, [webrtcLoopbackBridge, webrtcLoopbackSettings]);

  useEffect(() => {
    return () => {
      webrtcLoopbackBridge.stop().catch(() => {});
    };
  }, [webrtcLoopbackBridge]);

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
  const capabilityAlertShownRef = useRef<boolean>(false);
  const enterpriseWebKitRef = useRef<boolean>(enterpriseWebKitEnabled);
  const nativeBridgeRef = useRef<NativeWebRTCBridge | null>(null);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  // Default OFF: the Safari spoof script is large and can reduce injection reliability/perf in WebViews.
  const [safariModeEnabled, setSafariModeEnabled] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  const [showSiteSettingsModal, setShowSiteSettingsModal] = useState(false);
  const [showProtocolSettingsModal, setShowProtocolSettingsModal] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [permissionQueue, setPermissionQueue] = useState<CameraPermissionRequest[]>([]);
  const [pendingPermissionRequest, setPendingPermissionRequest] = useState<CameraPermissionRequest | null>(null);
  const [protocolDropdownOpen, setProtocolDropdownOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>(activeProtocol);
  const [enterpriseHookReport, setEnterpriseHookReport] = useState<any | null>(null);

  const protocolOptions = useMemo(() => {
    return Object.values(protocols).map(protocol => ({
      id: protocol.id,
      name: protocol.name,
      enabled: protocol.enabled,
    }));
  }, [protocols]);

  const enabledProtocolOptions = useMemo(
    () => protocolOptions.filter(option => option.enabled),
    [protocolOptions]
  );

  const selectedProtocolOption = useMemo(
    () => protocolOptions.find(option => option.id === selectedProtocol),
    [protocolOptions, selectedProtocol]
  );

  const [permissionRequest, setPermissionRequest] = useState<{
    requestId: string;
    hostname: string;
    origin: string;
  } | null>(null);
  const [permissionSelectedVideo, setPermissionSelectedVideo] = useState<SavedVideo | null>(null);

  const isProtocolEnabled = useMemo(
    () => protocols[activeProtocol]?.enabled ?? true,
    [protocols, activeProtocol]
  );

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

  const originWhitelist = useMemo(() => {
    const whitelist = ['https://*', 'file://*', 'blob:*', 'data:*', 'about:blank'];
    if (!httpsEnforced) {
      whitelist.unshift('http://*');
    }
    return whitelist;
  }, [httpsEnforced]);

  const requiresFileAccess = useMemo(() => {
    if (Platform.OS !== 'android') return false;
    const deviceUris = activeTemplate?.captureDevices
      .map(device => device.assignedVideoUri)
      .filter((assignedUri): assignedUri is string => Boolean(assignedUri)) || [];
    const candidateUris = [fallbackVideoUri, ...deviceUris].filter((uri): uri is string => Boolean(uri));

    return candidateUris.some(uri => (
      isLocalFileUri(uri) && !isBase64VideoUri(uri) && !isBlobUri(uri)
    ));
  }, [activeTemplate, fallbackVideoUri]);

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

  const permissionSiteLabel = useMemo(() => {
    if (!pendingPermissionRequest?.url && !pendingPermissionRequest?.origin) {
      return '';
    }
    const raw = pendingPermissionRequest?.url || pendingPermissionRequest?.origin || '';
    try {
      return new URL(raw).hostname || raw;
    } catch {
      return raw;
    }
  }, [pendingPermissionRequest]);

  const effectiveStealthMode = useMemo(() => {
    if (activeProtocol === 'protected' || activeProtocol === 'harness') {
      return true;
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
    standardSettings.stealthByDefault,
    standardSettings.respectSiteSettings,
    shouldUseStealthForUrl,
    url,
  ]);

  const protocolForceSimulation = isProtocolEnabled && (
    activeProtocol === 'protected'
    || (activeProtocol === 'harness' && harnessSettings.overlayEnabled)
  );

  const protocolMirrorVideo = isProtocolEnabled && activeProtocol === 'harness' && harnessSettings.mirrorVideo;
  const enterpriseWebKitActive = Platform.OS === 'ios' ? enterpriseWebKitEnabled : true;

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
    if (activeProtocol === 'allowlist' && allowlistEnabled) {
      return allowlistBlocked ? 'Allowlist Blocked' : 'Allowlist Active';
    }
    if (activeProtocol === 'webrtc-loopback') {
      return 'WebRTC Loopback Active';
    }
    return '';
  }, [activeProtocol, harnessSettings.overlayEnabled, allowlistEnabled, allowlistBlocked, isProtocolEnabled]);

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
    return false;
  }, [
    activeProtocol,
    protectedSettings.showProtectedBadge,
    harnessSettings.showDebugInfo,
    harnessSettings.overlayEnabled,
    isProtocolEnabled,
  ]);

  const autoInjectEnabled = isProtocolEnabled && (
    (activeProtocol === 'standard' || activeProtocol === 'allowlist')
      ? standardSettings.autoInject
      : activeProtocol === 'webrtc-loopback'
        ? webrtcLoopbackSettings.autoStart
        : true
  );

  const simulatingDevicesCount = useMemo(() =>
    activeTemplate?.captureDevices.filter(d => d.simulationEnabled).length || 0,
    [activeTemplate]
  );

  useEffect(() => {
    if (pendingPermissionRequest || permissionQueue.length === 0) {
      return;
    }
    const [nextRequest, ...remaining] = permissionQueue;
    const fallbackProtocol = enabledProtocolOptions[0]?.id ?? activeProtocol;
    const defaultProtocol = protocols[activeProtocol]?.enabled ? activeProtocol : fallbackProtocol;
    setPermissionQueue(remaining);
    setSelectedProtocol(defaultProtocol);
    setProtocolDropdownOpen(false);
    setPendingPermissionRequest(nextRequest);
  }, [
    activeProtocol,
    enabledProtocolOptions,
    pendingPermissionRequest,
    permissionQueue,
    protocols,
  ]);

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

    const shouldInjectMedia = isProtocolEnabled && !allowlistBlocked;
    if (!shouldInjectMedia && !nativeBridgeEnabled) {
      if (!isProtocolEnabled) {
        console.log('[App] Protocol disabled - injection skipped:', activeProtocol);
      } else if (allowlistBlocked) {
        console.log('[App] Allowlist mode active - injection disabled for:', currentHostname || url);
      }
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
      debugEnabled: developerModeEnabled,
      permissionPromptEnabled: true,
      useFrameGenerator: enterpriseWebKitActive && (activeProtocol === 'standard' || activeProtocol === 'allowlist'),
      signalingTimeoutMs: webrtcLoopbackSettings.signalingTimeoutMs,
      autoStart: webrtcLoopbackSettings.autoStart,
      requireNativeBridge: webrtcLoopbackSettings.requireNativeBridge,
      iceServers: webrtcLoopbackSettings.iceServers,
      preferredCodec: webrtcLoopbackSettings.preferredCodec,
      enableAdaptiveBitrate: webrtcLoopbackSettings.enableAdaptiveBitrate,
      enableAdaptiveResolution: webrtcLoopbackSettings.enableAdaptiveResolution,
      minBitrateKbps: webrtcLoopbackSettings.minBitrateKbps,
      targetBitrateKbps: webrtcLoopbackSettings.targetBitrateKbps,
      maxBitrateKbps: webrtcLoopbackSettings.maxBitrateKbps,
      keepAliveIntervalMs: webrtcLoopbackSettings.keepAliveIntervalMs,
      statsIntervalMs: webrtcLoopbackSettings.statsIntervalMs,
      enableDataChannel: webrtcLoopbackSettings.enableDataChannel,
      enableIceRestart: webrtcLoopbackSettings.enableIceRestart,
      enableSimulcast: webrtcLoopbackSettings.enableSimulcast,
      recordingEnabled: webrtcLoopbackSettings.recordingEnabled,
      ringBufferSeconds: webrtcLoopbackSettings.ringBufferSeconds,
      ringSegmentSeconds: webrtcLoopbackSettings.ringSegmentSeconds,
      cacheRemoteVideos: webrtcLoopbackSettings.cacheRemoteVideos,
      cacheTTLHours: webrtcLoopbackSettings.cacheTTLHours,
      cacheMaxSizeMB: webrtcLoopbackSettings.cacheMaxSizeMB,
    };
    
    if (activeProtocol === 'allowlist') {
      const primaryDevice = normalizedDevices.find(d => d.type === 'camera' && d.simulationEnabled) || normalizedDevices[0];
      const videoUri = primaryDevice?.assignedVideoUri || fallbackVideoUri;
      const advancedSettings = allowlistSettings.advancedRelay;
      Object.assign(config, {
        videoUri: videoUri || null,
        enableWebRTCRelay: advancedSettings.webrtc.enabled,
        enableASI: advancedSettings.asi.enabled,
        enableGPU: advancedSettings.gpu.enabled,
        enableCrypto: advancedSettings.crypto.enabled,
      });
    }
    const nativeBridgeConfig = {
      enabled: nativeBridgeEnabled,
      preferNative: true,
      forceNative: true,
      timeoutMs: 10000,
      debug: developerModeEnabled,
    };
    console.log('[App] Injecting media config:', {
      stealthMode: effectiveStealthMode,
      deviceCount: activeTemplate.captureDevices.length,
      simulatingDevices: activeTemplate.captureDevices.filter(d => d.simulationEnabled && d.assignedVideoUri).map(d => d.name),
      protocol: activeProtocol,
      fallback: fallbackVideo?.name || 'none',
    });
    
    lastInjectionTimeRef.current = Date.now();
    const primaryDevice =
      normalizedDevices.find(d => d.type === 'camera' && d.simulationEnabled) ||
      normalizedDevices.find(d => d.type === 'camera') ||
      normalizedDevices[0];
    const videoUri = primaryDevice?.assignedVideoUri || fallbackVideoUri;
    
    const maxInjectionScriptSize = 180000;
    const buildProtocol0Fallback = () => {
      const protocol0Script = createProtocol0Script({
        devices: normalizedDevices,
        videoUri: videoUri,
        fallbackVideoUri,
        width: 1080,
        height: 1920,
        fps: 30,
        showDebugOverlay: developerModeEnabled,
        stealthMode: effectiveStealthMode,
        loopVideo: standardSettings.loopVideo,
        mirrorVideo: protocolMirrorVideo,
      });
      if (protocol0Script.length > maxInjectionScriptSize) {
        return createWorkingInjectionScript({
          videoUri: videoUri,
          devices: normalizedDevices,
          stealthMode: effectiveStealthMode,
          debugEnabled: developerModeEnabled,
          targetWidth: 1080,
          targetHeight: 1920,
          targetFPS: 30,
          preferFrameGenerator: enterpriseWebKitActive,
        });
      }
      return protocol0Script;
    };
    
    let fallbackScript = '';
    if (activeProtocol === 'websocket') {
      fallbackScript = createWebSocketInjectionScript({
        width: 1080,
        height: 1920,
        fps: 30,
        devices: normalizedDevices,
        debug: developerModeEnabled,
        stealthMode: effectiveStealthMode,
        protocolLabel: 'Protocol 6: WebSocket Bridge',
        showOverlay: showProtocolOverlayLabel,
        videoUri: videoUri || undefined,
      });
    } else if (activeProtocol === 'sonnet' || activeProtocol === 'claude-sonnet') {
      const { createSonnetProtocolScript } = require('@/constants/sonnetProtocol');
      const sonnetConfig = {
        enabled: true,
        aiAdaptiveQuality: true,
        behavioralMimicry: true,
        neuralStyleTransfer: false,
        predictiveFrameOptimization: true,
        quantumTimingRandomness: true,
        biometricSimulation: true,
        realTimeProfiler: true,
        adaptiveStealth: true,
        performanceTarget: 'balanced' as const,
        stealthIntensity: 'maximum' as const,
        learningMode: true,
      };
      fallbackScript = createSonnetProtocolScript(normalizedDevices, sonnetConfig, videoUri);
    } else if (activeProtocol === 'allowlist') {
      const advancedSettings = allowlistSettings.advancedRelay;
      const advancedEnabled = Boolean(
        advancedSettings.webrtc.enabled
        || advancedSettings.asi.enabled
        || advancedSettings.gpu.enabled
        || advancedSettings.crypto.enabled
      );
      if (advancedEnabled) {
        fallbackScript = createAdvancedProtocol2Script({
          videoUri: videoUri || undefined,
          devices: normalizedDevices,
          enableWebRTCRelay: advancedSettings.webrtc.enabled,
          enableASI: advancedSettings.asi.enabled,
          enableGPU: advancedSettings.gpu.enabled,
          enableCrypto: advancedSettings.crypto.enabled,
          debugEnabled: developerModeEnabled,
          stealthMode: effectiveStealthMode,
          protocolLabel: protocolOverlayLabel || 'Protocol 2: Advanced Relay',
          showOverlayLabel: showProtocolOverlayLabel,
        });
      } else {
        fallbackScript = buildProtocol0Fallback();
      }
    } else if (activeProtocol === 'standard') {
      fallbackScript = buildProtocol0Fallback();
    } else if (activeProtocol === 'webrtc-loopback') {
      fallbackScript = createWebRtcLoopbackInjectionScript({
        devices: normalizedDevices,
        debugEnabled: developerModeEnabled,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
        signalingTimeoutMs: webrtcLoopbackSettings.signalingTimeoutMs,
        autoStart: webrtcLoopbackSettings.autoStart,
        requireNativeBridge: webrtcLoopbackSettings.requireNativeBridge,
        iceServers: webrtcLoopbackSettings.iceServers,
        preferredCodec: webrtcLoopbackSettings.preferredCodec,
        enableAdaptiveBitrate: webrtcLoopbackSettings.enableAdaptiveBitrate,
        enableAdaptiveResolution: webrtcLoopbackSettings.enableAdaptiveResolution,
        minBitrateKbps: webrtcLoopbackSettings.minBitrateKbps,
        targetBitrateKbps: webrtcLoopbackSettings.targetBitrateKbps,
        maxBitrateKbps: webrtcLoopbackSettings.maxBitrateKbps,
        keepAliveIntervalMs: webrtcLoopbackSettings.keepAliveIntervalMs,
        statsIntervalMs: webrtcLoopbackSettings.statsIntervalMs,
        enableDataChannel: webrtcLoopbackSettings.enableDataChannel,
        enableIceRestart: webrtcLoopbackSettings.enableIceRestart,
        enableSimulcast: webrtcLoopbackSettings.enableSimulcast,
        recordingEnabled: webrtcLoopbackSettings.recordingEnabled,
        ringBufferSeconds: webrtcLoopbackSettings.ringBufferSeconds,
        ringSegmentSeconds: webrtcLoopbackSettings.ringSegmentSeconds,
        cacheRemoteVideos: webrtcLoopbackSettings.cacheRemoteVideos,
        cacheTTLHours: webrtcLoopbackSettings.cacheTTLHours,
        cacheMaxSizeMB: webrtcLoopbackSettings.cacheMaxSizeMB,
      });
    } else {
      fallbackScript = createMediaInjectionScript(normalizedDevices, {
        stealthMode: effectiveStealthMode,
        fallbackVideoUri,
        forceSimulation: protocolForceSimulation,
        protocolId: activeProtocol,
        protocolLabel: protocolOverlayLabel,
        showOverlayLabel: showProtocolOverlayLabel,
        loopVideo: standardSettings.loopVideo,
        mirrorVideo: protocolMirrorVideo,
        debugEnabled: developerModeEnabled,
        permissionPromptEnabled: true,
      });
    }
    
    if (activeProtocol === 'webrtc-loopback') {
      webrtcLoopbackBridge.updateDeviceSources(normalizedDevices);
    }
    webViewRef.current.injectJavaScript(`
      (function() {
        if (window.__updateNativeWebRTCBridgeConfig) {
          window.__updateNativeWebRTCBridgeConfig(${JSON.stringify(nativeBridgeConfig)});
        } else {
          window.__nativeWebRTCBridgeConfig = ${JSON.stringify(nativeBridgeConfig)};
        }
        if (${shouldInjectMedia ? 'true' : 'false'}) {
          if (window.__updateMediaConfig) {
            window.__updateMediaConfig(${JSON.stringify(config)});
            console.log('[MediaSim] Config injected from RN - devices:', ${activeTemplate.captureDevices.length});
          } else {
            ${fallbackScript}
          }
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
    allowlistSettings,
    developerModeEnabled,
    enterpriseWebKitActive,
    webrtcLoopbackSettings.signalingTimeoutMs,
    webrtcLoopbackSettings.autoStart,
    webrtcLoopbackSettings.requireNativeBridge,
    webrtcLoopbackSettings.iceServers,
    webrtcLoopbackSettings.preferredCodec,
    webrtcLoopbackSettings.enableAdaptiveBitrate,
    webrtcLoopbackSettings.enableAdaptiveResolution,
    webrtcLoopbackSettings.minBitrateKbps,
    webrtcLoopbackSettings.targetBitrateKbps,
    webrtcLoopbackSettings.maxBitrateKbps,
    webrtcLoopbackSettings.keepAliveIntervalMs,
    webrtcLoopbackSettings.statsIntervalMs,
    webrtcLoopbackSettings.enableDataChannel,
    webrtcLoopbackSettings.enableIceRestart,
    webrtcLoopbackSettings.enableSimulcast,
    webrtcLoopbackSettings.recordingEnabled,
    webrtcLoopbackSettings.ringBufferSeconds,
    webrtcLoopbackSettings.ringSegmentSeconds,
    webrtcLoopbackSettings.cacheRemoteVideos,
    webrtcLoopbackSettings.cacheTTLHours,
    webrtcLoopbackSettings.cacheMaxSizeMB,
    nativeBridgeEnabled,
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

  const sendPermissionDecision = useCallback((
    requestId: string,
    decision: { action: PermissionAction; protocolId?: ProtocolType }
  ) => {
    if (!webViewRef.current) {
      console.warn('[App] Unable to send permission decision - no WebView');
      return;
    }
    const requestJson = JSON.stringify(requestId);
    const decisionJson = JSON.stringify(decision);
    webViewRef.current.injectJavaScript(`
      if (window.__resolveCameraPermission) {
        window.__resolveCameraPermission(${requestJson}, ${decisionJson});
      }
      true;
    `);
  }, []);

  const sendNativeBridgeMessage = useCallback((handlerName: string, payload: unknown) => {
    if (!webViewRef.current) {
      console.warn('[App] Unable to send native bridge message - no WebView');
      return;
    }
    const payloadJson = JSON.stringify(payload);
    webViewRef.current.injectJavaScript(`
      if (window.${handlerName}) {
        window.${handlerName}(${payloadJson});
      }
      true;
    `);
  }, []);

  const handlePermissionAction = useCallback((action: PermissionAction) => {
    if (!pendingPermissionRequest) {
      return;
    }
    const requestId = pendingPermissionRequest.requestId;
    let protocolToApply = selectedProtocol;
    if (!protocols[protocolToApply]?.enabled) {
      protocolToApply = enabledProtocolOptions[0]?.id ?? activeProtocol;
      setSelectedProtocol(protocolToApply);
    }

    if (action === 'simulate') {
      if (protocolToApply !== activeProtocol) {
        void setActiveProtocol(protocolToApply);
      } else {
        injectMediaConfig();
      }
      sendPermissionDecision(requestId, { action, protocolId: protocolToApply });
    } else {
      sendPermissionDecision(requestId, { action });
    }

    setProtocolDropdownOpen(false);
    setPendingPermissionRequest(null);
  }, [
    activeProtocol,
    enabledProtocolOptions,
    injectMediaConfig,
    pendingPermissionRequest,
    protocols,
    selectedProtocol,
    sendPermissionDecision,
    setActiveProtocol,
  ]);

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

  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    if (isApplyingVideoRef.current) {
      return;
    }
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !isApplyingVideoRef.current) {
        injectMediaConfig();
      }
    }, 120);
    return () => clearTimeout(timeoutId);
  }, [
    activeProtocol,
    protocolForceSimulation,
    protocolMirrorVideo,
    protocolOverlayLabel,
    showProtocolOverlayLabel,
    standardSettings.loopVideo,
    developerModeEnabled,
    allowlistBlocked,
    isProtocolEnabled,
    injectMediaConfig,
  ]);

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
  }, [
    allowlistModeActive,
    allowlistSettings.enabled,
    allowlistSettings.domains,
    allowlistSettings.blockUnlisted,
  ]);

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
    if (pendingVideoForApply) {
      // If we are handling a permission request, just update the selected video for the modal
      if (permissionRequest) {
        console.log('[VideoSim] Pending video selected for permission request:', pendingVideoForApply.name);
        setPermissionSelectedVideo(pendingVideoForApply);
        setPendingVideoForApply(null);
        return;
      }

      if (activeTemplate) {
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
    }
  }, [
    pendingVideoForApply,
    activeTemplate,
    permissionRequest,
    setPendingVideoForApply,
    assignVideoToAllDevices,
    injectMediaConfig,
  ]);

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
  const allowLocalFileAccess = Platform.OS === 'android'
    && requiresFileAccess
    && isProtocolEnabled
    && !allowlistBlocked;
  const mixedContentMode = Platform.OS === 'android'
    ? (httpsEnforced ? 'never' : 'always')
    : undefined;

  const nativeBridgeEnabled = useMemo(() => {
    return !isWeb && webViewAvailable;
  }, [isWeb, webViewAvailable]);

  const requiresSetup = !isTemplateLoading && !hasMatchingTemplate && templates.filter(t => t.isComplete).length === 0;

  const beforeLoadScript = useMemo(() => {
    // Ensure all devices have a video URI - use built-in fallback if none assigned
    const devices = (activeTemplate?.captureDevices || []).map(d => {
      const assignedUri = d.assignedVideoUri
        ? formatVideoUriForWebView(d.assignedVideoUri)
        : null;
      const resolvedUri =
        assignedUri ||
        fallbackVideoUri ||
        (d.simulationEnabled ? getDefaultFallbackVideoUri() : undefined);

      return {
        ...d,
        assignedVideoUri: resolvedUri,
        assignedVideoName: d.assignedVideoName || fallbackVideo?.name,
        // If no video assigned but simulation is enabled, use built-in
        simulationEnabled: d.simulationEnabled || (effectiveStealthMode && d.type === 'camera'),
      };
    });
    
    const spoofScript = safariModeEnabled ? SAFARI_SPOOFING_SCRIPT : NO_SPOOFING_SCRIPT;
    const shouldInjectMedia = isProtocolEnabled && !allowlistBlocked;
    
    // Determine which injection script to use based on protocol.
    // NOTE: In WebViews, very large injected scripts can fail/truncate depending on platform.
    // We keep a compact working-injection fallback for reliability.
    let mediaInjectionScript = '';
    let injectionType = 'NONE';
    const maxInjectionScriptSize = 180000;
    
    if (shouldInjectMedia) {
      const primaryDevice = devices.find(d => d.type === 'camera' && d.simulationEnabled) || devices[0];
      const videoUri = primaryDevice?.assignedVideoUri || fallbackVideoUri;
      const buildProtocol0Script = () => {
        const protocol0Script = createProtocol0Script({
          devices: devices,
          videoUri: videoUri,
          fallbackVideoUri: fallbackVideoUri,
          width: 1080,
          height: 1920,
          fps: 30,
          showDebugOverlay: developerModeEnabled,
          stealthMode: effectiveStealthMode,
          loopVideo: standardSettings.loopVideo,
          mirrorVideo: protocolMirrorVideo,
        });
        if (protocol0Script.length > maxInjectionScriptSize) {
          return {
            script: createWorkingInjectionScript({
              videoUri: videoUri,
              devices: devices,
              stealthMode: effectiveStealthMode,
              debugEnabled: developerModeEnabled,
              targetWidth: 1080,
              targetHeight: 1920,
              targetFPS: 30,
              preferFrameGenerator: enterpriseWebKitActive,
            }),
            type: 'WORKING_FALLBACK',
            usedFallback: true,
          };
        }
        return { script: protocol0Script, type: 'PROTOCOL0', usedFallback: false };
      };
      
      if (activeProtocol === 'websocket') {
        // Protocol 6: WebSocket Bridge - Most reliable method for WebView streaming
        mediaInjectionScript = createWebSocketInjectionScript({
          width: 1080,
          height: 1920,
          fps: 30,
          devices: devices,
          debug: developerModeEnabled,
          stealthMode: effectiveStealthMode,
          protocolLabel: 'Protocol 6: WebSocket Bridge',
          showOverlay: showProtocolOverlayLabel,
          videoUri: videoUri || undefined,
        });
        injectionType = 'WEBSOCKET';
        console.log('[App] Using WEBSOCKET BRIDGE injection with video:', videoUri ? 'YES' : 'NO');
      } else if (activeProtocol === 'sonnet' || activeProtocol === 'claude-sonnet') {
        // Use Sonnet Protocol for Protocol 5
        const { createSonnetProtocolScript } = require('@/constants/sonnetProtocol');
        const sonnetConfig = {
          enabled: true,
          aiAdaptiveQuality: true,
          behavioralMimicry: true,
          neuralStyleTransfer: false,
          predictiveFrameOptimization: true,
          quantumTimingRandomness: true,
          biometricSimulation: true,
          realTimeProfiler: true,
          adaptiveStealth: true,
          performanceTarget: 'balanced' as const,
          stealthIntensity: 'maximum' as const,
          learningMode: true,
        };
        mediaInjectionScript = createSonnetProtocolScript(devices, sonnetConfig, videoUri);
        injectionType = 'SONNET';
        console.log('[App] Using SONNET Protocol injection with video:', videoUri ? 'YES' : 'NO');
      } else if (activeProtocol === 'allowlist') {
        const advancedSettings = allowlistSettings.advancedRelay;
        const advancedEnabled = Boolean(
          advancedSettings.webrtc.enabled
          || advancedSettings.asi.enabled
          || advancedSettings.gpu.enabled
          || advancedSettings.crypto.enabled
        );
        if (advancedEnabled) {
          mediaInjectionScript = createAdvancedProtocol2Script({
            videoUri: videoUri || undefined,
            devices: devices,
            enableWebRTCRelay: advancedSettings.webrtc.enabled,
            enableASI: advancedSettings.asi.enabled,
            enableGPU: advancedSettings.gpu.enabled,
            enableCrypto: advancedSettings.crypto.enabled,
            debugEnabled: developerModeEnabled,
            stealthMode: effectiveStealthMode,
            protocolLabel: protocolOverlayLabel || 'Protocol 2: Advanced Relay',
            showOverlayLabel: showProtocolOverlayLabel,
          });
          injectionType = 'ADVANCED_RELAY';
          console.log('[App] Using ADVANCED RELAY injection for allowlist with video:', videoUri ? 'YES' : 'NO');
        } else {
          const { script, type, usedFallback } = buildProtocol0Script();
          mediaInjectionScript = script;
          injectionType = type;
          if (usedFallback) {
            console.warn('[App] Protocol 0 script is large; using working injection fallback');
          }
          console.log('[App] Using PROTOCOL 0 (Ultra-Early Deep Hook) for', activeProtocol);
          console.log('[App] Video URI:', videoUri ? 'YES' : 'NO (green screen)');
          console.log('[App] Devices:', devices.length);
        }
      } else if (activeProtocol === 'standard') {
        const { script, type, usedFallback } = buildProtocol0Script();
        mediaInjectionScript = script;
        injectionType = type;
        if (usedFallback) {
          console.warn('[App] Protocol 0 script is large; using working injection fallback');
        }
        console.log('[App] Using PROTOCOL 0 (Ultra-Early Deep Hook) for', activeProtocol);
        console.log('[App] Video URI:', videoUri ? 'YES' : 'NO (green screen)');
        console.log('[App] Devices:', devices.length);
      } else if (activeProtocol === 'webrtc-loopback') {
        mediaInjectionScript = createWebRtcLoopbackInjectionScript({
          devices: devices,
          debugEnabled: developerModeEnabled,
          targetWidth: 1080,
          targetHeight: 1920,
          targetFPS: 30,
          signalingTimeoutMs: webrtcLoopbackSettings.signalingTimeoutMs,
          autoStart: webrtcLoopbackSettings.autoStart,
          requireNativeBridge: webrtcLoopbackSettings.requireNativeBridge,
          iceServers: webrtcLoopbackSettings.iceServers,
          preferredCodec: webrtcLoopbackSettings.preferredCodec,
          enableAdaptiveBitrate: webrtcLoopbackSettings.enableAdaptiveBitrate,
          enableAdaptiveResolution: webrtcLoopbackSettings.enableAdaptiveResolution,
          minBitrateKbps: webrtcLoopbackSettings.minBitrateKbps,
          targetBitrateKbps: webrtcLoopbackSettings.targetBitrateKbps,
          maxBitrateKbps: webrtcLoopbackSettings.maxBitrateKbps,
          keepAliveIntervalMs: webrtcLoopbackSettings.keepAliveIntervalMs,
          statsIntervalMs: webrtcLoopbackSettings.statsIntervalMs,
          enableDataChannel: webrtcLoopbackSettings.enableDataChannel,
          enableIceRestart: webrtcLoopbackSettings.enableIceRestart,
          enableSimulcast: webrtcLoopbackSettings.enableSimulcast,
          recordingEnabled: webrtcLoopbackSettings.recordingEnabled,
          ringBufferSeconds: webrtcLoopbackSettings.ringBufferSeconds,
          ringSegmentSeconds: webrtcLoopbackSettings.ringSegmentSeconds,
          cacheRemoteVideos: webrtcLoopbackSettings.cacheRemoteVideos,
          cacheTTLHours: webrtcLoopbackSettings.cacheTTLHours,
          cacheMaxSizeMB: webrtcLoopbackSettings.cacheMaxSizeMB,
        });
        injectionType = 'WEBRTC_LOOPBACK';
        console.log('[App] Using WEBRTC loopback injection');
      } else {
        // Use original injection for other protocols (protected, harness, holographic)
        const injectionOptions = {
          stealthMode: effectiveStealthMode,
          fallbackVideoUri,
          forceSimulation: protocolForceSimulation,
          protocolId: activeProtocol,
          protocolLabel: protocolOverlayLabel,
          showOverlayLabel: showProtocolOverlayLabel,
          loopVideo: standardSettings.loopVideo,
          mirrorVideo: protocolMirrorVideo,
          debugEnabled: developerModeEnabled,
          permissionPromptEnabled: true,
        };
        mediaInjectionScript = createMediaInjectionScript(devices, injectionOptions);
        injectionType = 'LEGACY';
      }
    }

    const nativeBridgeConfig = {
      enabled: nativeBridgeEnabled,
      preferNative: true,
      forceNative: true,
      timeoutMs: 10000,
      debug: developerModeEnabled,
    };
    const shouldInjectBridge = nativeBridgeEnabled;
    const nativeBridgeScript = shouldInjectBridge
      ? NATIVE_WEBRTC_BRIDGE_SCRIPT + `
        (function() {
          if (window.__updateNativeWebRTCBridgeConfig) {
            window.__updateNativeWebRTCBridgeConfig(${JSON.stringify(nativeBridgeConfig)});
          } else {
            window.__nativeWebRTCBridgeConfig = ${JSON.stringify(nativeBridgeConfig)};
          }
        })();
        `
      : '';
    
    const script =
      CONSOLE_CAPTURE_SCRIPT +
      MEDIARECORDER_POLYFILL_SCRIPT +
      spoofScript +
      mediaInjectionScript +
      nativeBridgeScript +
      VIDEO_SIMULATION_TEST_SCRIPT;
    console.log('[App] Preparing before-load script with', {
      devices: devices.length,
      stealth: effectiveStealthMode,
      allowlisted: shouldInjectMedia,
      protocol: activeProtocol,
      fallback: fallbackVideo?.name || 'none',
      injectionType,
    });
    console.log('[App] Devices with videos:', devices.filter(d => d.assignedVideoUri).length);
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
    developerModeEnabled,
    enterpriseWebKitActive,
    webrtcLoopbackSettings.signalingTimeoutMs,
    webrtcLoopbackSettings.autoStart,
    webrtcLoopbackSettings.requireNativeBridge,
    webrtcLoopbackSettings.iceServers,
    webrtcLoopbackSettings.preferredCodec,
    webrtcLoopbackSettings.enableAdaptiveBitrate,
    webrtcLoopbackSettings.enableAdaptiveResolution,
    webrtcLoopbackSettings.minBitrateKbps,
    webrtcLoopbackSettings.targetBitrateKbps,
    webrtcLoopbackSettings.maxBitrateKbps,
    webrtcLoopbackSettings.keepAliveIntervalMs,
    webrtcLoopbackSettings.statsIntervalMs,
    webrtcLoopbackSettings.enableDataChannel,
    webrtcLoopbackSettings.enableIceRestart,
    webrtcLoopbackSettings.enableSimulcast,
    webrtcLoopbackSettings.recordingEnabled,
    webrtcLoopbackSettings.ringBufferSeconds,
    webrtcLoopbackSettings.ringSegmentSeconds,
    webrtcLoopbackSettings.cacheRemoteVideos,
    webrtcLoopbackSettings.cacheTTLHours,
    webrtcLoopbackSettings.cacheMaxSizeMB,
    isProtocolEnabled,
    allowlistSettings,
    nativeBridgeEnabled,
  ]);

  const afterLoadScript = useMemo(
    () => (standardSettings.injectMotionData ? MOTION_INJECTION_SCRIPT : ''),
    [standardSettings.injectMotionData]
  );

  const isNavigationAllowed = useCallback((requestUrl: string): boolean => {
    if (!requestUrl) return false;
    const lowerUrl = requestUrl.toLowerCase();

    if (lowerUrl.startsWith('about:')) return true;
    if (isBase64VideoUri(requestUrl) || isBlobUri(requestUrl)) return true;
    if (
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('file:') ||
      lowerUrl.startsWith('content:') ||
      lowerUrl.startsWith('ph:')
    ) {
      return true;
    }

    if (allowlistEnabled && allowlistSettings.blockUnlisted) {
      try {
        const hostname = new URL(requestUrl).hostname.toLowerCase();
        if (hostname && !checkIsAllowlisted(hostname)) {
          console.warn('[App] Navigation blocked by allowlist:', hostname);
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }, [allowlistEnabled, allowlistSettings.blockUnlisted, checkIsAllowlisted]);

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

  const handleProtocolTester = useCallback(() => {
    router.push('/protocol-tester');
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

  const handlePermissionRequestAction = useCallback((requestId: string, action: 'simulate' | 'allow' | 'deny', config?: any) => {
    if (webViewRef.current) {
      console.log('[App] Sending permission response:', action, config);
      webViewRef.current.injectJavaScript(`
        (function() {
          const msg = ${JSON.stringify({ requestId, action, config })};
          // New permission bridge (matches PermissionPrompt in constants/browserScripts.ts)
          if (window.__resolveCameraPermission) {
            window.__resolveCameraPermission(msg.requestId, {
              action: msg.action,
              protocolId: msg.config && msg.config.protocolId ? msg.config.protocolId : undefined
            });
            return;
          }
          // Legacy fallback (kept for older scripts)
          if (window.__handlePermissionResponse) {
            window.__handlePermissionResponse({
              type: 'permissionResponse',
              requestId: msg.requestId,
              action: msg.action,
              config: msg.config
            });
          }
        })();
        true;
      `);
    }
    setPermissionRequest(null);
    setPermissionSelectedVideo(null);
  }, []);

  if (Platform.OS === 'android') {
    return (
      <View style={styles.unsupportedContainer}>
        <Text style={styles.unsupportedTitle}>iOS Only</Text>
        <Text style={styles.unsupportedText}>
          This build is optimized for iOS and does not support Android.
        </Text>
      </View>
    );
  }

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
        visible={showTestingWatermark}
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
            onOpenRemoteBrowser={() => router.push('/remote-browser')}
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
                key={`webview-${webViewKey}`}
                ref={webViewRef}
                source={{ uri: url }}
                style={styles.webView}
                userAgent={safariModeEnabled ? SAFARI_USER_AGENT : undefined}
                originWhitelist={originWhitelist}
                enterpriseWebKitEnabled={enterpriseWebKitEnabled}
                injectedJavaScriptBeforeContentLoaded={beforeLoadScript}
                injectedJavaScript={afterLoadScript}
                // Ensure injection runs in iframes too (important for some real-world sites).
                injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
                injectedJavaScriptForMainFrameOnly={false}
                // Explicitly enable JS/DOM storage + media playback behaviors.
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
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
                    } else if (data.type === 'mediaInjectionUnsupported') {
                      console.warn('[WebView Injection Unsupported]', data.payload?.reason || data.payload);
                    } else if (data.type === 'nativeGumOffer') {
                      const payload = data.payload || {};
                      void handleNativeGumOffer(payload, {
                        onAnswer: (answerPayload) => sendNativeBridgeMessage('__nativeGumAnswer', answerPayload),
                        onIceCandidate: (icePayload) => sendNativeBridgeMessage('__nativeGumIce', icePayload),
                        onError: (errorPayload) => sendNativeBridgeMessage('__nativeGumError', errorPayload),
                      });
                    } else if (data.type === 'nativeGumIce') {
                      const payload = data.payload || {};
                      void handleNativeGumIceCandidate(payload);
                    } else if (data.type === 'nativeGumCancel') {
                      const payload = data.payload || {};
                      closeNativeGumSession({ requestId: payload.requestId });
                    } else if (data.type === 'mediaAccess') {
                      console.log('[WebView Media Access]', data.device, data.action);
                    } else if (data.type === 'mediaCapabilities') {
                      const payload = data.payload || {};
                      console.log('[WebView Capabilities]', payload);
                      
                      if (
                        Platform.OS === 'ios' &&
                        payload.spoofingAvailable === false &&
                        !capabilityAlertShownRef.current
                      ) {
                        capabilityAlertShownRef.current = true;
                        Alert.alert(
                          'iOS WebView Limitation',
                          'This iOS WebView build does not support canvas.captureStream or WebCodecs. ' +
                            'JavaScript-only camera spoofing cannot work in this environment. ' +
                            'A native virtual camera build is required for iOS.',
                          [{ text: 'OK' }]
                        );
                      }
                    } else if (data.type === 'enterpriseWebKitReport') {
                      setEnterpriseHookReport(data.payload || null);
                    } else if (
                      data.type === 'nativeWebRTCOffer' ||
                      data.type === 'nativeWebRTCIceCandidate' ||
                      data.type === 'nativeWebRTCClose'
                    ) {
                      nativeBridgeRef.current?.handleSignalMessage(data);
                    } else if (data.type === 'cameraPermissionRequest') {
                      const payload = data.payload || {};
                      if (!payload.requestId) {
                        console.warn('[App] Permission request missing requestId');
                        return;
                      }
                      const request: CameraPermissionRequest = {
                        requestId: String(payload.requestId),
                        url: payload.url,
                        origin: payload.origin,
                        wantsVideo: Boolean(payload.wantsVideo),
                        wantsAudio: Boolean(payload.wantsAudio),
                        requestedFacing: payload.requestedFacing || null,
                        requestedDeviceId: payload.requestedDeviceId || null,
                      };
                      setPermissionQueue(queue => [...queue, request]);
                    } else if (data.type === 'webrtcLoopbackOffer') {
                      webrtcLoopbackBridge.handleOffer(data.payload);
                    } else if (data.type === 'webrtcLoopbackCandidate') {
                      webrtcLoopbackBridge.handleCandidate(data.payload);
                    } else if (data.type === 'webrtcLoopbackStats') {
                      if (data.payload?.fps !== undefined) {
                        console.log('[WebView WebRTC Stats]', data.payload);
                      }
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
                    } else if (data.type === 'permissionRequest') {
                      console.log('[App] Permission request received:', data.requestId, data.origin);
                      setPermissionRequest({
                        requestId: data.requestId,
                        hostname: new URL(data.origin).hostname,
                        origin: data.origin
                      });
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
                  const requestUrl = request.url || '';
                  const lowerUrl = requestUrl.toLowerCase();
                  const isTopFrame = request.isTopFrame !== false;

                  if (!isTopFrame) {
                    return true;
                  }

                  if (lowerUrl.startsWith('http://') && httpsEnforced) {
                    const httpsUrl = forceHttps(requestUrl);
                    setUrl(httpsUrl);
                    setInputUrl(httpsUrl);
                    return false;
                  }

                  return isNavigationAllowed(requestUrl);
                }}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
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

      <Modal
        visible={Boolean(pendingPermissionRequest)}
        transparent
        animationType="fade"
        onRequestClose={() => handlePermissionAction('deny')}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera Permission Request</Text>
            <Text style={styles.permissionSubtitle}>
              {permissionSiteLabel
                ? `${permissionSiteLabel} wants access to your camera.`
                : 'A site wants access to your camera.'}
            </Text>
            <View style={styles.permissionSection}>
              <Text style={styles.permissionSectionTitle}>Simulate video</Text>
              <Text style={styles.permissionSectionHint}>
                Use your configured simulated camera feed with a selected protocol.
              </Text>
              <TouchableOpacity
                style={styles.permissionDropdown}
                onPress={() => setProtocolDropdownOpen(prev => !prev)}
              >
                <Text style={styles.permissionDropdownText}>
                  {selectedProtocolOption?.name || 'Select protocol'}
                </Text>
              </TouchableOpacity>
              {protocolDropdownOpen && (
                <View style={styles.permissionDropdownList}>
                  {enabledProtocolOptions.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.permissionDropdownItem,
                        option.id === selectedProtocol && styles.permissionDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedProtocol(option.id);
                        setProtocolDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.permissionDropdownItemText,
                          option.id === selectedProtocol && styles.permissionDropdownItemTextActive,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSimulateButton}
                onPress={() => handlePermissionAction('simulate')}
              >
                <Text style={styles.permissionSimulateText}>Simulate Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionRealButton}
                onPress={() => handlePermissionAction('real')}
              >
                <Text style={styles.permissionRealText}>Don&apos;t Simulate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionDenyButton}
                onPress={() => handlePermissionAction('deny')}
              >
                <Text style={styles.permissionDenyText}>Deny Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

      {enterpriseHookReport && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setEnterpriseHookReport(null)}
        >
          <View style={styles.hookReportOverlay}>
            <View style={styles.hookReportCard}>
              <View style={styles.hookReportHeader}>
                <Text style={styles.hookReportTitle}>Enterprise WebKit Report</Text>
                <TouchableOpacity onPress={() => setEnterpriseHookReport(null)}>
                  <Text style={styles.hookReportClose}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hookReportSubtitle}>
                Applied flags: {enterpriseHookReport.appliedFlags?.length || 0} •
                Failed flags: {enterpriseHookReport.failedFlags?.length || 0}
              </Text>
              <ScrollView style={styles.hookReportScroll}>
                <Text style={styles.hookReportSection}>Applied Flags</Text>
                {(enterpriseHookReport.appliedFlags || []).map((flag: string, idx: number) => (
                  <Text key={`applied-${idx}`} style={styles.hookReportItem}>{flag}</Text>
                ))}
                <Text style={styles.hookReportSection}>Failed Flags</Text>
                {(enterpriseHookReport.failedFlags || []).map((flag: string, idx: number) => (
                  <Text key={`failed-${idx}`} style={styles.hookReportItem}>{flag}</Text>
                ))}
                <Text style={styles.hookReportSection}>Loaded Frameworks</Text>
                {(enterpriseHookReport.loadedFrameworks || []).map((fw: string, idx: number) => (
                  <Text key={`fw-${idx}`} style={styles.hookReportItem}>{fw}</Text>
                ))}
                <Text style={styles.hookReportSection}>Failed Frameworks</Text>
                {(enterpriseHookReport.failedFrameworks || []).map((fw: string, idx: number) => (
                  <Text key={`fwf-${idx}`} style={styles.hookReportItem}>{fw}</Text>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <ProtocolSettingsModal
        visible={showProtocolSettingsModal}
        currentHostname={currentHostname}
        onClose={() => setShowProtocolSettingsModal(false)}
      />

      {permissionRequest && (
        <PermissionRequestModal
          visible={!!permissionRequest}
          hostname={permissionRequest.hostname}
          requestId={permissionRequest.requestId}
          protocols={protocols}
          selectedVideo={permissionSelectedVideo || fallbackVideo}
          onAction={handlePermissionRequestAction}
          onSelectVideo={() => router.push('/my-videos')}
        />
      )}

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
  unsupportedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#0a0a0a',
  },
  unsupportedTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
    textAlign: 'center',
  },
  unsupportedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    lineHeight: 18,
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
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionSection: {
    marginBottom: 16,
  },
  permissionSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: 6,
  },
  permissionSectionHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  permissionDropdown: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111111',
  },
  permissionDropdownText: {
    color: '#ffffff',
    fontSize: 13,
  },
  permissionDropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: '#101010',
    overflow: 'hidden',
  },
  permissionDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  permissionDropdownItemActive: {
    backgroundColor: 'rgba(0,255,136,0.15)',
  },
  permissionDropdownItemText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  permissionDropdownItemTextActive: {
    color: '#00ff88',
    fontWeight: '600' as const,
  },
  permissionActions: {
    gap: 10,
  },
  permissionSimulateButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionSimulateText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  permissionRealButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionRealText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  permissionDenyButton: {
    backgroundColor: 'rgba(255,71,87,0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.4)',
  },
  permissionDenyText: {
    color: '#ff4757',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  hookReportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  hookReportCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hookReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hookReportTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  hookReportClose: {
    color: '#00ff88',
    fontWeight: '600' as const,
  },
  hookReportSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  hookReportScroll: {
    maxHeight: 420,
  },
  hookReportSection: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  hookReportItem: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
});
