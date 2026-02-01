import { Alert, Platform } from 'react-native';

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK = 'NETWORK',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  STORAGE = 'STORAGE',
  SENSOR_UNAVAILABLE = 'SENSOR_UNAVAILABLE',
  CAMERA_ERROR = 'CAMERA_ERROR',
  MICROPHONE_ERROR = 'MICROPHONE_ERROR',
  VIDEO_LOAD_ERROR = 'VIDEO_LOAD_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  WEBVIEW_ERROR = 'WEBVIEW_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  originalError?: Error | unknown;
  recoverable: boolean;
  timestamp: string;
}

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const NETWORK_ERROR_CODES = new Set([
  'econnrefused',
  'econnreset',
  'econnaborted',
  'enotfound',
  'enetunreach',
  'ehostunreach',
  'eai_again',
  'err_network',
  'err_internet_disconnected',
  'etimedout',
]);
const NETWORK_ERROR_NAMES = new Set(['aborterror', 'networkerror']);
const PERMISSION_ERROR_CODES = new Set(['eacces', 'eperm']);
const PERMISSION_ERROR_NAMES = new Set([
  'notallowederror',
  'permissiondeniederror',
  'securityerror',
  'notauthorizederror',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const normalizeMessage = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  return null;
};

const safeSerialize = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const getErrorName = (error: unknown): string => {
  if (error instanceof Error) {
    return normalizeMessage(error.name) || '';
  }
  if (isRecord(error) && typeof error.name === 'string') {
    return error.name;
  }
  return '';
};

const getErrorCode = (error: unknown): string => {
  if (isRecord(error) && (typeof error.code === 'string' || typeof error.code === 'number')) {
    return String(error.code);
  }
  return '';
};

export function isAppError(error: unknown): error is AppError {
  return (
    isRecord(error) &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.recoverable === 'boolean' &&
    typeof error.timestamp === 'string'
  );
}

export function createAppError(
  code: ErrorCode,
  message: string,
  originalError?: Error | unknown,
  recoverable = true
): AppError {
  const normalizedMessage =
    normalizeMessage(message) ||
    (originalError ? getErrorMessage(originalError) : null) ||
    DEFAULT_ERROR_MESSAGE;
  const timestamp = new Date().toISOString();
  const error: AppError = {
    code,
    message: normalizedMessage,
    originalError,
    recoverable,
    timestamp,
  };
  
  console.error(`[AppError] ${code}: ${normalizedMessage}`, {
    originalError,
    timestamp,
  });
  
  return error;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = normalizeMessage(error.message);
    if (message) return message;
    const name = normalizeMessage(error.name);
    if (name) return name;
  }

  const primitiveMessage = normalizeMessage(error);
  if (primitiveMessage) {
    return primitiveMessage;
  }

  if (isRecord(error)) {
    const message =
      normalizeMessage(error.message) ||
      normalizeMessage(error.error) ||
      normalizeMessage(error.reason);
    if (message) return message;

    if (error.message !== undefined) {
      const serializedMessage = safeSerialize(error.message);
      if (serializedMessage) return serializedMessage;
    }

    if (error.error instanceof Error) {
      const nestedMessage = normalizeMessage(error.error.message) || normalizeMessage(error.error.name);
      if (nestedMessage) return nestedMessage;
    }

    if (error.reason instanceof Error) {
      const nestedMessage = normalizeMessage(error.reason.message) || normalizeMessage(error.reason.name);
      if (nestedMessage) return nestedMessage;
    }

    const serialized = safeSerialize(error);
    if (serialized) return serialized;
  }

  return DEFAULT_ERROR_MESSAGE;
}

export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  const messageHints = [
    'network',
    'fetch',
    'connection',
    'timeout',
    'offline',
    'socket hang up',
    'failed to fetch',
    'load failed',
  ];

  if (NETWORK_ERROR_CODES.has(code)) return true;
  if (NETWORK_ERROR_NAMES.has(name)) return true;
  if (name === 'typeerror' && (message.includes('fetch') || message.includes('network'))) return true;

  return messageHints.some((hint) => message.includes(hint));
}

