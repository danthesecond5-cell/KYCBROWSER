/**
 * Protocol Types Tests
 * 
 * Tests for protocol type definitions and default values.
 */

import {
  ProtocolId,
  ProtocolSettings,
  StandardInjectionSettings,
  AllowlistSettings,
  ProtectedPreviewSettings,
  TestHarnessSettings,
  ClaudeProtocolSettings,
  DEFAULT_STANDARD_SETTINGS,
  DEFAULT_ALLOWLIST_SETTINGS,
  DEFAULT_PROTECTED_SETTINGS,
  DEFAULT_HARNESS_SETTINGS,
  DEFAULT_CLAUDE_SETTINGS,
  DEFAULT_PROTOCOL_SETTINGS,
  DEFAULT_DEVELOPER_MODE,
  PROTOCOL_METADATA,
} from '@/types/protocols';

describe('Protocol Types', () => {
  describe('ProtocolId', () => {
    it('should include all 5 protocol types', () => {
      const validIds: ProtocolId[] = ['standard', 'allowlist', 'protected', 'harness', 'claude'];
      
      validIds.forEach(id => {
        expect(PROTOCOL_METADATA[id]).toBeDefined();
      });
    });
  });

  describe('DEFAULT_STANDARD_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_STANDARD_SETTINGS.enabled).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.autoInject).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.stealthByDefault).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.injectionDelay).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.retryOnFail).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.maxRetries).toBeDefined();
      expect(DEFAULT_STANDARD_SETTINGS.loggingLevel).toBeDefined();
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_STANDARD_SETTINGS.enabled).toBe(true);
      expect(DEFAULT_STANDARD_SETTINGS.autoInject).toBe(true);
      expect(DEFAULT_STANDARD_SETTINGS.stealthByDefault).toBe(true);
      expect(DEFAULT_STANDARD_SETTINGS.injectionDelay).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_STANDARD_SETTINGS.maxRetries).toBeGreaterThan(0);
      expect(DEFAULT_STANDARD_SETTINGS.maxRetries).toBeLessThanOrEqual(10);
    });
  });

  describe('DEFAULT_ALLOWLIST_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_ALLOWLIST_SETTINGS.enabled).toBeDefined();
      expect(DEFAULT_ALLOWLIST_SETTINGS.domains).toBeDefined();
      expect(DEFAULT_ALLOWLIST_SETTINGS.blockByDefault).toBeDefined();
      expect(DEFAULT_ALLOWLIST_SETTINGS.showBlockedNotification).toBeDefined();
      expect(DEFAULT_ALLOWLIST_SETTINGS.autoAddCurrentSite).toBeDefined();
    });

    it('should be disabled by default for safety', () => {
      expect(DEFAULT_ALLOWLIST_SETTINGS.enabled).toBe(false);
    });

    it('should have empty domains list by default', () => {
      expect(Array.isArray(DEFAULT_ALLOWLIST_SETTINGS.domains)).toBe(true);
      expect(DEFAULT_ALLOWLIST_SETTINGS.domains.length).toBe(0);
    });
  });

  describe('DEFAULT_PROTECTED_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_PROTECTED_SETTINGS.enabled).toBeDefined();
      expect(DEFAULT_PROTECTED_SETTINGS.bodyDetectionSensitivity).toBeDefined();
      expect(DEFAULT_PROTECTED_SETTINGS.swapDelayMs).toBeDefined();
      expect(DEFAULT_PROTECTED_SETTINGS.showOverlayLabel).toBeDefined();
      expect(DEFAULT_PROTECTED_SETTINGS.fallbackToPlaceholder).toBeDefined();
      expect(DEFAULT_PROTECTED_SETTINGS.autoStartCamera).toBeDefined();
    });

    it('should have medium sensitivity by default', () => {
      expect(DEFAULT_PROTECTED_SETTINGS.bodyDetectionSensitivity).toBe('medium');
    });
  });

  describe('DEFAULT_HARNESS_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_HARNESS_SETTINGS.enabled).toBeDefined();
      expect(DEFAULT_HARNESS_SETTINGS.autoRequestCamera).toBeDefined();
      expect(DEFAULT_HARNESS_SETTINGS.showDebugOverlay).toBeDefined();
      expect(DEFAULT_HARNESS_SETTINGS.enableConsoleLogging).toBeDefined();
      expect(DEFAULT_HARNESS_SETTINGS.simulateLowBandwidth).toBeDefined();
      expect(DEFAULT_HARNESS_SETTINGS.recordTestResults).toBeDefined();
    });

    it('should have debug overlay disabled by default', () => {
      expect(DEFAULT_HARNESS_SETTINGS.showDebugOverlay).toBe(false);
    });
  });

  describe('DEFAULT_CLAUDE_SETTINGS', () => {
    it('should have all core feature properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.enabled).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.adaptiveInjection).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.contextAwareness).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.predictivePreloading).toBeDefined();
    });

    it('should have all stealth feature properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.deepStealthMode).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.behavioralMimicry).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.timingRandomization).toBeDefined();
    });

    it('should have all quality control properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.aiQualityOptimization).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.dynamicResolutionScaling).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.frameRateStabilization).toBeDefined();
    });

    it('should have all detection evasion properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.fingerprintMorphing).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.canvasNoiseAdaptation).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.webrtcLeakPrevention).toBeDefined();
    });

    it('should have all performance properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.memoryOptimization).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.gpuAcceleration).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.workerThreads).toBeDefined();
    });

    it('should have all reliability properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.autoRecovery).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.redundantStreams).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.healthMonitoring).toBeDefined();
    });

    it('should have all metrics properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.advancedMetrics).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.performanceLogging).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.anomalyDetection).toBeDefined();
    });

    it('should have configuration properties', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.priorityLevel).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.injectionMode).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.qualityPreset).toBeDefined();
    });

    it('should enable all features by default for maximum capability', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.enabled).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.adaptiveInjection).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.deepStealthMode).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.behavioralMimicry).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.aiQualityOptimization).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.autoRecovery).toBe(true);
    });

    it('should have highest priority level', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.priorityLevel).toBe(100);
    });

    it('should have balanced injection mode', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.injectionMode).toBe('balanced');
    });

    it('should have maximum quality preset', () => {
      expect(DEFAULT_CLAUDE_SETTINGS.qualityPreset).toBe('maximum');
    });
  });

  describe('DEFAULT_PROTOCOL_SETTINGS', () => {
    it('should include all 5 protocol settings', () => {
      expect(DEFAULT_PROTOCOL_SETTINGS.standard).toBeDefined();
      expect(DEFAULT_PROTOCOL_SETTINGS.allowlist).toBeDefined();
      expect(DEFAULT_PROTOCOL_SETTINGS.protected).toBeDefined();
      expect(DEFAULT_PROTOCOL_SETTINGS.harness).toBeDefined();
      expect(DEFAULT_PROTOCOL_SETTINGS.claude).toBeDefined();
    });

    it('should use correct default settings for each protocol', () => {
      expect(DEFAULT_PROTOCOL_SETTINGS.standard).toEqual(DEFAULT_STANDARD_SETTINGS);
      expect(DEFAULT_PROTOCOL_SETTINGS.allowlist).toEqual(DEFAULT_ALLOWLIST_SETTINGS);
      expect(DEFAULT_PROTOCOL_SETTINGS.protected).toEqual(DEFAULT_PROTECTED_SETTINGS);
      expect(DEFAULT_PROTOCOL_SETTINGS.harness).toEqual(DEFAULT_HARNESS_SETTINGS);
      expect(DEFAULT_PROTOCOL_SETTINGS.claude).toEqual(DEFAULT_CLAUDE_SETTINGS);
    });
  });

  describe('DEFAULT_DEVELOPER_MODE', () => {
    it('should be disabled by default for safety', () => {
      expect(DEFAULT_DEVELOPER_MODE.enabled).toBe(false);
    });

    it('should have default PIN set', () => {
      expect(DEFAULT_DEVELOPER_MODE.pinCode).toBe('0000');
    });

    it('should show watermark by default', () => {
      expect(DEFAULT_DEVELOPER_MODE.showWatermark).toBe(true);
    });

    it('should allow protocol and allowlist editing', () => {
      expect(DEFAULT_DEVELOPER_MODE.allowProtocolEditing).toBe(true);
      expect(DEFAULT_DEVELOPER_MODE.allowAllowlistEditing).toBe(true);
    });

    it('should not bypass security checks by default', () => {
      expect(DEFAULT_DEVELOPER_MODE.bypassSecurityChecks).toBe(false);
    });
  });

  describe('PROTOCOL_METADATA', () => {
    it('should have metadata for all 5 protocols', () => {
      const protocolIds: ProtocolId[] = ['standard', 'allowlist', 'protected', 'harness', 'claude'];
      
      protocolIds.forEach(id => {
        expect(PROTOCOL_METADATA[id]).toBeDefined();
        expect(PROTOCOL_METADATA[id].id).toBe(id);
        expect(PROTOCOL_METADATA[id].name).toBeDefined();
        expect(PROTOCOL_METADATA[id].description).toBeDefined();
        expect(typeof PROTOCOL_METADATA[id].enabled).toBe('boolean');
        expect(typeof PROTOCOL_METADATA[id].isLive).toBe('boolean');
        expect(typeof PROTOCOL_METADATA[id].requiresDeveloperMode).toBe('boolean');
      });
    });

    it('should have correct names for protocols', () => {
      expect(PROTOCOL_METADATA.standard.name).toContain('Standard');
      expect(PROTOCOL_METADATA.allowlist.name).toContain('Allowlist');
      expect(PROTOCOL_METADATA.protected.name).toContain('Protected');
      expect(PROTOCOL_METADATA.harness.name).toContain('Harness');
      expect(PROTOCOL_METADATA.claude.name).toContain('Claude');
    });

    it('should require developer mode only for sensitive protocols', () => {
      expect(PROTOCOL_METADATA.standard.requiresDeveloperMode).toBe(false);
      expect(PROTOCOL_METADATA.allowlist.requiresDeveloperMode).toBe(true);
      expect(PROTOCOL_METADATA.claude.requiresDeveloperMode).toBe(true);
    });

    it('should have all protocols enabled and live', () => {
      Object.values(PROTOCOL_METADATA).forEach(meta => {
        expect(meta.enabled).toBe(true);
        expect(meta.isLive).toBe(true);
      });
    });

    it('should have descriptive text for Claude protocol', () => {
      expect(PROTOCOL_METADATA.claude.description).toContain('advanced');
      expect(PROTOCOL_METADATA.claude.description).toContain('AI');
    });
  });
});
