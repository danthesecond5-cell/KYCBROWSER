/**
 * Protocol Validator Tests
 * 
 * Comprehensive tests for protocol validation and health checking.
 */

import {
  validateStandardSettings,
  validateAllowlistSettings,
  validateProtectedSettings,
  validateHarnessSettings,
  validateClaudeSettings,
  validateProtocolSettings,
  getProtocolCapabilities,
  performProtocolHealthCheck,
  getRecommendedSettings,
} from '@/utils/protocolValidator';
import { DEFAULT_PROTOCOL_SETTINGS } from '@/types/protocols';

describe('Protocol Validator', () => {
  describe('validateStandardSettings', () => {
    it('should pass with valid settings', () => {
      const result = validateStandardSettings({
        enabled: true,
        autoInject: true,
        injectionDelay: 100,
        maxRetries: 3,
        loggingLevel: 'minimal',
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with negative injection delay', () => {
      const result = validateStandardSettings({
        injectionDelay: -100,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_DELAY');
    });

    it('should warn on high injection delay', () => {
      const result = validateStandardSettings({
        injectionDelay: 6000,
      });
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HIGH_DELAY');
    });

    it('should fail with invalid max retries', () => {
      const result = validateStandardSettings({
        maxRetries: 15,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_RETRIES');
    });

    it('should fail with invalid logging level', () => {
      const result = validateStandardSettings({
        loggingLevel: 'invalid' as any,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_LOGGING_LEVEL');
    });

    it('should suggest optimization for stealth with verbose logging', () => {
      const result = validateStandardSettings({
        stealthByDefault: true,
        loggingLevel: 'verbose',
      });
      
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('validateAllowlistSettings', () => {
    it('should pass with valid domains', () => {
      const result = validateAllowlistSettings({
        enabled: true,
        domains: ['example.com', 'test.org'],
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with empty domain', () => {
      const result = validateAllowlistSettings({
        domains: ['example.com', '', 'test.org'],
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_DOMAIN');
    });

    it('should warn on duplicate domains', () => {
      const result = validateAllowlistSettings({
        domains: ['example.com', 'EXAMPLE.COM', 'test.org'],
      });
      
      expect(result.warnings.some(w => w.code === 'DUPLICATE_DOMAINS')).toBe(true);
    });

    it('should suggest adding domains when enabled but empty', () => {
      const result = validateAllowlistSettings({
        enabled: true,
        domains: [],
      });
      
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('validateProtectedSettings', () => {
    it('should pass with valid settings', () => {
      const result = validateProtectedSettings({
        enabled: true,
        bodyDetectionSensitivity: 'medium',
        swapDelayMs: 150,
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with invalid sensitivity', () => {
      const result = validateProtectedSettings({
        bodyDetectionSensitivity: 'ultra' as any,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SENSITIVITY');
    });

    it('should fail with negative swap delay', () => {
      const result = validateProtectedSettings({
        swapDelayMs: -50,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SWAP_DELAY');
    });

    it('should warn on high swap delay', () => {
      const result = validateProtectedSettings({
        swapDelayMs: 1500,
      });
      
      expect(result.valid).toBe(true);
      expect(result.warnings[0].code).toBe('HIGH_SWAP_DELAY');
    });
  });

  describe('validateHarnessSettings', () => {
    it('should pass with valid settings', () => {
      const result = validateHarnessSettings({
        enabled: true,
        showDebugOverlay: false,
      });
      
      expect(result.valid).toBe(true);
    });

    it('should warn when bandwidth simulation is enabled', () => {
      const result = validateHarnessSettings({
        simulateLowBandwidth: true,
      });
      
      expect(result.warnings[0].code).toBe('BANDWIDTH_SIMULATION');
    });
  });

  describe('validateClaudeSettings', () => {
    it('should pass with valid settings', () => {
      const result = validateClaudeSettings({
        enabled: true,
        priorityLevel: 100,
        injectionMode: 'balanced',
        qualityPreset: 'maximum',
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with invalid priority level', () => {
      const result = validateClaudeSettings({
        priorityLevel: 150,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_PRIORITY');
    });

    it('should fail with invalid injection mode', () => {
      const result = validateClaudeSettings({
        injectionMode: 'turbo' as any,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_INJECTION_MODE');
    });

    it('should fail with invalid quality preset', () => {
      const result = validateClaudeSettings({
        qualityPreset: 'ultra' as any,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_QUALITY_PRESET');
    });

    it('should warn on high resource usage configuration', () => {
      const result = validateClaudeSettings({
        injectionMode: 'aggressive',
        qualityPreset: 'maximum',
      });
      
      expect(result.warnings.some(w => w.code === 'HIGH_RESOURCE_USAGE')).toBe(true);
    });

    it('should warn on missing dependency for AI optimization', () => {
      const result = validateClaudeSettings({
        aiQualityOptimization: true,
        advancedMetrics: false,
      });
      
      expect(result.warnings.some(w => w.code === 'MISSING_DEPENDENCY')).toBe(true);
    });

    it('should warn on missing health monitoring for auto recovery', () => {
      const result = validateClaudeSettings({
        autoRecovery: true,
        healthMonitoring: false,
      });
      
      expect(result.warnings.some(w => w.code === 'MISSING_DEPENDENCY')).toBe(true);
    });
  });

  describe('validateProtocolSettings', () => {
    it('should validate all protocols at once', () => {
      const results = validateProtocolSettings(DEFAULT_PROTOCOL_SETTINGS);
      
      expect(results.standard.valid).toBe(true);
      expect(results.allowlist.valid).toBe(true);
      expect(results.protected.valid).toBe(true);
      expect(results.harness.valid).toBe(true);
      expect(results.claude.valid).toBe(true);
    });
  });

  describe('getProtocolCapabilities', () => {
    it('should return capabilities for standard protocol', () => {
      const caps = getProtocolCapabilities('standard');
      
      expect(caps.supportsVideo).toBe(true);
      expect(caps.supportsAudio).toBe(true);
      expect(caps.stealthLevel).toBe('advanced');
    });

    it('should return capabilities for claude protocol', () => {
      const caps = getProtocolCapabilities('claude');
      
      expect(caps.supportsVideo).toBe(true);
      expect(caps.supportsAudio).toBe(true);
      expect(caps.supportsMotion).toBe(true);
      expect(caps.stealthLevel).toBe('maximum');
      expect(caps.performanceImpact).toBe('high');
    });

    it('should return capabilities for protected protocol', () => {
      const caps = getProtocolCapabilities('protected');
      
      expect(caps.requiresCamera).toBe(true);
      expect(caps.supportsAudio).toBe(false);
    });
  });

  describe('performProtocolHealthCheck', () => {
    it('should return healthy status for valid settings', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS);
      
      expect(result.healthy).toBe(true);
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('should include FPS check when metrics provided', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        fps: 30,
      });
      
      const fpsCheck = result.checks.find(c => c.name === 'Frame Rate');
      expect(fpsCheck).toBeDefined();
      expect(fpsCheck?.status).toBe('pass');
    });

    it('should fail FPS check when too low', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        fps: 10,
      });
      
      const fpsCheck = result.checks.find(c => c.name === 'Frame Rate');
      expect(fpsCheck?.status).toBe('fail');
    });

    it('should include latency check when metrics provided', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        latency: 100,
      });
      
      const latencyCheck = result.checks.find(c => c.name === 'Latency');
      expect(latencyCheck).toBeDefined();
      expect(latencyCheck?.status).toBe('pass');
    });

    it('should fail latency check when too high', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        latency: 600,
      });
      
      const latencyCheck = result.checks.find(c => c.name === 'Latency');
      expect(latencyCheck?.status).toBe('fail');
    });

    it('should include error count check', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        errorCount: 0,
      });
      
      const errorCheck = result.checks.find(c => c.name === 'Error Rate');
      expect(errorCheck?.status).toBe('pass');
    });

    it('should reduce score with high error count', () => {
      const result = performProtocolHealthCheck('claude', DEFAULT_PROTOCOL_SETTINGS, {
        errorCount: 15,
      });
      
      expect(result.overallScore).toBeLessThan(80);
    });
  });

  describe('getRecommendedSettings', () => {
    it('should return performance settings for poor network', () => {
      const recommended = getRecommendedSettings('claude', {
        networkQuality: 'poor',
      });
      
      expect(recommended.claude?.qualityPreset).toBe('performance');
    });

    it('should return stealth mode for high privacy concern', () => {
      const recommended = getRecommendedSettings('claude', {
        privacyConcern: 'high',
      });
      
      expect(recommended.claude?.injectionMode).toBe('stealth');
    });

    it('should enable memory optimization for low performance devices', () => {
      const recommended = getRecommendedSettings('claude', {
        devicePerformance: 'low',
      });
      
      expect(recommended.claude?.memoryOptimization).toBe(true);
    });

    it('should return maximum quality for high performance devices', () => {
      const recommended = getRecommendedSettings('claude', {
        devicePerformance: 'high',
        networkQuality: 'good',
      });
      
      expect(recommended.claude?.qualityPreset).toBe('maximum');
    });
  });
});