export function isPermissionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  const messageHints = [
    'permission',
    'denied',
    'not allowed',
    'not authorized',
    'unauthorized',
    'forbidden',
    'blocked',
    'disallowed',
    'access',
  ];

  if (PERMISSION_ERROR_CODES.has(code)) return true;
  if (PERMISSION_ERROR_NAMES.has(name)) return true;

  return messageHints.some((hint) => message.includes(hint));
}

export function handleAsyncError<T>(
  promise: Promise<T>,
  errorCode: ErrorCode = ErrorCode.UNKNOWN
): Promise<[T | null, AppError | null]> {
  return promise
    .then((data) => [data, null] as [T, null])
    .catch((error) => {
      const appError = isAppError(error)
        ? error
        : createAppError(
            errorCode,
            getErrorMessage(error),
            error
          );
      return [null, appError] as [null, AppError];
    });
}

export function showErrorAlert(
  title: string,
  message: string,
  onRetry?: () => void,
  onCancel?: () => void
): void {
  const safeTitle = title.trim() || 'Error';
  const safeMessage = message.trim() || DEFAULT_ERROR_MESSAGE;
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[] = [];
  
  if (onCancel) {
    buttons.push({
      text: 'Cancel',
      style: 'cancel',
      onPress: onCancel,
    });
  }
  
  if (onRetry) {
    buttons.push({
      text: 'Retry',
      onPress: onRetry,
    });
  }
  
  if (buttons.length === 0) {
    buttons.push({ text: 'OK' });
  }
  
  Alert.alert(safeTitle, safeMessage, buttons);
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }
  
  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL is too long' };
  }
  
  try {
    new URL(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function validateVideoUrl(url: string): { valid: boolean; error?: string } {
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }
  
  const normalizedUrl = url.trim();
  const supportedExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.avi'];
  const hasValidExtension = supportedExtensions.some(ext => 
    normalizedUrl.toLowerCase().includes(ext)
  );
  
  if (!hasValidExtension && !normalizedUrl.includes('blob:') && !normalizedUrl.includes('data:')) {
    console.warn('[Validation] Video URL may not have a recognized video extension:', normalizedUrl);
  }
  
  return { valid: true };
}

export function validateTemplateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Template name is required' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Template name cannot be empty' };
  }
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Template name must be at least 2 characters' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Template name must be less than 100 characters' };
  }
  
  return { valid: true };
}

export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (typeof json !== 'string') {
    return fallback;
  }
  const trimmed = json.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    console.error('[SafeJsonParse] Failed to parse JSON:', error);
    return fallback;
  }
}

export function safeJsonStringify(data: unknown): string | null {
  try {
    const result = JSON.stringify(data);
    if (typeof result !== 'string') {
      return null;
    }
    return result;
  } catch (error) {
    console.error('[SafeJsonStringify] Failed to stringify data:', error);
    return null;
  }
}

export function withErrorLogging<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context: string
): T {
  return (function (this: unknown, ...args: Parameters<T>) {
    try {
      const result = fn.apply(this, args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((error: unknown) => {
          console.error(`[${context}] Async error:`, error);
          throw error;
        });
      }
      return result;
    } catch (error) {
      console.error(`[${context}] Sync error:`, error);
      throw error;
    }
  }) as T;
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const normalizedMaxRetries = Number.isFinite(maxRetries) ? Math.max(0, Math.floor(maxRetries)) : 0;
    const baseDelay = Number.isFinite(initialDelay) ? Math.max(0, initialDelay) : 0;
    let retries = 0;
    
    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        retries++;
        console.log(`[RetryWithBackoff] Attempt ${retries}/${normalizedMaxRetries} failed:`, error);
        
        if (retries >= normalizedMaxRetries) {
          reject(error);
          return;
        }
        
        const delay = baseDelay * Math.pow(2, retries - 1);
        console.log(`[RetryWithBackoff] Retrying in ${delay}ms...`);
        setTimeout(attempt, delay);
      }
    };
    
    attempt();
  });
}

export function debounceError(
  fn: (error: AppError) => void,
  delay = 1000
): (error: AppError) => void {
  let lastError: string | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const delayMs = Number.isFinite(delay) ? Math.max(0, delay) : 0;
  
  return (error: AppError) => {
    const errorKey = `${error.code}:${error.message}`;
    
    if (errorKey === lastError) {
      return;
    }
    
    lastError = errorKey;
    fn(error);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      lastError = null;
    }, delayMs);
  };
}

