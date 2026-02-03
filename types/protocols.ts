/**
 * Protocol Settings Types
 * Defines configuration for all 4 testing protocols
 */

export type ProtocolId = 'standard' | 'allowlist' | 'protected' | 'harness' | 'holographic' | 'websocket' | 'webrtc-loopback';

export interface ProtocolConfig {
  id: ProtocolId;
  name: string;
  description: string;
  enabled: boolean;
  isLive: boolean;
  requiresDeveloperMode: boolean;
}

// Protocol 1: Standard Injection Settings
export interface StandardInjectionSettings {
  enabled: boolean;
  autoInject: boolean;
  stealthByDefault: boolean;
  injectionDelay: number; // ms
  retryOnFail: boolean;
  maxRetries: number;
  loggingLevel: 'none' | 'minimal' | 'verbose';
}

// Protocol 2: Advanced Relay Settings (Replaces old Allowlist Mode)
// This is the most technically advanced video injection system featuring:
// - Multi-source video pipeline with hot-switching
// - WebRTC local relay with virtual TURN emulation
// - GPU-accelerated video processing
// - Adaptive Stream Intelligence (ASI)
// - Cross-device live streaming support
// - Cryptographic stream validation
export interface AdvancedRelaySettings {
  enabled: boolean;
  
  // Video Pipeline Settings
  pipeline: {
    hotSwitchThresholdMs: number;
    minAcceptableFps: number;
    enableParallelDecoding: boolean;
  };
  
  // WebRTC Relay Settings
  webrtc: {
    enabled: boolean;
    virtualTurnEnabled: boolean;
    sdpManipulationEnabled: boolean;
    stealthMode: boolean;
  };
  
  // GPU Processing Settings
  gpu: {
    enabled: boolean;
    qualityPreset: 'ultra' | 'high' | 'medium' | 'low' | 'potato';
    noiseInjection: boolean;
    noiseIntensity: number;
  };
  
  // Adaptive Stream Intelligence Settings
  asi: {
    enabled: boolean;
    siteFingerprinting: boolean;
    autoResolutionMatching: boolean;
    antiDetectionMeasures: boolean;
    storeHistory: boolean;
  };
  
  // Cross-Device Streaming Settings
  crossDevice: {
    enabled: boolean;
    discoveryMethod: 'manual' | 'mdns' | 'qr';
    targetLatencyMs: number;
    autoReconnect: boolean;
  };
  
  // Cryptographic Validation Settings
  crypto: {
    enabled: boolean;
    frameSigning: boolean;
    tamperDetection: boolean;
    keyRotationIntervalMs: number;
  };
  
  // Legacy compatibility - domains still supported for filtering
  domains: string[];
  blockByDefault: boolean;
  showBlockedNotification: boolean;
  autoAddCurrentSite: boolean;
}

// Legacy alias for backwards compatibility
export type AllowlistSettings = AdvancedRelaySettings;

// Protocol 5: Holographic Stream Injection (HSI)
export interface HolographicSettings {
  enabled: boolean;
  // Network Layer
  useWebSocketBridge: boolean;
  bridgePort: number;
  latencyMode: 'ultra-low' | 'balanced' | 'quality';
  
  // Stream Synthesis
  canvasResolution: '720p' | '1080p' | '4k';
  frameRate: 30 | 60;
  noiseInjectionLevel: number; // 0-1.0, adds sensor noise to bypass "too clean" checks
  
  // SDP Mutation
  sdpMasquerade: boolean; // Rewrites SDP to look like hardware encoder
  emulatedDevice: 'iphone-front' | 'webcam-c920' | 'obs-virtual';
}

// Protocol 3: Protected Preview Settings
export interface ProtectedPreviewSettings {
  bodyDetectionEnabled: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  replacementVideoId: string | null;
  showProtectedBadge: boolean;
  autoTriggerOnFace: boolean;
  blurFallback: boolean;
}

// Protocol 6: WebSocket Bridge Settings
// Uses React Native's postMessage to send video frames to WebView
// Most reliable method - bypasses all canvas timing issues
export interface WebSocketBridgeSettings {
  enabled: boolean;
  
  // Connection settings (uses postMessage, not actual WebSocket)
  port: number; // For display purposes
  
  // Video settings
  resolution: '720p' | '1080p' | '4k';
  frameRate: 24 | 30 | 60;
  quality: number; // 0-1, JPEG quality for frame encoding
  
  // Rendering
  useSyntheticFallback: boolean; // Use green screen if no video
  enableFrameInterpolation: boolean;
  
