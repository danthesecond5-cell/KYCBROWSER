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
  ClaudeProtocolSettings,
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
  if (settings.bodyDetectionSensitivity !== undefined) {
    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(settings.bodyDetectionSensitivity)) {
      errors.push({
        code: 'INVALID_SENSITIVITY',
        field: 'bodyDetectionSensitivity',
        message: `Sensitivity must be one of: ${validLevels.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Validate swap delay
  if (settings.swapDelayMs !== undefined) {
    if (settings.swapDelayMs < 0) {
      errors.push({
        code: 'INVALID_SWAP_DELAY',
        field: 'swapDelayMs',
        message: 'Swap delay cannot be negative',
        severity: 'error',
      });
    } else if (settings.swapDelayMs > 1000) {
      warnings.push({
        code: 'HIGH_SWAP_DELAY',
        field: 'swapDelayMs',
        message: 'High swap delay may affect user experience',
      });
    }
  }

  // Suggestions
  if (settings.bodyDetectionSensitivity === 'high' && !settings.fallbackToPlaceholder) {
    suggestions.push('Consider enabling fallback placeholder with high sensitivity detection');
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
  if (settings.showDebugOverlay && settings.enabled) {
    suggestions.push('Debug overlay is enabled. Consider disabling for production use.');
  }

  if (settings.simulateLowBandwidth) {
    warnings.push({
      code: 'BANDWIDTH_SIMULATION',
      field: 'simulateLowBandwidth',
      message: 'Low bandwidth simulation is enabled, performance will be affected',
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
 * Validate Claude Protocol Settings
 */
export function validateClaudeSettings(settings: Partial<ClaudeProtocolSettings>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate priority level
  if (settings.priorityLevel !== undefined) {
    if (settings.priorityLevel < 1 || settings.priorityLevel > 100) {
      errors.push({
        code: 'INVALID_PRIORITY',
        field: 'priorityLevel',
        message: 'Priority level must be between 1 and 100',
        severity: 'error',
      });
    }
  }

  // Validate injection mode
  if (settings.injectionMode !== undefined) {
    const validModes = ['aggressive', 'balanced', 'conservative', 'stealth'];
    if (!validModes.includes(settings.injectionMode)) {
      errors.push({
        code: 'INVALID_INJECTION_MODE',
        field: 'injectionMode',
        message: `Injection mode must be one of: ${validModes.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Validate quality preset
  if (settings.qualityPreset !== undefined) {
    const validPresets = ['maximum', 'high', 'balanced', 'performance'];
    if (!validPresets.includes(settings.qualityPreset)) {
      errors.push({
        code: 'INVALID_QUALITY_PRESET',
        field: 'qualityPreset',
        message: `Quality preset must be one of: ${validPresets.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Consistency checks
  if (settings.injectionMode === 'aggressive' && settings.qualityPreset === 'maximum') {
    warnings.push({
      code: 'HIGH_RESOURCE_USAGE',
      field: 'injectionMode',
      message: 'Aggressive mode with maximum quality may cause high resource usage',
    });
  }

  if (settings.deepStealthMode && settings.performanceLogging) {
    suggestions.push('Performance logging may affect stealth. Consider disabling for maximum stealth.');
  }

  if (settings.redundantStreams && !settings.memoryOptimization) {
    suggestions.push('Enable memory optimization when using redundant streams to prevent memory issues.');
  }

  // Feature dependency checks
  if (settings.aiQualityOptimization && !settings.advancedMetrics) {
    warnings.push({
      code: 'MISSING_DEPENDENCY',
      field: 'aiQualityOptimization',
      message: 'AI quality optimization works best with advanced metrics enabled',
    });
  }

  if (settings.autoRecovery && !settings.healthMonitoring) {
    warnings.push({
      code: 'MISSING_DEPENDENCY',
      field: 'autoRecovery',
      message: 'Auto recovery requires health monitoring for optimal function',
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
 * Validate all protocol settings
 */
export function validateProtocolSettings(settings: Partial<ProtocolSettings>): Record<ProtocolId, ValidationResult> {
  return {
    standard: validateStandardSettings(settings.standard || {}),
    allowlist: validateAllowlistSettings(settings.allowlist || {}),
    protected: validateProtectedSettings(settings.protected || {}),
    harness: validateHarnessSettings(settings.harness || {}),
    claude: validateClaudeSettings(settings.claude || {}),
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
    case 'claude':
      return {
        supportsVideo: true,
        supportsAudio: true,
        supportsMotion: true,
        requiresCamera: false,
        requiresNetwork: false,
        stealthLevel: 'maximum',
        performanceImpact: 'high',
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

  if (protocolId === 'claude') {
    let injectionMode: 'aggressive' | 'balanced' | 'conservative' | 'stealth' = 'balanced';
    let qualityPreset: 'maximum' | 'high' | 'balanced' | 'performance' = 'balanced';

    // Adjust based on network
    if (networkQuality === 'poor') {
      qualityPreset = 'performance';
    } else if (networkQuality === 'good') {
      qualityPreset = 'high';
    }

    // Adjust based on device performance
    if (devicePerformance === 'low') {
      qualityPreset = 'performance';
      injectionMode = 'conservative';
    } else if (devicePerformance === 'high') {
      qualityPreset = 'maximum';
    }

    // Adjust based on privacy
    if (privacyConcern === 'high') {
      injectionMode = 'stealth';
    }

    return {
      claude: {
        ...DEFAULT_PROTOCOL_SETTINGS.claude,
        injectionMode,
        qualityPreset,
        memoryOptimization: devicePerformance === 'low',
        gpuAcceleration: devicePerformance !== 'low',
        deepStealthMode: privacyConcern !== 'low',
        behavioralMimicry: privacyConcern !== 'low',
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

  // Check for canvas support
  if (typeof HTMLCanvasElement === 'undefined') {
    missingFeatures.push('Canvas API');
  } else {
    const canvas = document.createElement?.('canvas');
    if (canvas && !canvas.captureStream && !(canvas as any).mozCaptureStream) {
      missingFeatures.push('Canvas captureStream');
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
  if (protocolId === 'claude') {
    // Claude protocol has more advanced requirements
    if (typeof Worker === 'undefined') {
      recommendations.push('Web Workers not available - workerThreads feature will be disabled');
    }
    if (typeof performance === 'undefined' || !performance.now) {
      recommendations.push('High-resolution timing not available - metrics may be less accurate');
    }
  }

  return {
    compatible: missingFeatures.length === 0,
    missingFeatures,
    recommendations,
  };
}
