/**
 * Protocol Settings Types
 * Defines configuration for all 4 testing protocols
 */

export type ProtocolId = 'standard' | 'allowlist' | 'protected' | 'harness' | 'holographic' | 'claude' | 'gpt52';

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

// Protocol 5 Alternative: Claude Neural Injection
export interface ClaudeProtocolSettings {
  enabled: boolean;
  neuralOptimizationEnabled: boolean;
  quantumFingerprintEvasion: boolean;
  behavioralMimicryEnabled: boolean;
  antiDetectionLevel: 'standard' | 'enhanced' | 'maximum' | 'paranoid';
  noiseReductionLevel: 'off' | 'light' | 'moderate' | 'aggressive';
  errorRecoveryMode: 'graceful' | 'aggressive' | 'silent';
  priorityLevel: 'background' | 'normal' | 'high' | 'realtime';
  // Extended properties for test compatibility
  adaptiveInjection: boolean;
  contextAwareness: boolean;
  predictivePreloading: boolean;
  deepStealthMode: boolean;
  behavioralMimicry: boolean;
  timingRandomization: boolean;
  aiQualityOptimization: boolean;
  dynamicResolutionScaling: boolean;
  frameRateStabilization: boolean;
  fingerprintMorphing: boolean;
  canvasNoiseAdaptation: boolean;
  webrtcLeakPrevention: boolean;
  memoryOptimization: boolean;
  gpuAcceleration: boolean;
  workerThreads: boolean;
  autoRecovery: boolean;
  redundantStreams: boolean;
  healthMonitoring: boolean;
  advancedMetrics: boolean;
  performanceLogging: boolean;
  anomalyDetection: boolean;
  injectionMode: 'aggressive' | 'balanced' | 'conservative';
  qualityPreset: 'minimum' | 'low' | 'medium' | 'high' | 'maximum';
}

// GPT-5.2 Protocol Settings (alias for advanced AI-powered injection)
export interface Gpt52Settings extends ClaudeProtocolSettings {}

// Protocol 3: Protected Preview Settings
export interface ProtectedPreviewSettings {
  enabled: boolean;
  bodyDetectionSensitivity: 'low' | 'medium' | 'high';
  swapDelayMs: number;
  showOverlayLabel: boolean;
  fallbackToPlaceholder: boolean;
  autoStartCamera: boolean;
}

// Protocol 4: Test Harness Settings
export interface TestHarnessSettings {
  enabled: boolean;
  autoRequestCamera: boolean;
  showDebugOverlay: boolean;
  enableConsoleLogging: boolean;
  simulateLowBandwidth: boolean;
  recordTestResults: boolean;
}

// Combined Protocol Settings
export interface ProtocolSettings {
  standard: StandardInjectionSettings;
  allowlist: AllowlistSettings;
  protected: ProtectedPreviewSettings;
  harness: TestHarnessSettings;
  holographic: HolographicSettings;
  claude: ClaudeProtocolSettings;
  gpt52: Gpt52Settings;
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

export const DEFAULT_CLAUDE_SETTINGS: ClaudeProtocolSettings = {
  enabled: true,
  neuralOptimizationEnabled: true,
  quantumFingerprintEvasion: true,
  behavioralMimicryEnabled: true,
  antiDetectionLevel: 'maximum',
  noiseReductionLevel: 'moderate',
  errorRecoveryMode: 'graceful',
  priorityLevel: 'realtime',
  // Extended properties
  adaptiveInjection: true,
  contextAwareness: true,
  predictivePreloading: true,
  deepStealthMode: true,
  behavioralMimicry: true,
  timingRandomization: true,
  aiQualityOptimization: true,
  dynamicResolutionScaling: true,
  frameRateStabilization: true,
  fingerprintMorphing: true,
  canvasNoiseAdaptation: true,
  webrtcLeakPrevention: true,
  memoryOptimization: true,
  gpuAcceleration: true,
  workerThreads: true,
  autoRecovery: true,
  redundantStreams: true,
  healthMonitoring: true,
  advancedMetrics: true,
  performanceLogging: true,
  anomalyDetection: true,
  injectionMode: 'balanced',
  qualityPreset: 'maximum',
};

export const DEFAULT_GPT52_SETTINGS: Gpt52Settings = {
  ...DEFAULT_CLAUDE_SETTINGS,
};

export const DEFAULT_PROTECTED_SETTINGS: ProtectedPreviewSettings = {
  enabled: true,
  bodyDetectionSensitivity: 'medium',
  swapDelayMs: 150,
  showOverlayLabel: true,
  fallbackToPlaceholder: true,
  autoStartCamera: true,
};

export const DEFAULT_HARNESS_SETTINGS: TestHarnessSettings = {
  enabled: true,
  autoRequestCamera: true,
  showDebugOverlay: false,
  enableConsoleLogging: true,
  simulateLowBandwidth: false,
  recordTestResults: false,
};

export const DEFAULT_PROTOCOL_SETTINGS: ProtocolSettings = {
  standard: DEFAULT_STANDARD_SETTINGS,
  allowlist: DEFAULT_ALLOWLIST_SETTINGS,
  protected: DEFAULT_PROTECTED_SETTINGS,
  harness: DEFAULT_HARNESS_SETTINGS,
  holographic: DEFAULT_HOLOGRAPHIC_SETTINGS,
  claude: DEFAULT_CLAUDE_SETTINGS,
  gpt52: DEFAULT_GPT52_SETTINGS,
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
  claude: {
    id: 'claude',
    name: 'Protocol 5: Claude Neural Injection',
    description: 'AI-powered neural injection with quantum fingerprint evasion, behavioral mimicry, and advanced anti-detection measures.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: true,
  },
  gpt52: {
    id: 'gpt52',
    name: 'Protocol 5: GPT-5.2 Advanced Injection',
    description: 'Next-generation AI-powered video injection with GPT-5.2 neural optimization and advanced stealth capabilities.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: true,
  },
};
