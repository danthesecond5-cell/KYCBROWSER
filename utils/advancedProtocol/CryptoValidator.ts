/**
 * Cryptographic Stream Validation System
 * 
 * Provides frame-level signing, stream integrity verification,
 * origin validation, and tamper detection for secure video injection.
 */

import {
  CryptoConfig,
  CryptoState,
  FrameSignature,
  DEFAULT_CRYPTO_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// TYPES
// ============================================================================

interface KeyPair {
  id: string;
  secret: Uint8Array;
  createdAt: number;
  expiresAt: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  confidence: number;
}

interface TamperEvent {
  id: string;
  timestamp: number;
  type: 'signature_mismatch' | 'sequence_violation' | 'timestamp_anomaly' | 'origin_invalid';
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// CRYPTO UTILITIES
// ============================================================================

class CryptoUtils {
  /**
   * Generate a random key
   */
  static generateKey(length: number = 32): Uint8Array {
    const key = new Uint8Array(length);
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(key);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        key[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return key;
  }

  /**
   * Generate a key ID
   */
  static generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert Uint8Array to hex string
   */
  static toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert hex string to Uint8Array
   */
  static fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Simple HMAC-SHA256 implementation
   * Note: In production, use Web Crypto API
   */
  static async hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
      return new Uint8Array(signature);
    }
    
    // Fallback: Simple hash (NOT cryptographically secure, for demo only)
    return CryptoUtils.simpleHash(key, message);
  }

  /**
   * Simple hash fallback (NOT secure, for demo purposes)
   */
  private static simpleHash(key: Uint8Array, message: Uint8Array): Uint8Array {
    const combined = new Uint8Array(key.length + message.length);
    combined.set(key);
    combined.set(message, key.length);
    
    // Simple FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined[i];
      hash = (hash * 16777619) >>> 0;
    }
    
    const result = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      result[i] = (hash >> (i * 4)) & 0xff;
    }
    
    // Repeat to fill 32 bytes
    for (let i = 8; i < 32; i++) {
      result[i] = result[i % 8] ^ combined[i % combined.length];
    }
    
    return result;
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  static constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }
}

// ============================================================================
// KEY MANAGER
// ============================================================================

class KeyManager {
  private config: CryptoConfig;
  private keys: Map<string, KeyPair> = new Map();
  private currentKeyId: string = '';
  private rotationInterval?: NodeJS.Timeout;

  constructor(config: CryptoConfig) {
    this.config = config;
  }

  /**
   * Initialize key manager
   */
  initialize(): void {
    // Generate initial key
    this.rotateKey();
    
    // Set up automatic rotation
    if (this.config.frameSigning.enabled) {
      this.startRotation();
    }
  }

  /**
   * Rotate to a new key
   */
  rotateKey(): string {
    const keyId = CryptoUtils.generateKeyId();
    const now = Date.now();
    
    const keyPair: KeyPair = {
      id: keyId,
      secret: CryptoUtils.generateKey(32),
      createdAt: now,
      expiresAt: now + this.config.frameSigning.keyRotationIntervalMs * 2,
    };
    
    this.keys.set(keyId, keyPair);
    this.currentKeyId = keyId;
    
    // Clean up expired keys
    this.cleanupExpiredKeys();
    
    console.log('[KeyManager] Key rotated:', keyId);
    return keyId;
  }

  private startRotation(): void {
    this.rotationInterval = setInterval(() => {
      this.rotateKey();
    }, this.config.frameSigning.keyRotationIntervalMs);
  }

  private cleanupExpiredKeys(): void {
    const now = Date.now();
    
    for (const [keyId, keyPair] of this.keys.entries()) {
      if (keyPair.expiresAt < now && keyId !== this.currentKeyId) {
        this.keys.delete(keyId);
        console.log('[KeyManager] Key expired:', keyId);
      }
    }
  }

  /**
   * Get current key
   */
  getCurrentKey(): KeyPair | null {
    return this.keys.get(this.currentKeyId) || null;
  }

  /**
   * Get key by ID
   */
  getKey(keyId: string): KeyPair | null {
    return this.keys.get(keyId) || null;
  }

  /**
   * Get current key ID
   */
  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  /**
   * Get rotation count
   */
  getRotationCount(): number {
    return this.keys.size;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
    this.keys.clear();
  }
}

// ============================================================================
// FRAME SIGNER
// ============================================================================

class FrameSigner {
  private keyManager: KeyManager;
  private config: CryptoConfig;
  private frameCounter: number = 0;

