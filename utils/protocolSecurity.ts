/**
 * Protocol Security and Error Recovery System
 * Provides comprehensive security features and error handling for all injection protocols
 */

export interface SecurityPolicy {
  httpsOnly: boolean;
  corsStrict: boolean;
  cspCompliant: boolean;
  sanitizeInputs: boolean;
  rateLimiting: boolean;
  maxInjectionRate: number;
  allowedDomains: string[];
  blockedDomains: string[];
  trustedSources: string[];
}

export interface RecoveryStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  fallbackEnabled: boolean;
  gracefulDegradation: boolean;
  circuitBreakerThreshold: number;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  httpsOnly: true,
  corsStrict: true,
  cspCompliant: true,
  sanitizeInputs: true,
  rateLimiting: true,
  maxInjectionRate: 10, // per minute
  allowedDomains: [],
  blockedDomains: ['malicious-site.com', 'blocked-domain.net'],
  trustedSources: ['localhost', '127.0.0.1', '*.expo.dev'],
};

export const DEFAULT_RECOVERY_STRATEGY: RecoveryStrategy = {
  maxRetries: 5,
  backoffMultiplier: 2,
  initialDelay: 500,
  maxDelay: 10000,
  fallbackEnabled: true,
  gracefulDegradation: true,
  circuitBreakerThreshold: 0.5, // Open circuit if 50% failure rate
};

export class ProtocolSecurity {
  private static instance: ProtocolSecurity;
  private policy: SecurityPolicy;
  private injectionHistory: Array<{ timestamp: number; url: string; success: boolean }> = [];
  private circuitBreaker: { open: boolean; failures: number; successes: number } = {
    open: false,
    failures: 0,
    successes: 0,
  };

  private constructor(policy: SecurityPolicy = DEFAULT_SECURITY_POLICY) {
    this.policy = policy;
  }

  static getInstance(policy?: SecurityPolicy): ProtocolSecurity {
    if (!ProtocolSecurity.instance) {
      ProtocolSecurity.instance = new ProtocolSecurity(policy);
    }
    return ProtocolSecurity.instance;
  }

  validateUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Check HTTPS requirement
      if (this.policy.httpsOnly && parsed.protocol !== 'https:') {
        return { valid: false, reason: 'HTTPS required by security policy' };
      }

      // Check blocked domains
      if (this.policy.blockedDomains.some(blocked => parsed.hostname.includes(blocked))) {
        return { valid: false, reason: 'Domain is blocked by security policy' };
      }

