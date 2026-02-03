/**
 * Protocol Versioning and Migration System
 * Manages protocol versions and handles migrations between versions
 */

import type { ProtocolType } from '@/contexts/ProtocolContext';

export interface ProtocolVersion {
  version: string;
  releaseDate: string;
  protocolId: ProtocolType;
  changes: string[];
  breakingChanges: boolean;
  deprecated: boolean;
  migrationPath?: string;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedSettings: any;
  warnings: string[];
  errors: string[];
}

// Protocol version registry
export const PROTOCOL_VERSIONS: Record<string, ProtocolVersion[]> = {
  standard: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-01',
      protocolId: 'standard',
      changes: ['Initial release', 'Basic media injection', 'Stealth mode support'],
      breakingChanges: false,
      deprecated: false,
    },
    {
      version: '1.1.0',
      releaseDate: '2026-01-15',
      protocolId: 'standard',
      changes: ['Added retry mechanism', 'Improved injection timing', 'Enhanced logging levels'],
      breakingChanges: false,
      deprecated: false,
    },
    {
      version: '1.2.0',
      releaseDate: '2026-01-31',
      protocolId: 'standard',
      changes: [
        'Added loopVideo setting',
        'Optimized injection delay',
        'Enhanced stealth detection',
        'Added respectSiteSettings option',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  allowlist: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-01',
      protocolId: 'allowlist',
      changes: ['Initial release', 'Domain-based filtering', 'Block by default mode'],
      breakingChanges: false,
      deprecated: false,
    },
    {
      version: '1.1.0',
      releaseDate: '2026-01-31',
      protocolId: 'allowlist',
      changes: [
        'Added wildcard domain support',
        'Subdomain matching',
        'Auto-add current site feature',
        'Improved domain validation',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  protected: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-01',
      protocolId: 'protected',
      changes: ['Initial release', 'Body detection', 'Safe video swap', 'Configurable sensitivity'],
      breakingChanges: false,
      deprecated: false,
    },
    {
      version: '1.1.0',
      releaseDate: '2026-01-31',
      protocolId: 'protected',
      changes: [
        'Enhanced ML model',
        'Faster detection',
        'Blur fallback option',
        'Auto-trigger on face detection',
        'Configurable replacement video',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  harness: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-01',
      protocolId: 'harness',
      changes: ['Initial release', 'Local sandbox testing', 'Overlay support', 'Debug overlay'],
      breakingChanges: false,
      deprecated: false,
    },
    {
      version: '1.1.0',
      releaseDate: '2026-01-31',
      protocolId: 'harness',
      changes: [
        'Added audio passthrough',
        'Mirror video option',
        'High frame rate support (60fps)',
        'Test pattern fallback',
        'Enhanced debug info',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  holographic: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-31',
      protocolId: 'holographic',
      changes: [
        'Initial release',
        'WebSocket bridge support',
        'SDP mutation',
        'Canvas-based stream synthesis',
        'Noise injection controls',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  websocket: [
    {
      version: '1.0.0',
      releaseDate: '2026-02-02',
      protocolId: 'websocket',
      changes: [
        'Initial release',
        'React Native postMessage bridge',
        'Frame streaming into WebView canvas',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  'webrtc-loopback': [
    {
      version: '1.0.0',
      releaseDate: '2026-02-02',
      protocolId: 'webrtc-loopback',
      changes: [
        'Initial release',
        'Native WebRTC loopback bridge integration',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  'claude-sonnet': [
    {
      version: '1.0.0',
      releaseDate: '2026-01-31',
      protocolId: 'claude-sonnet',
      changes: [
        'Initial release',
        'AI-powered adaptive quality',
        'Advanced stealth techniques',
        'Protocol chaining',
        'Neural enhancement',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  claude: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-31',
      protocolId: 'claude',
      changes: [
        'Initial release',
        'Neural optimization engine',
        'Quantum fingerprint evasion',
        'Behavioral mimicry profiles',
        'Adaptive performance optimization',
        'Context-aware injection',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
  sonnet: [
    {
      version: '1.0.0',
      releaseDate: '2026-01-31',
      protocolId: 'sonnet',
      changes: [
        'Initial release',
        'AI-powered adaptive injection',
        'Context awareness engine',
        'Behavior analysis system',
        'Self-healing mechanism',
        'Continuous learning',
        'Predictive preloading',
        'Anomaly detection',
        'Performance optimization',
        'Privacy preservation',
        'Cross-protocol sync',
        'Advanced metrics',
      ],
      breakingChanges: false,
      deprecated: false,
    },
  ],
};

export class ProtocolVersionManager {
  private static instance: ProtocolVersionManager;
  private currentVersions: Map<string, string> = new Map();

  private constructor() {
    // Initialize with latest versions
    Object.keys(PROTOCOL_VERSIONS).forEach(protocolId => {
      const versions = PROTOCOL_VERSIONS[protocolId];
      if (versions && versions.length > 0) {
        this.currentVersions.set(protocolId, versions[versions.length - 1].version);
      }
    });
  }

  static getInstance(): ProtocolVersionManager {
    if (!ProtocolVersionManager.instance) {
      ProtocolVersionManager.instance = new ProtocolVersionManager();
    }
    return ProtocolVersionManager.instance;
  }

  getCurrentVersion(protocolId: string): string {
    return this.currentVersions.get(protocolId) || '1.0.0';
  }

  getLatestVersion(protocolId: string): string {
    const versions = PROTOCOL_VERSIONS[protocolId];
    if (!versions || versions.length === 0) return '1.0.0';
    return versions[versions.length - 1].version;
  }

  getAllVersions(protocolId: string): ProtocolVersion[] {
    return PROTOCOL_VERSIONS[protocolId] || [];
  }

  getVersionInfo(protocolId: string, version: string): ProtocolVersion | null {
    const versions = PROTOCOL_VERSIONS[protocolId];
    if (!versions) return null;
    return versions.find(v => v.version === version) || null;
  }

  needsMigration(protocolId: string, currentVersion: string): boolean {
    const latestVersion = this.getLatestVersion(protocolId);
    return this.compareVersions(currentVersion, latestVersion) < 0;
  }

  migrateSettings(
    protocolId: string,
    settings: any,
    fromVersion: string,
    toVersion: string
  ): MigrationResult {
    const result: MigrationResult = {
      success: true,
      fromVersion,
      toVersion,
      migratedSettings: { ...settings },
      warnings: [],
      errors: [],
    };

    console.log(`[ProtocolVersioning] Migrating ${protocolId} from ${fromVersion} to ${toVersion}`);

    // Protocol-specific migrations
    switch (protocolId) {
      case 'standard':
        result.migratedSettings = this.migrateStandardSettings(settings, fromVersion, toVersion, result);
        break;
      case 'allowlist':
        result.migratedSettings = this.migrateAllowlistSettings(settings, fromVersion, toVersion, result);
        break;
      case 'protected':
        result.migratedSettings = this.migrateProtectedSettings(settings, fromVersion, toVersion, result);
        break;
      case 'harness':
        result.migratedSettings = this.migrateHarnessSettings(settings, fromVersion, toVersion, result);
        break;
      case 'holographic':
        result.warnings.push('Holographic protocol is new - using default settings');
        break;
      case 'websocket':
        result.warnings.push('WebSocket bridge protocol is new - using default settings');
        break;
      case 'webrtc-loopback':
        result.warnings.push('WebRTC loopback protocol is new - using default settings');
        break;
      case 'claude-sonnet':
        result.warnings.push('Claude Sonnet protocol is new - using default settings');
        break;
      case 'claude':
        result.warnings.push('Claude protocol is new - using default settings');
        break;
      case 'sonnet':
        // Sonnet is new - no migration needed yet
        result.warnings.push('Sonnet protocol is new - using default settings');
        break;
      default:
        result.errors.push(`Unknown protocol: ${protocolId}`);
        result.success = false;
    }

    if (result.success) {
      this.currentVersions.set(protocolId, toVersion);
      console.log(`[ProtocolVersioning] Migration successful for ${protocolId}`);
    } else {
      console.error(`[ProtocolVersioning] Migration failed for ${protocolId}:`, result.errors);
    }

    return result;
  }

  private migrateStandardSettings(settings: any, from: string, to: string, result: MigrationResult): any {
    const migrated = { ...settings };

    // 1.0.0 -> 1.1.0: Added retry settings
    if (this.compareVersions(from, '1.1.0') < 0 && this.compareVersions(to, '1.1.0') >= 0) {
      if (!migrated.hasOwnProperty('retryOnFail')) {
        migrated.retryOnFail = true;
        result.warnings.push('Added retryOnFail: true (new in 1.1.0)');
      }
      if (!migrated.hasOwnProperty('maxRetries')) {
        migrated.maxRetries = 3;
        result.warnings.push('Added maxRetries: 3 (new in 1.1.0)');
      }
    }

    // 1.1.0 -> 1.2.0: Added loop and respect site settings
    if (this.compareVersions(from, '1.2.0') < 0 && this.compareVersions(to, '1.2.0') >= 0) {
      if (!migrated.hasOwnProperty('loopVideo')) {
        migrated.loopVideo = true;
        result.warnings.push('Added loopVideo: true (new in 1.2.0)');
      }
      if (!migrated.hasOwnProperty('respectSiteSettings')) {
        migrated.respectSiteSettings = true;
        result.warnings.push('Added respectSiteSettings: true (new in 1.2.0)');
      }
    }

    return migrated;
  }

  private migrateAllowlistSettings(settings: any, from: string, to: string, result: MigrationResult): any {
    const migrated = { ...settings };

    // 1.0.0 -> 1.1.0: Enhanced domain validation
    if (this.compareVersions(from, '1.1.0') < 0 && this.compareVersions(to, '1.1.0') >= 0) {
      if (!migrated.hasOwnProperty('autoAddCurrentSite')) {
        migrated.autoAddCurrentSite = false;
        result.warnings.push('Added autoAddCurrentSite: false (new in 1.1.0)');
      }

      // Normalize existing domains
      if (migrated.domains && Array.isArray(migrated.domains)) {
        migrated.domains = migrated.domains.map((d: string) => d.toLowerCase().replace(/^www\./, ''));
        result.warnings.push('Normalized existing domains for improved matching');
      }
    }

    return migrated;
  }

  private migrateProtectedSettings(settings: any, from: string, to: string, result: MigrationResult): any {
    const migrated = { ...settings };

    // 1.0.0 -> 1.1.0: Enhanced detection features
    if (this.compareVersions(from, '1.1.0') < 0 && this.compareVersions(to, '1.1.0') >= 0) {
      if (!migrated.hasOwnProperty('blurFallback')) {
        migrated.blurFallback = true;
        result.warnings.push('Added blurFallback: true (new in 1.1.0)');
      }
      if (!migrated.hasOwnProperty('autoTriggerOnFace')) {
        migrated.autoTriggerOnFace = true;
        result.warnings.push('Added autoTriggerOnFace: true (new in 1.1.0)');
      }
      if (!migrated.hasOwnProperty('replacementVideoId')) {
        migrated.replacementVideoId = null;
        result.warnings.push('Added replacementVideoId: null (new in 1.1.0)');
      }
    }

    return migrated;
  }

  private migrateHarnessSettings(settings: any, from: string, to: string, result: MigrationResult): any {
    const migrated = { ...settings };

    // 1.0.0 -> 1.1.0: Enhanced harness features
    if (this.compareVersions(from, '1.1.0') < 0 && this.compareVersions(to, '1.1.0') >= 0) {
      if (!migrated.hasOwnProperty('enableAudioPassthrough')) {
        migrated.enableAudioPassthrough = false;
        result.warnings.push('Added enableAudioPassthrough: false (new in 1.1.0)');
      }
      if (!migrated.hasOwnProperty('mirrorVideo')) {
        migrated.mirrorVideo = false;
        result.warnings.push('Added mirrorVideo: false (new in 1.1.0)');
      }
      if (!migrated.hasOwnProperty('testPatternOnNoVideo')) {
        migrated.testPatternOnNoVideo = true;
        result.warnings.push('Added testPatternOnNoVideo: true (new in 1.1.0)');
      }
      if (migrated.hasOwnProperty('captureFrameRate') && migrated.captureFrameRate === undefined) {
        migrated.captureFrameRate = 30;
        result.warnings.push('Set default captureFrameRate: 30 (new in 1.1.0)');
      }
    }

    return migrated;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) {
        return p1 - p2;
      }
    }

    return 0;
  }

  getChangelog(protocolId: string, fromVersion?: string): string[] {
    const versions = PROTOCOL_VERSIONS[protocolId] || [];
    const startIndex = fromVersion
      ? versions.findIndex(v => v.version === fromVersion) + 1
      : 0;

    const relevantVersions = versions.slice(startIndex);
    const changelog: string[] = [];

    relevantVersions.forEach(version => {
      changelog.push(`\n## Version ${version.version} (${version.releaseDate})`);
      version.changes.forEach(change => {
        changelog.push(`  - ${change}`);
      });
      if (version.breakingChanges) {
        changelog.push('  ⚠️ Contains breaking changes');
      }
    });

    return changelog;
  }

  exportVersionInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    this.currentVersions.forEach((version, protocolId) => {
      const latestVersion = this.getLatestVersion(protocolId);
      const needsMigration = this.needsMigration(protocolId, version);

      info[protocolId] = {
        currentVersion: version,
        latestVersion,
        needsMigration,
        changelog: needsMigration ? this.getChangelog(protocolId, version) : [],
      };
    });

    return info;
  }
}

export default ProtocolVersionManager.getInstance();
