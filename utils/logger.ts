type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'freeze';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  recordingId?: string;
}

export interface DebugRecording {
  id: string;
  referenceCode: string;
  startTime: string;
  endTime?: string;
  startLogIndex: number;
  endLogIndex?: number;
  url?: string;
  description?: string;
  logs: LogEntry[];
  metadata: {
    deviceInfo?: string;
    templateName?: string;
    stealthMode?: boolean;
    activeDevices?: number;
    simulatingDevices?: number;
  };
}

const LOG_COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  freeze: '\x1b[35m',
  reset: '\x1b[0m',
} as const;

const LOG_PREFIXES = {
  debug: '🔍',
  info: '✅',
  warn: '⚠️',
  error: '❌',
  freeze: '🥶',
} as const;

const ORIGINAL_CONSOLE_KEY = '__loggerOriginalConsole';

export type FreezeCallback = (freezeInfo: FreezeInfo) => void;

export interface FreezeInfo {
  duration: number;
  detectedAt: string;
  lastHeartbeat: string;
  recentLogs: LogEntry[];
}

class Logger {
  private module: string;
  private static instances: Map<string, Logger> = new Map();
  private static logHistory: LogEntry[] = [];
  private static maxHistory = 2000;
  private static enabled = true;
  private static activeRecordingId: string | null = null;
  private static recordings: Map<string, DebugRecording> = new Map();
  private static recordingCounter = 0;
  
  // Freeze detection
  private static freezeDetectionEnabled = false;
  private static lastHeartbeat = Date.now();
  private static heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private static freezeCheckInterval: ReturnType<typeof setInterval> | null = null;
  private static freezeThreshold = 3000; // 3 seconds
  private static freezeCallbacks: FreezeCallback[] = [];
  private static lastFreezeAlert = 0;
  private static freezeAlertCooldown = 5000; // 5 seconds between alerts

  private constructor(module: string) {
    this.module = module;
  }

  static create(module: string): Logger {
    if (!Logger.instances.has(module)) {
      Logger.instances.set(module, new Logger(module));
    }
    return Logger.instances.get(module)!;
  }

  static setEnabled(enabled: boolean): void {
    Logger.enabled = enabled;
  }

  static getHistory(): LogEntry[] {
    return [...Logger.logHistory];
  }

  static clearHistory(): void {
    Logger.logHistory = [];
  }

  static exportLogs(): string {
    return JSON.stringify(Logger.logHistory, null, 2);
  }

  static exportLogsReadable(): string {
    const separator = '═'.repeat(60);
    const thinSeparator = '─'.repeat(60);
    
    let output = `${separator}\n`;
    output += `📋 DEBUG LOG EXPORT\n`;
    output += `📅 Exported: ${new Date().toISOString()}\n`;
    output += `📊 Total Entries: ${Logger.logHistory.length}\n`;
    output += `❌ Errors: ${Logger.logHistory.filter(l => l.level === 'error').length}\n`;
    output += `⚠️ Warnings: ${Logger.logHistory.filter(l => l.level === 'warn').length}\n`;
    output += `${separator}\n\n`;

    Logger.logHistory.forEach((entry, index) => {
      const prefix = LOG_PREFIXES[entry.level];
      const time = entry.timestamp.split('T')[1].split('.')[0];
      output += `[${index + 1}] ${prefix} ${time} [${entry.module}]\n`;
      output += `    ${entry.message}\n`;
      if (entry.data !== undefined) {
        try {
          const dataStr = typeof entry.data === 'string' 
            ? entry.data 
            : JSON.stringify(entry.data, null, 2);
          output += `    Data: ${dataStr}\n`;
        } catch {
          output += `    Data: [Unable to stringify]\n`;
        }
      }
      output += `${thinSeparator}\n`;
    });

    output += `\n${separator}\n`;
    output += `END OF LOG EXPORT\n`;
    output += `${separator}\n`;

    return output;
  }

  static getErrorsOnly(): LogEntry[] {
    return Logger.logHistory.filter(l => l.level === 'error' || l.level === 'warn');
  }