export function getPlatformSpecificError(error: unknown): string {
  const baseMessage = getErrorMessage(error);
  
  if (Platform.OS === 'web') {
    const normalizedMessage = baseMessage.toLowerCase();
    if (normalizedMessage.includes('getusermedia')) {
      return 'Camera/microphone access is not available in this browser. Please use a mobile device.';
    }
    if (normalizedMessage.includes('devicemotion') || normalizedMessage.includes('device motion')) {
      return 'Motion sensors are not available in this browser. Please use a mobile device.';
    }
  }
  
  return baseMessage;
}

// ============ ADVANCED RECOVERY MECHANISMS ============

/**
 * Recovery strategy types
 */
export type RecoveryStrategy = 
  | 'retry'           // Simple retry
  | 'backoff'         // Exponential backoff
  | 'fallback'        // Use alternative
  | 'reset'           // Reset state and retry
  | 'skip'            // Skip and continue
  | 'abort';          // Give up

/**
 * Recovery action configuration
 */
export interface RecoveryAction {
  strategy: RecoveryStrategy;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  fallbackValue?: unknown;
  onRecoveryAttempt?: (attempt: number, error: AppError) => void;
  onRecoverySuccess?: (attempt: number) => void;
  onRecoveryFailed?: (error: AppError) => void;
}

/**
 * Default recovery actions for different error codes
 */
export const DEFAULT_RECOVERY_ACTIONS: Partial<Record<ErrorCode, RecoveryAction>> = {
  [ErrorCode.NETWORK]: {
    strategy: 'backoff',
    maxAttempts: 4,
    initialDelayMs: 1000,
    maxDelayMs: 16000,
  },
  [ErrorCode.VIDEO_LOAD_ERROR]: {
    strategy: 'fallback',
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
  },
  [ErrorCode.CAMERA_ERROR]: {
    strategy: 'reset',
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
  },
  [ErrorCode.WEBVIEW_ERROR]: {
    strategy: 'retry',
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 3000,
  },
  [ErrorCode.STORAGE]: {
    strategy: 'skip',
    maxAttempts: 1,
    initialDelayMs: 0,
    maxDelayMs: 0,
  },
  [ErrorCode.PERMISSION_DENIED]: {
    strategy: 'abort',
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
  },
};

/**
 * Get recommended recovery action for an error
 */
export function getRecoveryAction(error: AppError): RecoveryAction {
  const defaultAction: RecoveryAction = {
    strategy: 'retry',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };
  
  return DEFAULT_RECOVERY_ACTIONS[error.code] || defaultAction;
}

/**
 * Execute a function with automatic recovery
 */
export async function executeWithRecovery<T>(
  fn: () => Promise<T>,
  action: RecoveryAction,
  errorCode: ErrorCode = ErrorCode.UNKNOWN
): Promise<{ success: boolean; result?: T; error?: AppError; attempts: number }> {
  let lastError: AppError | null = null;
  
  for (let attempt = 1; attempt <= action.maxAttempts; attempt++) {
    try {
      const result = await fn();
      action.onRecoverySuccess?.(attempt);
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = isAppError(error) 
        ? error 
        : createAppError(errorCode, getErrorMessage(error), error);
      
      action.onRecoveryAttempt?.(attempt, lastError);
      
      if (attempt >= action.maxAttempts) {
        break;
      }
      
      // Calculate delay based on strategy
      let delay = action.initialDelayMs;
      
      switch (action.strategy) {
        case 'backoff':
          delay = Math.min(
            action.initialDelayMs * Math.pow(2, attempt - 1),
            action.maxDelayMs
          );
          break;
        case 'abort':
          break;
        case 'skip':
          break;
        default:
          // Linear delay
          delay = action.initialDelayMs;
      }
      
      if (action.strategy !== 'abort' && action.strategy !== 'skip') {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  if (lastError) {
    action.onRecoveryFailed?.(lastError);
  }
  
  return { 
    success: false, 
    error: lastError || createAppError(errorCode, 'Recovery failed'),
    attempts: action.maxAttempts 
  };
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  successCount: number;
}

/**
 * Circuit breaker for preventing repeated failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    successCount: 0,
  };
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30000,
    private readonly successThreshold: number = 3
  ) {}
  
  /**
   * Check if circuit is open (should not attempt)
   */
  isCircuitOpen(): boolean {
    if (!this.state.isOpen) return false;
    
    // Check if reset timeout has passed
    const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
    if (timeSinceLastFailure >= this.resetTimeoutMs) {
      // Move to half-open state (allow one attempt)
      return false;
    }
    
    return true;
  }
  
  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.state.isOpen) {
      this.state.successCount++;
      if (this.state.successCount >= this.successThreshold) {
        this.reset();
      }
    } else {
      this.state.failures = 0;
    }
  }
  
  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    this.state.successCount = 0;
    
    if (this.state.failures >= this.failureThreshold) {
      this.state.isOpen = true;
      console.warn('[CircuitBreaker] Circuit opened after', this.state.failures, 'failures');
    }
  }
  
  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
      successCount: 0,
    };
    console.log('[CircuitBreaker] Circuit reset');
  }
  
  /**
   * Get current state
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isCircuitOpen()) {
      throw createAppError(
        ErrorCode.UNKNOWN,
        'Circuit breaker is open - too many recent failures',
        undefined,
        true
      );
    }
    
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

/**
 * Error aggregator for collecting and analyzing errors
 */