  // Debug
  showDebugOverlay: boolean;
  logFrameStats: boolean;
}

// Protocol 4: Test Harness Settings
export interface TestHarnessSettings {
  overlayEnabled: boolean;
  showDebugInfo: boolean;
  captureFrameRate: number;
  enableAudioPassthrough: boolean;
  mirrorVideo: boolean;
  testPatternOnNoVideo: boolean;
}

// Protocol 6: WebRTC Loopback (Native bridge)
export interface WebRtcLoopbackSettings {
  enabled: boolean;
  autoStart: boolean;
  signalingTimeoutMs: number;
  requireNativeBridge: boolean;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  preferredCodec: 'auto' | 'h264' | 'vp8' | 'vp9' | 'av1';
  enableAdaptiveBitrate: boolean;
  enableAdaptiveResolution: boolean;
  minBitrateKbps: number;
  targetBitrateKbps: number;
  maxBitrateKbps: number;
  keepAliveIntervalMs: number;
  statsIntervalMs: number;
  enableDataChannel: boolean;
  enableIceRestart: boolean;
  enableSimulcast: boolean;
  recordingEnabled: boolean;
  ringBufferSeconds: number;
  ringSegmentSeconds: number;
  cacheRemoteVideos: boolean;
  cacheTTLHours: number;
  cacheMaxSizeMB: number;
}

// Combined Protocol Settings
export interface ProtocolSettings {
  standard: StandardInjectionSettings;
  allowlist: AllowlistSettings;
  protected: ProtectedPreviewSettings;
  harness: TestHarnessSettings;
  holographic: HolographicSettings;
  websocket: WebSocketBridgeSettings;
  webrtcLoopback: WebRtcLoopbackSettings;
}

// Developer Mode Settings
export interface DeveloperModeSettings {
  enabled: boolean;
  pinCode: string | null;
  showWatermark: boolean;
  showDebugInfo: boolean;
  allowProtocolEditing: boolean;
  allowAllowlistEditing: boolean;
  bypassSecurityChecks: boolean;
  enableBenchmarkMode: boolean;
  lastEnabledAt: string | null;
}

// Default configurations
export const DEFAULT_STANDARD_SETTINGS: StandardInjectionSettings = {
  enabled: true,
  autoInject: true,
  stealthByDefault: true,
  injectionDelay: 100,
  retryOnFail: true,
  maxRetries: 3,
  loggingLevel: 'minimal',
};

export const DEFAULT_ADVANCED_RELAY_SETTINGS: AdvancedRelaySettings = {
  enabled: true,
  
  // Video Pipeline - optimized for quality
  pipeline: {
    hotSwitchThresholdMs: 50,
    minAcceptableFps: 15,
    enableParallelDecoding: true,
  },
  
  // WebRTC Relay - maximum stealth
  webrtc: {
    enabled: true,
    virtualTurnEnabled: true,
    sdpManipulationEnabled: true,
    stealthMode: true,
  },
  
  // GPU Processing - balanced quality
  gpu: {
    enabled: true,
    qualityPreset: 'high',
    noiseInjection: true,
    noiseIntensity: 0.02,
  },
  
  // ASI - intelligent adaptation
  asi: {
    enabled: true,
    siteFingerprinting: true,
    autoResolutionMatching: true,
    antiDetectionMeasures: true,
    storeHistory: true,
  },
  
  // Cross-Device - ready for pairing
  crossDevice: {
    enabled: true,
    discoveryMethod: 'qr',
    targetLatencyMs: 100,
    autoReconnect: true,
  },
  
  // Crypto - secure by default
  crypto: {
    enabled: true,
    frameSigning: true,
    tamperDetection: true,
    keyRotationIntervalMs: 3600000, // 1 hour
  },
  
  // Legacy domain filtering (preserved for compatibility)
  domains: [],
  blockByDefault: false,
  showBlockedNotification: false,
  autoAddCurrentSite: false,
};

// Legacy alias for backwards compatibility
export const DEFAULT_ALLOWLIST_SETTINGS = DEFAULT_ADVANCED_RELAY_SETTINGS;

export const DEFAULT_HOLOGRAPHIC_SETTINGS: HolographicSettings = {
  enabled: true,
  useWebSocketBridge: true,
  bridgePort: 8080,
  latencyMode: 'balanced',
  canvasResolution: '1080p',
  frameRate: 30,
  noiseInjectionLevel: 0.1,
  sdpMasquerade: true,
  emulatedDevice: 'iphone-front',
};