  constructor(config: CryptoConfig, keyManager: KeyManager) {
    this.config = config;
    this.keyManager = keyManager;
  }

  /**
   * Sign a frame
   */
  async signFrame(frameData: Uint8Array, sourceId: string): Promise<FrameSignature | null> {
    if (!this.config.frameSigning.enabled) {
      return null;
    }
    
    const key = this.keyManager.getCurrentKey();
    if (!key) {
      console.warn('[FrameSigner] No key available');
      return null;
    }
    
    const frameId = this.frameCounter++;
    const timestamp = Date.now();
    
    // Create message to sign: frameId + timestamp + sourceId + hash of frame data
    const frameHash = await this.hashFrameData(frameData);
    const message = new TextEncoder().encode(
      `${frameId}:${timestamp}:${sourceId}:${CryptoUtils.toHex(frameHash)}`
    );
    
    // Sign
    const signatureBytes = await CryptoUtils.hmacSha256(key.secret, message);
    
    return {
      frameId,
      timestamp,
      signature: CryptoUtils.toHex(signatureBytes),
      keyId: key.id,
      sourceId,
    };
  }

  /**
   * Hash frame data (for efficiency, only hash a sample)
   */
  private async hashFrameData(data: Uint8Array): Promise<Uint8Array> {
    // For performance, sample the data instead of hashing all of it
    const sampleSize = Math.min(1024, data.length);
    const sample = new Uint8Array(sampleSize);
    
    const step = Math.max(1, Math.floor(data.length / sampleSize));
    for (let i = 0; i < sampleSize; i++) {
      sample[i] = data[i * step] || 0;
    }
    
    // Use Web Crypto API if available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', sample);
      return new Uint8Array(hash);
    }
    
    // Fallback
    return CryptoUtils.generateKey(32); // Placeholder
  }

  /**
   * Get frame counter
   */
  getFrameCount(): number {
    return this.frameCounter;
  }
}

// ============================================================================
// SIGNATURE VALIDATOR
// ============================================================================

class SignatureValidator {
  private keyManager: KeyManager;
  private config: CryptoConfig;
  private lastValidatedFrame: number = -1;
  private lastValidatedTimestamp: number = 0;
  private validationCount: number = 0;
  private failureCount: number = 0;

  constructor(config: CryptoConfig, keyManager: KeyManager) {
    this.config = config;
    this.keyManager = keyManager;
  }

  /**
   * Validate a frame signature
   */
  async validateSignature(
    signature: FrameSignature,
    frameData: Uint8Array
  ): Promise<ValidationResult> {
    this.validationCount++;
    
    // Get the key used for signing
    const key = this.keyManager.getKey(signature.keyId);
    if (!key) {
      this.failureCount++;
      return {
        valid: false,
        reason: 'Unknown key ID',
        confidence: 1.0,
      };
    }
    
    // Check if key is expired
    if (key.expiresAt < Date.now()) {
      this.failureCount++;
      return {
        valid: false,
        reason: 'Key expired',
        confidence: 0.9,
      };
    }
    
    // Validate sequence
    if (this.config.streamIntegrity.sequenceValidation) {
      if (signature.frameId <= this.lastValidatedFrame) {
        // Allow some tolerance for reordering
        if (this.lastValidatedFrame - signature.frameId > 10) {
          this.failureCount++;
          return {
            valid: false,
            reason: 'Sequence violation - frame too old',
            confidence: 0.8,
          };
        }
      }
    }
    
    // Validate timestamp
    if (this.config.streamIntegrity.timestampValidation) {
      const now = Date.now();
      const skew = Math.abs(now - signature.timestamp);
      
      if (skew > this.config.streamIntegrity.maxClockSkewMs) {
        this.failureCount++;
        return {
          valid: false,
          reason: `Timestamp too far off (${skew}ms)`,
          confidence: 0.7,
        };
      }
    }
    
    // Verify signature
    const frameHash = await this.hashFrameData(frameData);
    const message = new TextEncoder().encode(
      `${signature.frameId}:${signature.timestamp}:${signature.sourceId}:${CryptoUtils.toHex(frameHash)}`
    );
    
    const expectedSignature = await CryptoUtils.hmacSha256(key.secret, message);
    const actualSignature = CryptoUtils.fromHex(signature.signature);
    
    if (!CryptoUtils.constantTimeEqual(expectedSignature, actualSignature)) {
      this.failureCount++;
      return {
        valid: false,
        reason: 'Signature mismatch',
        confidence: 1.0,
      };
    }
    
    // Update tracking
    this.lastValidatedFrame = Math.max(this.lastValidatedFrame, signature.frameId);
    this.lastValidatedTimestamp = signature.timestamp;
    
    return {
      valid: true,
      confidence: 1.0,
    };
  }

