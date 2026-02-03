/**
 * Protocol Validator
 * 
 * Provides comprehensive validation and health checking for all injection protocols.
 * Ensures protocol configurations are valid and systems are operating correctly.
 */

import { 
  ProtocolId, 
  ProtocolSettings, 
  StandardInjectionSettings,
  AllowlistSettings,
  ProtectedPreviewSettings,
  TestHarnessSettings,
  HolographicSettings,
  WebSocketBridgeSettings,
  WebRtcLoopbackSettings,
  DEFAULT_PROTOCOL_SETTINGS,
} from '@/types/protocols';

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

// Health check types
export interface HealthCheckResult {
  healthy: boolean;
  checks: HealthCheck[];
  overallScore: number; // 0-100
  timestamp: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: string | number;
  threshold?: string | number;
}

// Protocol capability types
export interface ProtocolCapabilities {
  supportsVideo: boolean;
  supportsAudio: boolean;
  supportsMotion: boolean;
  requiresCamera: boolean;
  requiresNetwork: boolean;
  stealthLevel: 'none' | 'basic' | 'advanced' | 'maximum';
  performanceImpact: 'low' | 'medium' | 'high';
}

/**
 * Validate Standard Injection Settings
 */
export function validateStandardSettings(settings: Partial<StandardInjectionSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate injection delay
  if (settings.injectionDelay !== undefined) {
    if (settings.injectionDelay < 0) {
      errors.push({
        code: 'INVALID_DELAY',
        field: 'injectionDelay',
        message: 'Injection delay cannot be negative',
        severity: 'error',
      });
    } else if (settings.injectionDelay > 5000) {
      warnings.push({
        code: 'HIGH_DELAY',
        field: 'injectionDelay',
        message: 'High injection delay may cause noticeable lag',
      });
    }
  }

  // Validate max retries
  if (settings.maxRetries !== undefined) {
    if (settings.maxRetries < 0 || settings.maxRetries > 10) {
      errors.push({
        code: 'INVALID_RETRIES',
        field: 'maxRetries',
        message: 'Max retries must be between 0 and 10',
        severity: 'error',
      });
    }
  }

  // Validate logging level
  if (settings.loggingLevel !== undefined) {
    const validLevels = ['none', 'minimal', 'verbose'];
    if (!validLevels.includes(settings.loggingLevel)) {
      errors.push({
        code: 'INVALID_LOGGING_LEVEL',
        field: 'loggingLevel',
        message: `Logging level must be one of: ${validLevels.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Suggestions
  if (settings.stealthByDefault && settings.loggingLevel === 'verbose') {
    suggestions.push('Consider using minimal logging in stealth mode for better performance');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate Allowlist Settings
 */
export function validateAllowlistSettings(settings: Partial<AllowlistSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate domains
  if (settings.domains !== undefined) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
    
    settings.domains.forEach((domain, index) => {
      if (!domain || domain.trim().length === 0) {
        errors.push({
          code: 'EMPTY_DOMAIN',
          field: `domains[${index}]`,
          message: 'Domain cannot be empty',
          severity: 'error',
        });
      } else if (!domainRegex.test(domain.trim())) {
        warnings.push({
          code: 'INVALID_DOMAIN_FORMAT',
          field: `domains[${index}]`,
          message: `Domain "${domain}" may not be valid`,
        });
      }
    });

    // Check for duplicates
    const uniqueDomains = new Set(settings.domains.map(d => d.toLowerCase().trim()));
    if (uniqueDomains.size < settings.domains.length) {
      warnings.push({
        code: 'DUPLICATE_DOMAINS',
        field: 'domains',
        message: 'There are duplicate domains in the allowlist',
      });
    }
  }

  // Suggestions
  if (settings.enabled && (!settings.domains || settings.domains.length === 0)) {
    suggestions.push('Allowlist is enabled but empty. Add domains or disable the allowlist.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate Protected Preview Settings
 */
export function validateProtectedSettings(settings: Partial<ProtectedPreviewSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate sensitivity level
  if (settings.sensitivityLevel !== undefined) {
    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(settings.sensitivityLevel)) {
      errors.push({
        code: 'INVALID_SENSITIVITY',
        field: 'sensitivityLevel',
        message: `Sensitivity must be one of: ${validLevels.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Suggestions
  if (settings.sensitivityLevel === 'high' && !settings.blurFallback) {
    suggestions.push('Consider enabling blur fallback with high sensitivity detection');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate Test Harness Settings
 */
export function validateHarnessSettings(settings: Partial<TestHarnessSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // No critical validation needed for harness settings
  // Add warnings for debugging in production
  if (settings.showDebugInfo && settings.overlayEnabled) {
    suggestions.push('Debug info is enabled. Consider disabling for production use.');
  }

  // Validate capture frame rate
  if (settings.captureFrameRate !== undefined) {
    if (settings.captureFrameRate < 1 || settings.captureFrameRate > 60) {
      errors.push({
        code: 'INVALID_FRAME_RATE',
        field: 'captureFrameRate',
        message: 'Capture frame rate must be between 1 and 60',
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate Holographic Protocol Settings
 */
export function validateHolographicSettings(settings: Partial<HolographicSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate frame rate
  if (settings.frameRate !== undefined) {
    if (settings.frameRate !== 30 && settings.frameRate !== 60) {
      errors.push({
        code: 'INVALID_FRAME_RATE',
        field: 'frameRate',
        message: 'Frame rate must be 30 or 60',
        severity: 'error',
      });
    }
  }

  // Validate noise injection level
  if (settings.noiseInjectionLevel !== undefined) {
    if (settings.noiseInjectionLevel < 0 || settings.noiseInjectionLevel > 1) {
      errors.push({
        code: 'INVALID_NOISE_LEVEL',
        field: 'noiseInjectionLevel',
        message: 'Noise injection level must be between 0 and 1',
        severity: 'error',
      });
    }
  }

  // Validate latency mode
  if (settings.latencyMode !== undefined) {
    const validModes = ['ultra-low', 'balanced', 'quality'];
    if (!validModes.includes(settings.latencyMode)) {
      errors.push({
        code: 'INVALID_LATENCY_MODE',
        field: 'latencyMode',
        message: `Latency mode must be one of: ${validModes.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Validate canvas resolution
  if (settings.canvasResolution !== undefined) {
    const validResolutions = ['720p', '1080p', '4k'];
    if (!validResolutions.includes(settings.canvasResolution)) {
      errors.push({
        code: 'INVALID_RESOLUTION',
        field: 'canvasResolution',
        message: `Canvas resolution must be one of: ${validResolutions.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Performance warnings
  if (settings.canvasResolution === '4k' && settings.frameRate === 60) {
    warnings.push({
      code: 'HIGH_RESOURCE_USAGE',
      field: 'canvasResolution',
      message: '4K at 60fps may cause high resource usage on some devices',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate WebSocket Bridge Settings
 */
export function validateWebSocketSettings(settings: Partial<WebSocketBridgeSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  if (settings.port !== undefined) {
    if (settings.port < 1 || settings.port > 65535) {
      errors.push({
        code: 'INVALID_PORT',
        field: 'port',
        message: 'Port must be between 1 and 65535',
        severity: 'error',
      });
    }
  }

  if (settings.frameRate !== undefined) {
    if (settings.frameRate < 1 || settings.frameRate > 60) {
      errors.push({
        code: 'INVALID_FRAMERATE',
        field: 'frameRate',
        message: 'Frame rate must be between 1 and 60',
        severity: 'error',
      });
    }
  }

  if (settings.quality !== undefined) {
    if (settings.quality < 0 || settings.quality > 1) {
      errors.push({
        code: 'INVALID_QUALITY',
        field: 'quality',
        message: 'Quality must be between 0 and 1',
        severity: 'error',
      });
    } else if (settings.quality > 0.95) {
      warnings.push({
        code: 'HIGH_QUALITY',
        field: 'quality',
        message: 'Quality above 0.95 can increase CPU usage',
      });
    }
  }

  if (settings.resolution !== undefined) {
    const validResolutions = ['720p', '1080p', '4k'];
    if (!validResolutions.includes(settings.resolution)) {
      errors.push({
        code: 'INVALID_RESOLUTION',
        field: 'resolution',
        message: `Resolution must be one of: ${validResolutions.join(', ')}`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate WebRTC Loopback Settings
 */
export function validateWebRtcLoopbackSettings(settings: Partial<WebRtcLoopbackSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  if (settings.iceServers && !Array.isArray(settings.iceServers)) {
    errors.push({
      code: 'INVALID_ICE_SERVERS',
      field: 'iceServers',
      message: 'ICE servers must be an array',
      severity: 'error',
    });
  }

  if (settings.preferredCodec) {
    const valid = ['auto', 'h264', 'vp8', 'vp9', 'av1'];
    if (!valid.includes(settings.preferredCodec)) {
      errors.push({
        code: 'INVALID_CODEC',
        field: 'preferredCodec',
        message: `Preferred codec must be one of: ${valid.join(', ')}`,
        severity: 'error',
      });
    }
  }

  if (settings.maxBitrateKbps !== undefined) {
    if (settings.maxBitrateKbps < 0) {
      errors.push({
        code: 'INVALID_BITRATE',
        field: 'maxBitrateKbps',
        message: 'Max bitrate must be >= 0',
        severity: 'error',
      });
    } else if (settings.maxBitrateKbps > 50000) {
      warnings.push({
        code: 'HIGH_BITRATE',
        field: 'maxBitrateKbps',
        message: 'Max bitrate > 50000 kbps may be unstable on mobile networks',
      });
    }
  }

  if (settings.minBitrateKbps !== undefined && settings.minBitrateKbps < 0) {
    errors.push({
      code: 'INVALID_MIN_BITRATE',
      field: 'minBitrateKbps',
      message: 'Min bitrate must be >= 0',
      severity: 'error',
    });
  }

  if (settings.targetBitrateKbps !== undefined && settings.targetBitrateKbps < 0) {
    errors.push({
      code: 'INVALID_TARGET_BITRATE',
      field: 'targetBitrateKbps',
      message: 'Target bitrate must be >= 0',
      severity: 'error',
    });
  }

  if (settings.ringBufferSeconds !== undefined && settings.ringBufferSeconds < 1) {
    warnings.push({
      code: 'LOW_RING_BUFFER',
      field: 'ringBufferSeconds',
      message: 'Ring buffer < 1s may be too small for playback',
    });
  }

  if (settings.ringSegmentSeconds !== undefined && settings.ringSegmentSeconds < 1) {
    warnings.push({
      code: 'LOW_RING_SEGMENT',
      field: 'ringSegmentSeconds',
      message: 'Ring segment < 1s may create excessive segment churn',
    });
  }

  if (settings.cacheTTLHours !== undefined && settings.cacheTTLHours < 1) {
    warnings.push({
      code: 'LOW_CACHE_TTL',
      field: 'cacheTTLHours',
      message: 'Cache TTL < 1 hour may cause frequent re-downloads',
    });
  }

  if (settings.cacheMaxSizeMB !== undefined && settings.cacheMaxSizeMB < 50) {
    warnings.push({
      code: 'LOW_CACHE_SIZE',
      field: 'cacheMaxSizeMB',
      message: 'Cache max size < 50MB may be too small for videos',
    });
  }

  if (settings.signalingTimeoutMs !== undefined) {
    if (settings.signalingTimeoutMs < 1000) {
      warnings.push({
        code: 'LOW_SIGNAL_TIMEOUT',
        field: 'signalingTimeoutMs',
        message: 'Timeout < 1000ms may not allow enough time for WebRTC negotiation',
      });
    } else if (settings.signalingTimeoutMs > 60000) {
      warnings.push({
        code: 'HIGH_SIGNAL_TIMEOUT',
        field: 'signalingTimeoutMs',
        message: 'Timeout > 60000ms may delay failure feedback',
      });
    }
  }

  if (settings.keepAliveIntervalMs !== undefined) {
    if (settings.keepAliveIntervalMs < 1000) {
      warnings.push({
        code: 'LOW_KEEPALIVE',
        field: 'keepAliveIntervalMs',
        message: 'Keepalive < 1000ms may be too aggressive',
      });
    }
  }

  if (settings.statsIntervalMs !== undefined) {
    if (settings.statsIntervalMs < 500) {
      warnings.push({
        code: 'LOW_STATS_INTERVAL',
        field: 'statsIntervalMs',
        message: 'Stats interval < 500ms may impact performance',
      });
    }
  }

  if (settings.requireNativeBridge === false) {
    suggestions.push('Disable requireNativeBridge only if a custom bridge is available');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate all protocol settings
 */
export function validateProtocolSettings(settings: Partial<ProtocolSettings>): Record<ProtocolId, ValidationResult> {
  return {
    standard: validateStandardSettings(settings.standard || {}),
    allowlist: validateAllowlistSettings(settings.allowlist || {}),
    protected: validateProtectedSettings(settings.protected || {}),
    harness: validateHarnessSettings(settings.harness || {}),
    holographic: validateHolographicSettings(settings.holographic || {}),
    websocket: validateWebSocketSettings(settings.websocket || {}),
    'webrtc-loopback': validateWebRtcLoopbackSettings(settings.webrtcLoopback || {}),
  };
}

/**
 * Get protocol capabilities
 */
export function getProtocolCapabilities(protocolId: ProtocolId): ProtocolCapabilities {
  switch (protocolId) {
    case 'standard':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: true,
        requiresCamera: false,
        requiresNetwork: false,
        stealthLevel: 'advanced',
        performanceImpact: 'medium',
      };
    case 'allowlist':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: true,
        requiresCamera: false,
        requiresNetwork: true,
        stealthLevel: 'advanced',
        performanceImpact: 'medium',
      };
    case 'protected':
      return {
        supportsVideo: true,
        supportsAudio: false,
        supportsMotion: false,
        requiresCamera: true,
        requiresNetwork: false,
        stealthLevel: 'basic',
        performanceImpact: 'high',
      };
    case 'harness':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: false,
        requiresCamera: true,
        requiresNetwork: false,
        stealthLevel: 'none',
        performanceImpact: 'low',
      };
    case 'holographic':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: true,
        requiresCamera: false,
        requiresNetwork: true,
        stealthLevel: 'maximum',
        performanceImpact: 'high',
      };
    case 'websocket':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: false,
        requiresCamera: false,
        requiresNetwork: false,
        stealthLevel: 'advanced',
        performanceImpact: 'medium',
      };
    case 'webrtc-loopback':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: false,
        requiresCamera: false,
        requiresNetwork: true,
        stealthLevel: 'advanced',
        performanceImpact: 'medium',
      };
  }
}

/**
 * Perform health check for a protocol
 */
export function performProtocolHealthCheck(
  protocolId: ProtocolId,
  settings: ProtocolSettings,
  runtimeMetrics?: {
    fps?: number;
    latency?: number;
    errorCount?: number;
    memoryUsage?: number;
  }
): HealthCheckResult {
  const checks: HealthCheck[] = [];
  let score = 100;

  // Configuration validation check
  const validationResult = validateProtocolSettings(settings);
  const protocolValidation = validationResult[protocolId];
  
  if (!protocolValidation.valid) {
    checks.push({
      name: 'Configuration Validation',
      status: 'fail',
      message: `${protocolValidation.errors.length} configuration errors found`,
      value: protocolValidation.errors.length,
    });
    score -= 30;
  } else if (protocolValidation.warnings.length > 0) {
    checks.push({
      name: 'Configuration Validation',
      status: 'warn',
      message: `${protocolValidation.warnings.length} warnings found`,
      value: protocolValidation.warnings.length,
    });
    score -= 10;
  } else {
    checks.push({
      name: 'Configuration Validation',
      status: 'pass',
      message: 'All settings are valid',
    });
  }

  // Runtime metrics checks (if available)
  if (runtimeMetrics) {
    // FPS check
    if (runtimeMetrics.fps !== undefined) {
      if (runtimeMetrics.fps < 15) {
        checks.push({
          name: 'Frame Rate',
          status: 'fail',
          message: 'FPS is critically low',
          value: runtimeMetrics.fps,
          threshold: 15,
        });
        score -= 25;
      } else if (runtimeMetrics.fps < 25) {
        checks.push({
          name: 'Frame Rate',
          status: 'warn',
          message: 'FPS is below optimal',
          value: runtimeMetrics.fps,
          threshold: 25,
        });
        score -= 10;
      } else {
        checks.push({
          name: 'Frame Rate',
          status: 'pass',
          message: 'FPS is healthy',
          value: runtimeMetrics.fps,
        });
      }
    }

    // Latency check
    if (runtimeMetrics.latency !== undefined) {
      if (runtimeMetrics.latency > 500) {
        checks.push({
          name: 'Latency',
          status: 'fail',
          message: 'High latency detected',
          value: `${runtimeMetrics.latency}ms`,
          threshold: '500ms',
        });
        score -= 20;
      } else if (runtimeMetrics.latency > 200) {
        checks.push({
          name: 'Latency',
          status: 'warn',
          message: 'Moderate latency',
          value: `${runtimeMetrics.latency}ms`,
          threshold: '200ms',
        });
        score -= 5;
      } else {
        checks.push({
          name: 'Latency',
          status: 'pass',
          message: 'Latency is acceptable',
          value: `${runtimeMetrics.latency}ms`,
        });
      }
    }

    // Error count check
    if (runtimeMetrics.errorCount !== undefined) {
      if (runtimeMetrics.errorCount > 10) {
        checks.push({
          name: 'Error Rate',
          status: 'fail',
          message: 'High error count',
          value: runtimeMetrics.errorCount,
          threshold: 10,
        });
        score -= 25;
      } else if (runtimeMetrics.errorCount > 0) {
        checks.push({
          name: 'Error Rate',
          status: 'warn',
          message: 'Some errors detected',
          value: runtimeMetrics.errorCount,
        });
        score -= runtimeMetrics.errorCount * 2;
      } else {
        checks.push({
          name: 'Error Rate',
          status: 'pass',
          message: 'No errors',
        });
      }
    }

    // Memory usage check
    if (runtimeMetrics.memoryUsage !== undefined) {
      const memoryMB = runtimeMetrics.memoryUsage / (1024 * 1024);
      if (memoryMB > 500) {
        checks.push({
          name: 'Memory Usage',
          status: 'fail',
          message: 'High memory usage',
          value: `${memoryMB.toFixed(0)}MB`,
          threshold: '500MB',
        });
        score -= 15;
      } else if (memoryMB > 200) {
        checks.push({
          name: 'Memory Usage',
          status: 'warn',
          message: 'Elevated memory usage',
          value: `${memoryMB.toFixed(0)}MB`,
          threshold: '200MB',
        });
        score -= 5;
      } else {
        checks.push({
          name: 'Memory Usage',
          status: 'pass',
          message: 'Memory usage is normal',
          value: `${memoryMB.toFixed(0)}MB`,
        });
      }
    }
  }

  return {
    healthy: score >= 70,
    checks,
    overallScore: Math.max(0, score),
    timestamp: Date.now(),
  };
}

/**
 * Get recommended settings for a protocol based on current conditions
 */
export function getRecommendedSettings(
  protocolId: ProtocolId,
  conditions: {
    networkQuality?: 'poor' | 'moderate' | 'good';
    devicePerformance?: 'low' | 'medium' | 'high';
    privacyConcern?: 'low' | 'medium' | 'high';
  }
): Partial<ProtocolSettings> {
  const { networkQuality = 'good', devicePerformance = 'medium', privacyConcern = 'medium' } = conditions;

  if (protocolId === 'holographic') {
    let latencyMode: 'ultra-low' | 'balanced' | 'quality' = 'balanced';
    let canvasResolution: '720p' | '1080p' | '4k' = '1080p';
    let frameRate: 30 | 60 = 30;

    // Adjust based on network
    if (networkQuality === 'poor') {
      canvasResolution = '720p';
      latencyMode = 'ultra-low';
    } else if (networkQuality === 'good') {
      canvasResolution = '1080p';
      latencyMode = 'quality';
    }

    // Adjust based on device performance
    if (devicePerformance === 'low') {
      canvasResolution = '720p';
      frameRate = 30;
    } else if (devicePerformance === 'high') {
      canvasResolution = '1080p';
      frameRate = 60;
    }

    return {
      holographic: {
        ...DEFAULT_PROTOCOL_SETTINGS.holographic,
        latencyMode,
        canvasResolution,
        frameRate,
        sdpMasquerade: privacyConcern !== 'low',
      },
    };
  }

  // Return default settings for other protocols
  return {};
}

/**
 * Check if protocol is compatible with current environment
 */
export function checkProtocolCompatibility(protocolId: ProtocolId): {
  compatible: boolean;
  missingFeatures: string[];
  recommendations: string[];
} {
  const missingFeatures: string[] = [];
  const recommendations: string[] = [];

  // Check for required browser features
  if (typeof navigator === 'undefined') {
    missingFeatures.push('Navigator API');
  } else {
    if (!navigator.mediaDevices) {
      missingFeatures.push('MediaDevices API');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      missingFeatures.push('getUserMedia');
    }
    if (!navigator.mediaDevices?.enumerateDevices) {
      missingFeatures.push('enumerateDevices');
    }
  }

  const requiresCanvasCapture = protocolId !== 'webrtc-loopback';
  if (requiresCanvasCapture) {
    // Check for canvas support
    if (typeof HTMLCanvasElement === 'undefined') {
      missingFeatures.push('Canvas API');
    } else {
      const canvas = document.createElement?.('canvas');
      if (canvas && !canvas.captureStream && !(canvas as any).mozCaptureStream) {
        missingFeatures.push('Canvas captureStream');
      }
    }
  }

  // Check for WebRTC (needed for some features)
  if (typeof RTCPeerConnection === 'undefined') {
    recommendations.push('WebRTC is not available - some stealth features may be limited');
  }

  // Check for AudioContext
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    recommendations.push('AudioContext not available - audio injection will be limited');
  }

  // Protocol-specific checks
  if (protocolId === 'holographic') {
    // Holographic protocol has more advanced requirements
    if (typeof Worker === 'undefined') {
      recommendations.push('Web Workers not available - some features will be disabled');
    }
    if (typeof WebSocket === 'undefined') {
      missingFeatures.push('WebSocket API');
    }
  }
  if (protocolId === 'websocket') {
    if (!(window as any).ReactNativeWebView) {
      recommendations.push('ReactNativeWebView bridge missing - WebSocket bridge requires RN postMessage');
    }
  }
  if (protocolId === 'webrtc-loopback') {
    if (typeof RTCPeerConnection === 'undefined') {
      missingFeatures.push('WebRTC RTCPeerConnection');
    }
    if (!(window as any).ReactNativeWebView) {
      recommendations.push('ReactNativeWebView bridge missing - native loopback required');
    }
  }

  return {
    compatible: missingFeatures.length === 0,
    missingFeatures,
    recommendations,
  };
}