  static getRecentLogs(count: number = 100): LogEntry[] {
    return Logger.logHistory.slice(-count);
  }

  static generateReferenceCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    Logger.recordingCounter++;
    const counter = Logger.recordingCounter.toString(36).toUpperCase().padStart(3, '0');
    return `DBG-${timestamp}-${random}-${counter}`;
  }

  static startRecording(metadata?: DebugRecording['metadata'], url?: string, description?: string): string {
    const id = `rec_${Date.now()}`;
    const referenceCode = Logger.generateReferenceCode();
    const startLogIndex = Logger.logHistory.length;
    
    const recording: DebugRecording = {
      id,
      referenceCode,
      startTime: new Date().toISOString(),
      startLogIndex,
      url,
      description,
      logs: [],
      metadata: metadata || {},
    };
    
    Logger.recordings.set(id, recording);
    Logger.activeRecordingId = id;
    
    console.log(`\n🔴 DEBUG RECORDING STARTED`);
    console.log(`📋 Reference: ${referenceCode}`);
    console.log(`⏰ Time: ${recording.startTime}`);
    console.log(`🌐 URL: ${url || 'N/A'}`);
    console.log(`─────────────────────────────────\n`);
    
    return id;
  }

  static stopRecording(id?: string): DebugRecording | null {
    const recordingId = id || Logger.activeRecordingId;
    if (!recordingId) {
      console.warn('[Logger] No active recording to stop');
      return null;
    }
    
    const recording = Logger.recordings.get(recordingId);
    if (!recording) {
      console.warn('[Logger] Recording not found:', recordingId);
      return null;
    }
    
    recording.endTime = new Date().toISOString();
    recording.endLogIndex = Logger.logHistory.length;
    recording.logs = Logger.logHistory.slice(recording.startLogIndex, recording.endLogIndex);
    
    if (Logger.activeRecordingId === recordingId) {
      Logger.activeRecordingId = null;
    }
    
    const duration = new Date(recording.endTime).getTime() - new Date(recording.startTime).getTime();
    const durationStr = duration < 60000 
      ? `${Math.round(duration / 1000)}s` 
      : `${Math.round(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`;
    
    console.log(`\n─────────────────────────────────`);
    console.log(`⏹️ DEBUG RECORDING STOPPED`);
    console.log(`📋 Reference: ${recording.referenceCode}`);
    console.log(`⏱️ Duration: ${durationStr}`);
    console.log(`📊 Events Captured: ${recording.logs.length}`);
    console.log(`🌐 URL: ${recording.url || 'N/A'}`);
    console.log(`─────────────────────────────────\n`);
    
    return recording;
  }

  static getRecording(id: string): DebugRecording | null {
    return Logger.recordings.get(id) || null;
  }

  static getRecordingByReference(referenceCode: string): DebugRecording | null {
    for (const recording of Logger.recordings.values()) {
      if (recording.referenceCode === referenceCode) {
        return recording;
      }
    }
    return null;
  }

  static getAllRecordings(): DebugRecording[] {
    return Array.from(Logger.recordings.values());
  }

  static isRecording(): boolean {
    return Logger.activeRecordingId !== null;
  }

  static getActiveRecordingId(): string | null {
    return Logger.activeRecordingId;
  }

  static exportRecording(id: string): string | null {
    const recording = Logger.recordings.get(id);
    if (!recording) return null;
    
    return JSON.stringify({
      ...recording,
      exportedAt: new Date().toISOString(),
      logCount: recording.logs.length,
      errorCount: recording.logs.filter(l => l.level === 'error').length,
      warnCount: recording.logs.filter(l => l.level === 'warn').length,
    }, null, 2);
  }

  static clearRecordings(): void {
    Logger.recordings.clear();
    Logger.activeRecordingId = null;
  }

  // ========== FREEZE DETECTION ==========
  
  static startFreezeDetection(threshold: number = 3000): void {
    if (Logger.freezeDetectionEnabled) {
      console.log('[Logger] Freeze detection already running');
      return;
    }
    
    Logger.freezeThreshold = threshold;
    Logger.freezeDetectionEnabled = true;
    Logger.lastHeartbeat = Date.now();
    
    // Heartbeat - runs on main thread, updates timestamp
    Logger.heartbeatInterval = setInterval(() => {
      Logger.lastHeartbeat = Date.now();
    }, 500);
    
    // Freeze checker - if heartbeat hasn't updated, main thread is blocked
    Logger.freezeCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceHeartbeat = now - Logger.lastHeartbeat;
      
      if (timeSinceHeartbeat > Logger.freezeThreshold) {
        const timeSinceLastAlert = now - Logger.lastFreezeAlert;
        
        if (timeSinceLastAlert > Logger.freezeAlertCooldown) {
          Logger.lastFreezeAlert = now;
          
          const freezeInfo: FreezeInfo = {
            duration: timeSinceHeartbeat,
            detectedAt: new Date().toISOString(),
            lastHeartbeat: new Date(Logger.lastHeartbeat).toISOString(),
            recentLogs: Logger.logHistory.slice(-50),
          };
          
          // Log the freeze
          const freezeLogger = Logger.create('FreezeDetector');
          freezeLogger.logFreeze(
            `🥶 APP FREEZE DETECTED! Main thread blocked for ${timeSinceHeartbeat}ms`,
            freezeInfo
          );
          
          // Notify callbacks
          Logger.freezeCallbacks.forEach(cb => {
            try {
              cb(freezeInfo);
            } catch (e) {
              console.error('[Logger] Freeze callback error:', e);
            }
          });
        }
      }
    }, 1000);
    
    console.log(`[Logger] 🔍 Freeze detection started (threshold: ${threshold}ms)`);
  }
  
  static stopFreezeDetection(): void {
    if (Logger.heartbeatInterval) {
      clearInterval(Logger.heartbeatInterval);
      Logger.heartbeatInterval = null;
    }
    if (Logger.freezeCheckInterval) {
      clearInterval(Logger.freezeCheckInterval);
      Logger.freezeCheckInterval = null;
    }
    Logger.freezeDetectionEnabled = false;
    console.log('[Logger] Freeze detection stopped');
  }
  
  static onFreeze(callback: FreezeCallback): () => void {
    Logger.freezeCallbacks.push(callback);
    return () => {
      Logger.freezeCallbacks = Logger.freezeCallbacks.filter(cb => cb !== callback);
    };
  }
  
  static isFreezeDetectionEnabled(): boolean {
    return Logger.freezeDetectionEnabled;
  }
  
  static getLastHeartbeat(): number {
    return Logger.lastHeartbeat;
  }
  
  static getFreezeStatus(): { enabled: boolean; lastHeartbeat: number; threshold: number } {
    return {
      enabled: Logger.freezeDetectionEnabled,
      lastHeartbeat: Logger.lastHeartbeat,
      threshold: Logger.freezeThreshold,
    };
  }

  // Manual heartbeat for tracking specific operations
  static heartbeat(context?: string): void {
    Logger.lastHeartbeat = Date.now();
    if (context) {
      console.debug(`[Heartbeat] ${context}`);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      data,
      recordingId: Logger.activeRecordingId || undefined,
    };

    Logger.logHistory.push(entry);
    if (Logger.logHistory.length > Logger.maxHistory) {
      Logger.logHistory.shift();
    }

    const prefix = LOG_PREFIXES[level];
    const color = LOG_COLORS[level];
    const reset = LOG_COLORS.reset;
    const formattedMessage = `${prefix} [${this.module}] ${message}`;
    const consoleTarget = (globalThis as Record<string, typeof console>)[ORIGINAL_CONSOLE_KEY] || console;

    switch (level) {
      case 'debug':
        consoleTarget.debug(`${color}${formattedMessage}${reset}`, data !== undefined ? data : '');
        break;
      case 'info':
        consoleTarget.log(`${color}${formattedMessage}${reset}`, data !== undefined ? data : '');
        break;
      case 'warn':
        consoleTarget.warn(`${color}${formattedMessage}${reset}`, data !== undefined ? data : '');
        break;
      case 'error':
        consoleTarget.error(`${color}${formattedMessage}${reset}`, data !== undefined ? data : '');
        break;
      case 'freeze':
        consoleTarget.error(`${color}${formattedMessage}${reset}`, data !== undefined ? data : '');
        break;
    }
  }

  logFreeze(message: string, data?: unknown): void {
    this.log('freeze', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed in ${duration.toFixed(2)}ms`);
    };
  }

  group(label: string, fn: () => void): void {
    console.group(`[${this.module}] ${label}`);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }
}

export const createLogger = (module: string): Logger => Logger.create(module);
export { Logger };
export type { LogEntry, LogLevel };

export const startDebugRecording = Logger.startRecording.bind(Logger);
export const stopDebugRecording = Logger.stopRecording.bind(Logger);
export const getDebugRecording = Logger.getRecording.bind(Logger);
export const getRecordingByReference = Logger.getRecordingByReference.bind(Logger);
export const getAllDebugRecordings = Logger.getAllRecordings.bind(Logger);
export const isDebugRecording = Logger.isRecording.bind(Logger);
export const exportDebugRecording = Logger.exportRecording.bind(Logger);
export const exportLogsReadable = Logger.exportLogsReadable.bind(Logger);
export const getErrorsOnly = Logger.getErrorsOnly.bind(Logger);
export const getRecentLogs = Logger.getRecentLogs.bind(Logger);

export const clearLogHistory = Logger.clearHistory.bind(Logger);
export const clearAllDebugRecordings = Logger.clearRecordings.bind(Logger);
export const clearAllDebugLogs = (): void => {
  Logger.clearHistory();
  Logger.clearRecordings();
};

let consoleCaptureInstalled = false;
export const installConsoleCapture = (): void => {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;

  const consoleLogger = Logger.create('Console');
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  if (!(globalThis as Record<string, typeof original>)[ORIGINAL_CONSOLE_KEY]) {
    (globalThis as Record<string, typeof original>)[ORIGINAL_CONSOLE_KEY] = original;
  }

  const safeMessageFromArgs = (args: unknown[]): string => {
    const first = args[0];
    if (typeof first === 'string') return first;
    try {
      return JSON.stringify(first);
    } catch {
      return String(first);
    }
  };

  const inCaptureRef = { current: false };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    if (inCaptureRef.current) return;
    inCaptureRef.current = true;
    try {
      consoleLogger.info(safeMessageFromArgs(args), args.length > 1 ? args.slice(1) : undefined);
    } finally {
      inCaptureRef.current = false;
    }
  };

  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    if (inCaptureRef.current) return;
    inCaptureRef.current = true;
    try {
      consoleLogger.warn(safeMessageFromArgs(args), args.length > 1 ? args.slice(1) : undefined);
    } finally {
      inCaptureRef.current = false;
    }
  };

  console.error = (...args: unknown[]) => {
    original.error(...args);
    if (inCaptureRef.current) return;
    inCaptureRef.current = true;
    try {
      consoleLogger.error(safeMessageFromArgs(args), args.length > 1 ? args.slice(1) : undefined);
    } finally {
      inCaptureRef.current = false;
    }
  };

  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    if (inCaptureRef.current) return;
    inCaptureRef.current = true;
    try {
      consoleLogger.debug(safeMessageFromArgs(args), args.length > 1 ? args.slice(1) : undefined);
    } finally {
      inCaptureRef.current = false;
    }
  };

  original.log('[Logger] Console capture installed');
};

// Freeze detection exports
export const startFreezeDetection = Logger.startFreezeDetection.bind(Logger);
export const stopFreezeDetection = Logger.stopFreezeDetection.bind(Logger);
export const onFreezeDetected = Logger.onFreeze.bind(Logger);
export const isFreezeDetectionEnabled = Logger.isFreezeDetectionEnabled.bind(Logger);
export const getFreezeStatus = Logger.getFreezeStatus.bind(Logger);
export const heartbeat = Logger.heartbeat.bind(Logger);