  private async hashFrameData(data: Uint8Array): Promise<Uint8Array> {
    const sampleSize = Math.min(1024, data.length);
    const sample = new Uint8Array(sampleSize);
    
    const step = Math.max(1, Math.floor(data.length / sampleSize));
    for (let i = 0; i < sampleSize; i++) {
      sample[i] = data[i * step] || 0;
    }
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await crypto.subtle.digest('SHA-256', sample);
      return new Uint8Array(hash);
    }
    
    return CryptoUtils.generateKey(32);
  }

  /**
   * Get statistics
   */
  getStats(): { validated: number; failed: number; successRate: number } {
    return {
      validated: this.validationCount,
      failed: this.failureCount,
      successRate: this.validationCount > 0 
        ? (this.validationCount - this.failureCount) / this.validationCount 
        : 1.0,
    };
  }
}

// ============================================================================
// ORIGIN VALIDATOR
// ============================================================================

class OriginValidator {
  private config: CryptoConfig;
  private trustedOrigins: Set<string>;

  constructor(config: CryptoConfig) {
    this.config = config;
    this.trustedOrigins = new Set(config.originValidation.trustedOrigins);
  }

  /**
   * Validate an origin
   */
  validateOrigin(origin: string): ValidationResult {
    if (!this.config.originValidation.enabled) {
      return { valid: true, confidence: 1.0 };
    }
    
    // Normalize origin
    const normalizedOrigin = origin.toLowerCase().replace(/^https?:\/\//, '');
    
    // Check against trusted origins
    for (const trusted of this.trustedOrigins) {
      if (normalizedOrigin === trusted || normalizedOrigin.endsWith(`.${trusted}`)) {
        return { valid: true, confidence: 1.0 };
      }
    }
    
    return {
      valid: false,
      reason: `Origin not trusted: ${origin}`,
      confidence: 0.9,
    };
  }

  /**
   * Add a trusted origin
   */
  addTrustedOrigin(origin: string): void {
    this.trustedOrigins.add(origin.toLowerCase());
  }

  /**
   * Remove a trusted origin
   */
  removeTrustedOrigin(origin: string): void {
    this.trustedOrigins.delete(origin.toLowerCase());
  }

  /**
   * Get trusted origins
   */
  getTrustedOrigins(): string[] {
    return Array.from(this.trustedOrigins);
  }
}

// ============================================================================
// TAMPER DETECTOR
// ============================================================================

class TamperDetector {
  private config: CryptoConfig;
  private events: TamperEvent[] = [];
  private maxEvents: number = 100;
  private onTamperCallback?: (event: TamperEvent) => void;

  constructor(config: CryptoConfig) {
    this.config = config;
  }

