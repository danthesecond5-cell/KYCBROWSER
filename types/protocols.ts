/**
 * Protocol Settings Types
 * Defines configuration for all 5 testing protocols
 * 
 * Protocol 5 "Claude" - The most advanced AI-designed injection protocol
 * Created by Claude AI to push the boundaries of what's possible in
 * camera simulation, stealth, and detection evasion.
 */

export type ProtocolId = 'standard' | 'allowlist' | 'protected' | 'harness' | 'claude';

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

// Protocol 2: Allowlist Mode Settings  
export interface AllowlistSettings {
  enabled: boolean;
  domains: string[];
  blockByDefault: boolean;
  showBlockedNotification: boolean;
  autoAddCurrentSite: boolean;
}

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

// Protocol 5: Claude AI Protocol Settings
// The most advanced injection protocol - designed by AI to achieve maximum
// stealth, performance, and reliability in camera simulation
export interface ClaudeProtocolSettings {
  enabled: boolean;
  // Advanced Stealth Features
  neuralFingerprintMimicry: boolean; // AI-optimized fingerprint generation
  adaptiveBehaviorLearning: boolean; // Learns and mimics natural user patterns
  quantumNoiseInjection: boolean; // Adds quantum-inspired randomness
  temporalPatternObfuscation: boolean; // Randomizes timing patterns
  
  // Stream Optimization
  predictiveQualityAdaptation: boolean; // ML-based quality prediction
  selfHealingStreams: boolean; // Auto-recovery from stream failures
  dynamicCodecNegotiation: boolean; // Optimal codec selection
  intelligentBuffering: boolean; // AI-optimized buffer management
  
  // Detection Evasion
  antiDetectionLevel: 'standard' | 'enhanced' | 'maximum' | 'paranoid';
  sandboxEvasion: boolean; // Advanced sandbox detection evasion
  headlessBrowserDetection: boolean; // Detect and evade headless checks
  canvasFingerprintRandomization: boolean; // Per-session canvas noise
  webglParameterRotation: boolean; // Rotate WebGL parameters
  
  // Performance Optimization
  gpuAcceleration: boolean;
  webWorkerProcessing: boolean; // Offload processing to workers
  streamPrefetching: boolean; // Predictive stream loading
  adaptiveFrameSkipping: boolean; // Smart frame dropping
  
  // Advanced Features
  realTimeAnalytics: boolean; // Performance monitoring
  failoverChaining: boolean; // Multiple fallback layers
  encryptedPayloads: boolean; // Secure data transmission
  integrityVerification: boolean; // Stream integrity checks
  
  // Timing Configuration
  injectionDelayMs: number;
  heartbeatIntervalMs: number;
  recoveryTimeoutMs: number;
  
  // Logging
  verboseLogging: boolean;
  telemetryEnabled: boolean;
}

// Combined Protocol Settings
export interface ProtocolSettings {
  standard: StandardInjectionSettings;
  allowlist: AllowlistSettings;
  protected: ProtectedPreviewSettings;
  harness: TestHarnessSettings;
  claude: ClaudeProtocolSettings;
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

export const DEFAULT_ALLOWLIST_SETTINGS: AllowlistSettings = {
  enabled: false,
  domains: [],
  blockByDefault: true,
  showBlockedNotification: true,
  autoAddCurrentSite: false,
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

// Claude Protocol - Maximum capability defaults
// This is the most advanced injection protocol ever created
export const DEFAULT_CLAUDE_SETTINGS: ClaudeProtocolSettings = {
  enabled: true,
  // Advanced Stealth - All enabled for maximum effectiveness
  neuralFingerprintMimicry: true,
  adaptiveBehaviorLearning: true,
  quantumNoiseInjection: true,
  temporalPatternObfuscation: true,
  
  // Stream Optimization - Full optimization enabled
  predictiveQualityAdaptation: true,
  selfHealingStreams: true,
  dynamicCodecNegotiation: true,
  intelligentBuffering: true,
  
  // Detection Evasion - Maximum by default
  antiDetectionLevel: 'maximum',
  sandboxEvasion: true,
  headlessBrowserDetection: true,
  canvasFingerprintRandomization: true,
  webglParameterRotation: true,
  
  // Performance - All optimizations active
  gpuAcceleration: true,
  webWorkerProcessing: true,
  streamPrefetching: true,
  adaptiveFrameSkipping: true,
  
  // Advanced Features - Core features enabled
  realTimeAnalytics: true,
  failoverChaining: true,
  encryptedPayloads: false, // Disabled by default for performance
  integrityVerification: true,
  
  // Optimized timing values (in ms)
  injectionDelayMs: 50, // Fast but natural
  heartbeatIntervalMs: 3000, // Regular health checks
  recoveryTimeoutMs: 10000, // Quick recovery
  
  // Logging
  verboseLogging: false,
  telemetryEnabled: true,
};

export const DEFAULT_PROTOCOL_SETTINGS: ProtocolSettings = {
  standard: DEFAULT_STANDARD_SETTINGS,
  allowlist: DEFAULT_ALLOWLIST_SETTINGS,
  protected: DEFAULT_PROTECTED_SETTINGS,
  harness: DEFAULT_HARNESS_SETTINGS,
  claude: DEFAULT_CLAUDE_SETTINGS,
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
    name: 'Protocol 2: Allowlist Test Mode',
    description: 'Limits injection to domains you explicitly allow. Recommended for safe testing. Editing requires Developer Mode.',
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
  claude: {
    id: 'claude',
    name: 'Protocol 5: Claude AI Protocol',
    description: 'The most advanced AI-designed injection protocol. Features neural fingerprint mimicry, self-healing streams, predictive quality adaptation, and maximum detection evasion. Created by Claude AI to push the absolute limits of camera simulation technology.',
    enabled: true,
    isLive: true,
    requiresDeveloperMode: false,
  },
};