export class ErrorAggregator {
  private errors: Array<{ error: AppError; timestamp: number }> = [];
  private readonly maxErrors: number;
  private readonly windowMs: number;
  
  constructor(maxErrors: number = 100, windowMs: number = 60000) {
    this.maxErrors = maxErrors;
    this.windowMs = windowMs;
  }
  
  /**
   * Add an error
   */
  add(error: AppError): void {
    this.errors.push({ error, timestamp: Date.now() });
    
    // Trim old errors
    this.cleanup();
  }
  
  /**
   * Clean up old errors outside the window
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.errors = this.errors
      .filter(e => e.timestamp > cutoff)
      .slice(-this.maxErrors);
  }
  
  /**
   * Get error count by code
   */
  getCountByCode(code: ErrorCode): number {
    this.cleanup();
    return this.errors.filter(e => e.error.code === code).length;
  }
  
  /**
   * Get total error count
   */
  getTotalCount(): number {
    this.cleanup();
    return this.errors.length;
  }
  
  /**
   * Get most common error code
   */
  getMostCommonCode(): ErrorCode | null {
    this.cleanup();
    if (this.errors.length === 0) return null;
    
    const counts = new Map<ErrorCode, number>();
    for (const { error } of this.errors) {
      counts.set(error.code, (counts.get(error.code) || 0) + 1);
    }
    
    let maxCode: ErrorCode | null = null;
    let maxCount = 0;
    
    counts.forEach((count, code) => {
      if (count > maxCount) {
        maxCount = count;
        maxCode = code;
      }
    });
    
    return maxCode;
  }
  
  /**
   * Get error rate (errors per second)
   */
  getErrorRate(): number {
    this.cleanup();
    if (this.errors.length < 2) return 0;
    
    const oldest = this.errors[0].timestamp;
    const newest = this.errors[this.errors.length - 1].timestamp;
    const durationSeconds = (newest - oldest) / 1000;
    
    if (durationSeconds === 0) return 0;
    
    return this.errors.length / durationSeconds;
  }
  
  /**
   * Get summary report
   */
  getSummary(): {
    total: number;
    byCode: Record<string, number>;
    errorRate: number;
    mostCommon: ErrorCode | null;
  } {
    this.cleanup();
    
    const byCode: Record<string, number> = {};
    for (const { error } of this.errors) {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
    }
    
    return {
      total: this.errors.length,
      byCode,
      errorRate: this.getErrorRate(),
      mostCommon: this.getMostCommonCode(),
    };
  }
  
  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }
}

/**
 * Global error aggregator instance
 */
export const globalErrorAggregator = new ErrorAggregator();

// ============ CLAUDE PROTOCOL VALIDATION ============

import type { ClaudeProtocolSettings } from '@/types/protocols';

/**
 * Protocol-specific error with additional context
 */
export interface ProtocolError extends AppError {
  protocolId: string;
  context?: Record<string, unknown>;
}

/**
 * Create a protocol-specific error
 */