      // Check allowed domains (if list is not empty)
      if (this.policy.allowedDomains.length > 0) {
        const isAllowed = this.policy.allowedDomains.some(allowed => {
          if (allowed.startsWith('*.')) {
            return parsed.hostname.endsWith(allowed.substring(2));
          }
          return parsed.hostname === allowed;
        });

        if (!isAllowed) {
          return { valid: false, reason: 'Domain not in allowed list' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  checkRateLimit(): { allowed: boolean; reason?: string } {
    if (!this.policy.rateLimiting) {
      return { allowed: true };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.injectionHistory = this.injectionHistory.filter(entry => entry.timestamp > oneMinuteAgo);

    // Check rate
    if (this.injectionHistory.length >= this.policy.maxInjectionRate) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: max ${this.policy.maxInjectionRate} injections per minute`,
      };
    }

    return { allowed: true };
  }

  checkCircuitBreaker(): { open: boolean; reason?: string } {
    if (this.circuitBreaker.open) {
      return {
        open: true,
        reason: 'Circuit breaker is open due to high failure rate - automatic recovery in progress',
      };
    }

    const total = this.circuitBreaker.failures + this.circuitBreaker.successes;
    if (total >= 10) {
      const failureRate = this.circuitBreaker.failures / total;
      if (failureRate >= DEFAULT_RECOVERY_STRATEGY.circuitBreakerThreshold) {
        this.circuitBreaker.open = true;
        console.warn('[ProtocolSecurity] Circuit breaker opened - failure rate:', failureRate);

        // Auto-close after 30 seconds
        setTimeout(() => {
          this.circuitBreaker.open = false;
          this.circuitBreaker.failures = 0;
          this.circuitBreaker.successes = 0;
          console.log('[ProtocolSecurity] Circuit breaker closed - system recovered');
        }, 30000);

        return {
          open: true,
          reason: `Circuit breaker opened - failure rate ${(failureRate * 100).toFixed(1)}%`,
        };
      }
    }

    return { open: false };
  }

  recordInjection(url: string, success: boolean): void {
    this.injectionHistory.push({
      timestamp: Date.now(),
      url,
      success,
    });

    // Update circuit breaker
    if (success) {
      this.circuitBreaker.successes++;
    } else {
      this.circuitBreaker.failures++;
    }

    // Keep history manageable
    if (this.injectionHistory.length > 100) {
      this.injectionHistory.shift();
    }
  }

  sanitizeInput(input: string): string {
    if (!this.policy.sanitizeInputs) {
      return input;
    }

    // Remove potentially dangerous characters
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  validateVideoSource(uri: string): { valid: boolean; reason?: string } {
    // Allow data URIs (base64 videos)
    if (uri.startsWith('data:video/')) {
      return { valid: true };
    }

    // Allow blob URIs
    if (uri.startsWith('blob:')) {
      return { valid: true };
    }

    // Validate URL-based sources
    return this.validateUrl(uri);
  }

  getSecurityReport(): {
    policy: SecurityPolicy;
    injections: { total: number; successful: number; failed: number };
    circuitBreaker: { open: boolean; failures: number; successes: number };
    recentHistory: Array<{ timestamp: string; url: string; success: boolean }>;
  } {
    const total = this.injectionHistory.length;
    const successful = this.injectionHistory.filter(e => e.success).length;
    const failed = total - successful;

    return {
      policy: this.policy,
      injections: { total, successful, failed },
      circuitBreaker: this.circuitBreaker,
      recentHistory: this.injectionHistory.slice(-10).map(e => ({
        timestamp: new Date(e.timestamp).toISOString(),
        url: e.url.substring(0, 50) + (e.url.length > 50 ? '...' : ''),
        success: e.success,
      })),
    };
  }

  updatePolicy(newPolicy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    console.log('[ProtocolSecurity] Policy updated:', this.policy);
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      open: false,
      failures: 0,
      successes: 0,
    };
    console.log('[ProtocolSecurity] Circuit breaker manually reset');
  }
}

export class ErrorRecovery {
  private strategy: RecoveryStrategy;
  private retryQueue: Array<{
    id: string;
    fn: () => Promise<any>;
    retries: number;
    lastAttempt: number;
  }> = [];

  constructor(strategy: RecoveryStrategy = DEFAULT_RECOVERY_STRATEGY) {
    this.strategy = strategy;
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'operation'
  ): Promise<{ success: boolean; result?: T; error?: Error }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.strategy.maxRetries; attempt++) {
      try {
        const result = await fn();
        console.log(`[ErrorRecovery] ${context} succeeded on attempt ${attempt + 1}`);
        return { success: true, result };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[ErrorRecovery] ${context} failed on attempt ${attempt + 1}:`,
          error instanceof Error ? error.message : error
        );

        if (attempt < this.strategy.maxRetries) {
          const delay = Math.min(
            this.strategy.initialDelay * Math.pow(this.strategy.backoffMultiplier, attempt),
            this.strategy.maxDelay
          );

          console.log(`[ErrorRecovery] Retrying ${context} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[ErrorRecovery] ${context} failed after ${this.strategy.maxRetries + 1} attempts`);
    return { success: false, error: lastError || new Error('Unknown error') };
  }

  enqueueRetry(id: string, fn: () => Promise<any>): void {
    this.retryQueue.push({
      id,
      fn,
      retries: 0,
      lastAttempt: Date.now(),
    });

    console.log(`[ErrorRecovery] Operation '${id}' queued for retry`);
  }

  async processRetryQueue(): Promise<void> {
    const now = Date.now();

    for (let i = this.retryQueue.length - 1; i >= 0; i--) {
      const item = this.retryQueue[i];

      if (item.retries >= this.strategy.maxRetries) {
        console.error(`[ErrorRecovery] Operation '${item.id}' exhausted retries, removing from queue`);
        this.retryQueue.splice(i, 1);
        continue;
      }

      const delay = this.strategy.initialDelay * Math.pow(this.strategy.backoffMultiplier, item.retries);
      if (now - item.lastAttempt >= delay) {
        console.log(`[ErrorRecovery] Processing retry for '${item.id}' (attempt ${item.retries + 1})`);

        try {
          await item.fn();
          console.log(`[ErrorRecovery] Operation '${item.id}' succeeded, removing from queue`);
          this.retryQueue.splice(i, 1);
        } catch (error) {
          console.warn(
            `[ErrorRecovery] Operation '${item.id}' failed (attempt ${item.retries + 1}):`,
            error instanceof Error ? error.message : error
          );
          item.retries++;
          item.lastAttempt = now;
        }
      }
    }
  }

  getQueueStatus(): Array<{ id: string; retries: number; nextAttempt: string }> {
    const now = Date.now();
    return this.retryQueue.map(item => {
      const delay = this.strategy.initialDelay * Math.pow(this.strategy.backoffMultiplier, item.retries);
      const nextAttempt = new Date(item.lastAttempt + delay).toISOString();
      return {
        id: item.id,
        retries: item.retries,
        nextAttempt,
      };
    });
  }
}

export default {
  Security: ProtocolSecurity.getInstance(),
  Recovery: new ErrorRecovery(),
};