export const DEFAULT_PROTECTED_SETTINGS: ProtectedPreviewSettings = {
  bodyDetectionEnabled: true,
  sensitivityLevel: 'medium',
  replacementVideoId: null,
  showProtectedBadge: true,
  autoTriggerOnFace: true,
  blurFallback: true,
};

export const DEFAULT_HARNESS_SETTINGS: TestHarnessSettings = {
  overlayEnabled: true,
  showDebugInfo: true,
  captureFrameRate: 30,
  enableAudioPassthrough: false,
  mirrorVideo: false,
  testPatternOnNoVideo: true,
};

export const DEFAULT_WEBSOCKET_SETTINGS: WebSocketBridgeSettings = {
  enabled: true,
  port: 8765,
  resolution: '1080p',
  frameRate: 30,
  quality: 0.7,
  useSyntheticFallback: true,
  enableFrameInterpolation: false,
  showDebugOverlay: false,
  logFrameStats: false,
};

export const DEFAULT_WEBRTC_LOOPBACK_SETTINGS: WebRtcLoopbackSettings = {
  enabled: true,
  autoStart: true,
  signalingTimeoutMs: 12000,
  requireNativeBridge: true,
  iceServers: [],
  preferredCodec: 'auto',
  enableAdaptiveBitrate: true,
  enableAdaptiveResolution: true,
  minBitrateKbps: 300,
  targetBitrateKbps: 1200,
  maxBitrateKbps: 0,
  keepAliveIntervalMs: 5000,
  statsIntervalMs: 4000,
  enableDataChannel: true,
  enableIceRestart: true,
  enableSimulcast: false,
  recordingEnabled: true,
  ringBufferSeconds: 15,
  ringSegmentSeconds: 3,
  cacheRemoteVideos: true,
  cacheTTLHours: 24,
  cacheMaxSizeMB: 1024,
};

export const DEFAULT_PROTOCOL_SETTINGS: ProtocolSettings = {
  standard: DEFAULT_STANDARD_SETTINGS,
  allowlist: DEFAULT_ALLOWLIST_SETTINGS,
  protected: DEFAULT_PROTECTED_SETTINGS,
  harness: DEFAULT_HARNESS_SETTINGS,
  holographic: DEFAULT_HOLOGRAPHIC_SETTINGS,
  websocket: DEFAULT_WEBSOCKET_SETTINGS,
  webrtcLoopback: DEFAULT_WEBRTC_LOOPBACK_SETTINGS,
};

export const DEFAULT_DEVELOPER_MODE: DeveloperModeSettings = {
  // For safety in wider testing, developer mode defaults to disabled.
  enabled: false,
  // Default PIN requested by you: '0000'
  pinCode: '0000',
  showWatermark: true,
  showDebugInfo: false,
  allowProtocolEditing: true,
  allowAllowlistEditing: true,
  bypassSecurityChecks: false,
  enableBenchmarkMode: false,
  lastEnabledAt: null,
};

// Protocol metadata for UI display
export const PROTOCOL_METADATA: Record<ProtocolId, ProtocolConfig> = {
  standard: {
    id: 'standard',
    name: 'Protocol 1: Standard Injection',
    description: 'Uses the current media injection flow inside this app for internal testing and controlled environments.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: false,
  },
  allowlist: {
    id: 'allowlist',
    name: 'Protocol 2: Advanced Relay',
    description: 'The most technically advanced video injection system featuring WebRTC relay, GPU processing, Adaptive Stream Intelligence, cross-device streaming, and cryptographic validation.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: true,
  },
  protected: {
    id: 'protected',
    name: 'Protocol 3: Protected Preview',
    description: 'A consent-based local preview that swaps to a safe looping video whenever body detection is triggered.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: false,
  },
  harness: {
    id: 'harness',
    name: 'Protocol 4: Local Test Harness',
    description: 'A local sandbox page for safe overlay testing without touching third-party sites.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: false,
  },
  holographic: {
    id: 'holographic',
    name: 'Protocol 5: Holographic Stream Injection',
    description: 'Advanced WebSocket bridge with SDP mutation and canvas-based stream synthesis. The most advanced injection method available.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: true,
  },
  websocket: {
    id: 'websocket',
    name: 'Protocol 6: WebSocket Bridge',
    description: 'Uses React Native postMessage bridge to stream video frames directly to WebView. Most reliable method - bypasses all canvas timing issues. Recommended for maximum compatibility.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: false,
  },
  'webrtc-loopback': {
    id: 'webrtc-loopback',
    name: 'Protocol 6: WebRTC Loopback (iOS)',
    description: 'iOS-only WebRTC loopback that relies on a native bridge to provide a fake camera track.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: true,
  },
};