export function createProtocolError(
  protocolId: string,
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
  originalError?: Error | unknown
): ProtocolError {
  const baseError = createAppError(code, message, originalError);
  return {
    ...baseError,
    protocolId,
    context,
  };
}

/**
 * Get recovery suggestions for protocol errors
 */
export function getProtocolErrorRecovery(error: ProtocolError): {
  suggestion: string;
  actions: string[];
} {
  const suggestions: Record<ErrorCode, { suggestion: string; actions: string[] }> = {
    [ErrorCode.NETWORK]: {
      suggestion: 'Network connection issue detected',
      actions: ['Check internet connection', 'Retry the operation', 'Switch to offline mode'],
    },
    [ErrorCode.PERMISSION_DENIED]: {
      suggestion: 'Permission was denied',
      actions: ['Grant camera/microphone permissions', 'Check app settings', 'Restart the app'],
    },
    [ErrorCode.VIDEO_LOAD_ERROR]: {
      suggestion: 'Video could not be loaded',
      actions: ['Try a different video', 'Check video format compatibility', 'Reduce video quality'],
    },
    [ErrorCode.CAMERA_ERROR]: {
      suggestion: 'Camera access issue',
      actions: ['Check camera permissions', 'Close other apps using camera', 'Restart device'],
    },
    [ErrorCode.WEBVIEW_ERROR]: {
      suggestion: 'WebView encountered an error',
      actions: ['Refresh the page', 'Clear browser cache', 'Try a different URL'],
    },
    [ErrorCode.INVALID_INPUT]: {
      suggestion: 'Invalid input provided',
      actions: ['Check input values', 'Review configuration settings'],
    },
    [ErrorCode.UNKNOWN]: {
      suggestion: 'An unexpected error occurred',
      actions: ['Restart the operation', 'Check logs for details', 'Contact support if issue persists'],
    },
    [ErrorCode.STORAGE]: {
      suggestion: 'Storage operation failed',
      actions: ['Free up device storage', 'Clear app cache', 'Check storage permissions'],
    },
    [ErrorCode.SENSOR_UNAVAILABLE]: {
      suggestion: 'Required sensors are not available',
      actions: ['Check device capabilities', 'Enable sensor permissions', 'Use a different device'],
    },
    [ErrorCode.MICROPHONE_ERROR]: {
      suggestion: 'Microphone access issue',
      actions: ['Grant microphone permission', 'Close other apps using microphone', 'Restart device'],
    },
    [ErrorCode.TEMPLATE_NOT_FOUND]: {
      suggestion: 'Template not found',
      actions: ['Create a new template', 'Select a different template', 'Reset to default'],
    },
    [ErrorCode.DEVICE_NOT_FOUND]: {
      suggestion: 'Device not found',
      actions: ['Refresh device list', 'Check device connection', 'Reconnect device'],
    },
  };

  return suggestions[error.code] || suggestions[ErrorCode.UNKNOWN];
}

/**
 * Validate Claude protocol settings
 */