  /**
   * Report a tamper event
   */
  reportTamper(
    type: TamperEvent['type'],
    details: Record<string, unknown>,
    severity: TamperEvent['severity'] = 'medium'
  ): TamperEvent {
    const event: TamperEvent = {
      id: `tamper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      details,
      severity,
    };
    
    this.events.push(event);
    
    // Limit stored events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Alert if enabled
    if (this.config.tamperDetection.alertOnDetection && this.onTamperCallback) {
      this.onTamperCallback(event);
    }
    
    console.warn('[TamperDetector] Tamper detected:', type, details);
    
    return event;
  }

  /**
   * Check if stream should be blocked
   */
  shouldBlockStream(): boolean {
    if (!this.config.tamperDetection.blockOnDetection) {
      return false;
    }
    
    // Count recent high-severity events
    const recentWindow = 60000; // 1 minute
    const now = Date.now();
    const recentHighSeverity = this.events.filter(
      e => now - e.timestamp < recentWindow && 
           (e.severity === 'high' || e.severity === 'critical')
    );
    
    return recentHighSeverity.length >= 3;
  }

  /**
   * Get recent events
   */
  getRecentEvents(windowMs: number = 60000): TamperEvent[] {
    const now = Date.now();
    return this.events.filter(e => now - e.timestamp < windowMs);
  }

  /**
   * Get total tamper count
   */
  getTotalCount(): number {
    return this.events.length;
  }

  /**
   * Register tamper callback
   */
  onTamper(callback: (event: TamperEvent) => void): void {
    this.onTamperCallback = callback;
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }
}

// ============================================================================
// CRYPTO VALIDATOR (MAIN CLASS)
// ============================================================================

export class CryptoValidator {
  private config: CryptoConfig;
  private state: CryptoState;
  private keyManager: KeyManager;
  private frameSigner: FrameSigner;
  private signatureValidator: SignatureValidator;
  private originValidator: OriginValidator;
  private tamperDetector: TamperDetector;

  constructor(config: Partial<CryptoConfig> = {}) {
    this.config = { ...DEFAULT_CRYPTO_CONFIG, ...config };
    this.state = {
      isInitialized: false,
      currentKeyId: '',
      keyRotationCount: 0,
      framesValidated: 0,
      framesFailed: 0,
      lastValidationTime: 0,
      tampersDetected: 0,
    };
    
    this.keyManager = new KeyManager(this.config);
    this.frameSigner = new FrameSigner(this.config, this.keyManager);
    this.signatureValidator = new SignatureValidator(this.config, this.keyManager);
    this.originValidator = new OriginValidator(this.config);
    this.tamperDetector = new TamperDetector(this.config);
  }

  /**
   * Initialize the crypto validator
   */
  async initialize(): Promise<void> {
    console.log('[CryptoValidator] Initializing...');
    
    this.keyManager.initialize();
    this.state.currentKeyId = this.keyManager.getCurrentKeyId();
    this.state.isInitialized = true;
    
    console.log('[CryptoValidator] Initialized with key:', this.state.currentKeyId);
  }

  /**
   * Sign a frame
   */
  async signFrame(frameData: Uint8Array, sourceId: string): Promise<FrameSignature | null> {
    if (!this.state.isInitialized) {
      console.warn('[CryptoValidator] Not initialized');
      return null;
    }
    
    return this.frameSigner.signFrame(frameData, sourceId);
  }

  /**
   * Validate a frame signature
   */
  async validateFrame(
    signature: FrameSignature,
    frameData: Uint8Array
  ): Promise<ValidationResult> {
    if (!this.state.isInitialized) {
      return { valid: false, reason: 'Not initialized', confidence: 1.0 };
    }
    
    const result = await this.signatureValidator.validateSignature(signature, frameData);
    
    this.state.framesValidated++;
    this.state.lastValidationTime = Date.now();
    
    if (!result.valid) {
      this.state.framesFailed++;
      
      // Report tamper
      this.tamperDetector.reportTamper(
        'signature_mismatch',
        { 
          frameId: signature.frameId,
          reason: result.reason,
        },
        'high'
      );
      
      this.state.tampersDetected = this.tamperDetector.getTotalCount();
    }
    
    return result;
  }

  /**
   * Validate an origin
   */
  validateOrigin(origin: string): ValidationResult {
    const result = this.originValidator.validateOrigin(origin);
    
    if (!result.valid) {
      this.tamperDetector.reportTamper(
        'origin_invalid',
        { origin, reason: result.reason },
        'medium'
      );
      
      this.state.tampersDetected = this.tamperDetector.getTotalCount();
    }
    
    return result;
  }

  /**
   * Add a trusted origin
   */
  addTrustedOrigin(origin: string): void {
    this.originValidator.addTrustedOrigin(origin);
  }

  /**
   * Check if stream should be blocked due to tampering
   */
  shouldBlockStream(): boolean {
    return this.tamperDetector.shouldBlockStream();
  }

  /**
   * Get current state
   */
  getState(): CryptoState {
    this.state.keyRotationCount = this.keyManager.getRotationCount();
    this.state.currentKeyId = this.keyManager.getCurrentKeyId();
    
    return { ...this.state };
  }

  /**
   * Get tamper events
   */
  getTamperEvents(windowMs?: number): TamperEvent[] {
    return this.tamperDetector.getRecentEvents(windowMs);
  }

  /**
   * Register tamper callback
   */
  onTamper(callback: (event: TamperEvent) => void): void {
    this.tamperDetector.onTamper(callback);
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    validated: number;
    failed: number;
    successRate: number;
    tampersDetected: number;
  } {
    const stats = this.signatureValidator.getStats();
    return {
      ...stats,
      tampersDetected: this.tamperDetector.getTotalCount(),
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.keyManager.destroy();
    this.tamperDetector.clearEvents();
    this.state.isInitialized = false;
    
    console.log('[CryptoValidator] Destroyed');
  }
}