export function validateClaudeSettings(settings: ClaudeProtocolSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof settings !== 'object' || settings === null) {
    return { valid: false, errors: ['Settings must be an object'] };
  }

  // Validate enabled flag
  if (typeof settings.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  // Validate anti-detection level
  const validAntiDetectionLevels = ['standard', 'enhanced', 'maximum', 'paranoid'];
  if (!validAntiDetectionLevels.includes(settings.antiDetectionLevel)) {
    errors.push(`antiDetectionLevel must be one of: ${validAntiDetectionLevels.join(', ')}`);
  }

  // Validate noise reduction level
  const validNoiseReductionLevels = ['off', 'light', 'moderate', 'aggressive'];
  if (!validNoiseReductionLevels.includes(settings.noiseReductionLevel)) {
    errors.push(`noiseReductionLevel must be one of: ${validNoiseReductionLevels.join(', ')}`);
  }

  // Validate error recovery mode
  const validErrorRecoveryModes = ['graceful', 'aggressive', 'silent'];
  if (!validErrorRecoveryModes.includes(settings.errorRecoveryMode)) {
    errors.push(`errorRecoveryMode must be one of: ${validErrorRecoveryModes.join(', ')}`);
  }

  // Validate priority level
  const validPriorityLevels = ['background', 'normal', 'high', 'realtime'];
  if (!validPriorityLevels.includes(settings.priorityLevel)) {
    errors.push(`priorityLevel must be one of: ${validPriorityLevels.join(', ')}`);
  }

  // Validate injection mode
  const validInjectionModes = ['aggressive', 'balanced', 'conservative'];
  if (!validInjectionModes.includes(settings.injectionMode)) {
    errors.push(`injectionMode must be one of: ${validInjectionModes.join(', ')}`);
  }

  // Validate quality preset
  const validQualityPresets = ['minimum', 'low', 'medium', 'high', 'maximum'];
  if (!validQualityPresets.includes(settings.qualityPreset)) {
    errors.push(`qualityPreset must be one of: ${validQualityPresets.join(', ')}`);
  }

  // Validate boolean flags
  const booleanFlags = [
    'neuralOptimizationEnabled',
    'quantumFingerprintEvasion',
    'behavioralMimicryEnabled',
    'adaptiveInjection',
    'contextAwareness',
    'predictivePreloading',
    'deepStealthMode',
    'behavioralMimicry',
    'timingRandomization',
    'aiQualityOptimization',
    'dynamicResolutionScaling',
    'frameRateStabilization',
    'fingerprintMorphing',
    'canvasNoiseAdaptation',
    'webrtcLeakPrevention',
    'memoryOptimization',
    'gpuAcceleration',
    'workerThreads',
    'autoRecovery',
    'redundantStreams',
    'healthMonitoring',
    'advancedMetrics',
    'performanceLogging',
    'anomalyDetection',
  ];

  for (const flag of booleanFlags) {
    if (typeof (settings as Record<string, unknown>)[flag] !== 'boolean') {
      errors.push(`${flag} must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a video URI for injection
 */
export function validateInjectionVideoUri(uri: string): {
  valid: boolean;
  error?: string;
  warnings?: string[];
} {
  const warnings: string[] = [];

  if (!uri || typeof uri !== 'string') {
    return { valid: false, error: 'Video URI is required' };
  }

  const trimmedUri = uri.trim();
  if (trimmedUri.length === 0) {
    return { valid: false, error: 'Video URI cannot be empty' };
  }

  // Check for supported protocols
  const supportedProtocols = ['http://', 'https://', 'file://', 'blob:', 'data:', 'content://'];
  const hasValidProtocol = supportedProtocols.some(protocol => 
    trimmedUri.toLowerCase().startsWith(protocol)
  );

  if (!hasValidProtocol) {
    return { valid: false, error: 'Video URI must use a supported protocol (http, https, file, blob, data, content)' };
  }

  // Check for valid video extensions
  const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'];
  const hasVideoExtension = videoExtensions.some(ext => 
    trimmedUri.toLowerCase().includes(ext)
  );

  // Data URLs and blobs don't need extensions
  if (!hasVideoExtension && !trimmedUri.startsWith('data:') && !trimmedUri.startsWith('blob:')) {
    warnings.push('URI does not have a recognized video extension');
  }

  // Check for potential issues
  if (trimmedUri.length > 10000) {
    warnings.push('Video URI is very long, which may cause performance issues');
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Enhanced retry with circuit breaker and error aggregation
 */
export async function retryWithProtection<T>(
  fn: () => Promise<T>,
  options: {
    errorCode?: ErrorCode;
    circuitBreaker?: CircuitBreaker;
    aggregator?: ErrorAggregator;
    recoveryAction?: RecoveryAction;
  } = {}
): Promise<T> {
  const {
    errorCode = ErrorCode.UNKNOWN,
    circuitBreaker,
    aggregator = globalErrorAggregator,
    recoveryAction = getRecoveryAction(createAppError(errorCode, '')),
  } = options;
  
  // Check circuit breaker first
  if (circuitBreaker?.isCircuitOpen()) {
    const error = createAppError(
      errorCode,
      'Operation blocked by circuit breaker',
      undefined,
      true
    );
    aggregator.add(error);
    throw error;
  }
  
  const result = await executeWithRecovery(fn, recoveryAction, errorCode);
  
  if (result.success && result.result !== undefined) {
    circuitBreaker?.recordSuccess();
    return result.result;
  }
  
  const error = result.error || createAppError(errorCode, 'Operation failed');
  circuitBreaker?.recordFailure();
  aggregator.add(error);
  throw error;
}
