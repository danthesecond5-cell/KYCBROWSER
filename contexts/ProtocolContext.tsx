import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

// Protocol Types
export type ProtocolType = 'standard' | 'allowlist' | 'protected' | 'harness' | 'sonnet';

export interface ProtocolConfig {
  id: ProtocolType;
  name: string;
  description: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface StandardProtocolSettings {
  autoInject: boolean;
  stealthByDefault: boolean;
  respectSiteSettings: boolean;
  injectMotionData: boolean;
  loopVideo: boolean;
}

export interface AllowlistProtocolSettings {
  enabled: boolean;
  domains: string[];
  blockUnlisted: boolean;
  showBlockedIndicator: boolean;
  autoAddCurrentSite: boolean;
}

export interface ProtectedProtocolSettings {
  bodyDetectionEnabled: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  replacementVideoId: string | null;
  showProtectedBadge: boolean;
  autoTriggerOnFace: boolean;
  blurFallback: boolean;
}

export interface HarnessProtocolSettings {
  overlayEnabled: boolean;
  showDebugInfo: boolean;
  captureFrameRate: number;
  enableAudioPassthrough: boolean;
  mirrorVideo: boolean;
  testPatternOnNoVideo: boolean;
}

export interface SonnetProtocolSettings {
  aiModelVersion: string;
  adaptiveInjection: boolean;
  adaptiveThreshold: number;
  contextAwareness: boolean;
  behaviorAnalysis: boolean;
  anomalyDetection: boolean;
  performanceOptimization: boolean;
  predictivePreloading: boolean;
  intelligentFallback: boolean;
  mlInferenceEnabled: boolean;
  mlModelPath: string | null;
  selfHealing: boolean;
  continuousLearning: boolean;
  privacyPreservation: boolean;
  crossProtocolSync: boolean;
  advancedMetrics: boolean;
}

export interface ProtocolContextValue {
  // Developer Mode
  developerModeEnabled: boolean;
  toggleDeveloperMode: () => Promise<void>;
  setDeveloperModeWithPin: (pin: string) => Promise<boolean>;
  developerPin: string | null;
  setDeveloperPin: (pin: string) => Promise<void>;
  
  // Presentation Mode
  presentationMode: boolean;
  togglePresentationMode: () => void;
  showTestingWatermark: boolean;
  setShowTestingWatermark: (show: boolean) => void;
  
  // Active Protocol
  activeProtocol: ProtocolType;
  setActiveProtocol: (protocol: ProtocolType) => Promise<void>;
  
  // Protocol Configs
  protocols: Record<ProtocolType, ProtocolConfig>;
  updateProtocolConfig: <T extends ProtocolType>(
    protocol: T, 
    settings: Partial<ProtocolConfig>
  ) => Promise<void>;
  
  // Protocol-specific settings
  standardSettings: StandardProtocolSettings;
  allowlistSettings: AllowlistProtocolSettings;
  protectedSettings: ProtectedProtocolSettings;
  harnessSettings: HarnessProtocolSettings;
  sonnetSettings: SonnetProtocolSettings;
  
  // Settings Updaters
  updateStandardSettings: (settings: Partial<StandardProtocolSettings>) => Promise<void>;
  updateAllowlistSettings: (settings: Partial<AllowlistProtocolSettings>) => Promise<void>;
  updateProtectedSettings: (settings: Partial<ProtectedProtocolSettings>) => Promise<void>;
  updateHarnessSettings: (settings: Partial<HarnessProtocolSettings>) => Promise<void>;
  updateSonnetSettings: (settings: Partial<SonnetProtocolSettings>) => Promise<void>;
  
  // Allowlist helpers
  addAllowlistDomain: (domain: string) => Promise<void>;
  removeAllowlistDomain: (domain: string) => Promise<void>;
  isAllowlisted: (hostname: string) => boolean;
  
  // HTTPS enforcement
  httpsEnforced: boolean;
  setHttpsEnforced: (enforced: boolean) => Promise<void>;
  
  // ML Safety Mode (placeholder for future)
  mlSafetyEnabled: boolean;
  setMlSafetyEnabled: (enabled: boolean) => Promise<void>;
  
  // Loading states
  isLoading: boolean;
}

// Storage Keys
const STORAGE_KEYS = {
  DEVELOPER_MODE: '@protocol_developer_mode',
  DEVELOPER_PIN: '@protocol_developer_pin',
  PRESENTATION_MODE: '@protocol_presentation_mode',
  ACTIVE_PROTOCOL: '@protocol_active',
  PROTOCOLS_CONFIG: '@protocols_config',
  STANDARD_SETTINGS: '@protocol_standard_settings',
  ALLOWLIST_SETTINGS: '@protocol_allowlist_settings',
  PROTECTED_SETTINGS: '@protocol_protected_settings',
  HARNESS_SETTINGS: '@protocol_harness_settings',
  SONNET_SETTINGS: '@protocol_sonnet_settings',
  HTTPS_ENFORCED: '@protocol_https_enforced',
  ML_SAFETY: '@protocol_ml_safety',
  TESTING_WATERMARK: '@protocol_testing_watermark',
};

// Default Settings
const DEFAULT_STANDARD_SETTINGS: StandardProtocolSettings = {
  autoInject: true,
  stealthByDefault: true,
  respectSiteSettings: true,
  injectMotionData: true,
  loopVideo: true,
};

const DEFAULT_ALLOWLIST_SETTINGS: AllowlistProtocolSettings = {
  enabled: false,
  domains: [],
  blockUnlisted: true,
  showBlockedIndicator: true,
  autoAddCurrentSite: false,
};

const DEFAULT_PROTECTED_SETTINGS: ProtectedProtocolSettings = {
  bodyDetectionEnabled: true,
  sensitivityLevel: 'medium',
  replacementVideoId: null,
  showProtectedBadge: true,
  autoTriggerOnFace: true,
  blurFallback: true,
};

const DEFAULT_HARNESS_SETTINGS: HarnessProtocolSettings = {
  overlayEnabled: true,
  showDebugInfo: true,
  captureFrameRate: 30,
  enableAudioPassthrough: false,
  mirrorVideo: false,
  testPatternOnNoVideo: true,
};

const DEFAULT_SONNET_SETTINGS: SonnetProtocolSettings = {
  aiModelVersion: 'sonnet-4.5',
  adaptiveInjection: true,
  adaptiveThreshold: 0.75,
  contextAwareness: true,
  behaviorAnalysis: true,
  anomalyDetection: true,
  performanceOptimization: true,
  predictivePreloading: true,
  intelligentFallback: true,
  mlInferenceEnabled: true,
  mlModelPath: null,
  selfHealing: true,
  continuousLearning: true,
  privacyPreservation: true,
  crossProtocolSync: true,
  advancedMetrics: true,
};

const DEFAULT_PROTOCOLS: Record<ProtocolType, ProtocolConfig> = {
  standard: {
    id: 'standard',
    name: 'Protocol 1: Standard Injection',
    description: 'Uses the current media injection flow inside this app. Default for internal testing.',
    enabled: true,
    settings: {},
  },
  allowlist: {
    id: 'allowlist',
    name: 'Protocol 2: Allowlist Test Mode',
    description: 'Limits injection to explicitly allowed domains. Recommended for safe testing.',
    enabled: true,
    settings: {},
  },
  protected: {
    id: 'protected',
    name: 'Protocol 3: Protected Preview',
    description: 'Consent-based local preview with body detection and safe video replacement.',
    enabled: true,
    settings: {},
  },
  harness: {
    id: 'harness',
    name: 'Protocol 4: Local Test Harness',
    description: 'Local sandbox page for safe overlay testing without third-party sites.',
    enabled: true,
    settings: {},
  },
  sonnet: {
    id: 'sonnet',
    name: 'Protocol 5: Sonnet Advanced AI',
    description: 'AI-powered adaptive injection with intelligent context awareness, predictive optimization, self-healing, and continuous learning. Most advanced protocol.',
    enabled: true,
    settings: {},
  },
};

export const [ProtocolProvider, useProtocol] = createContextHook<ProtocolContextValue>(() => {
  const [isLoading, setIsLoading] = useState(true);
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  const [developerPin, setDeveloperPinState] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(true);
  const [showTestingWatermark, setShowTestingWatermarkState] = useState(true);
  const [activeProtocol, setActiveProtocolState] = useState<ProtocolType>('standard');
  const [protocols, setProtocols] = useState<Record<ProtocolType, ProtocolConfig>>(DEFAULT_PROTOCOLS);
  const [httpsEnforced, setHttpsEnforcedState] = useState(true);
  const [mlSafetyEnabled, setMlSafetyEnabledState] = useState(true);
  
  // Protocol-specific settings
  const [standardSettings, setStandardSettings] = useState<StandardProtocolSettings>(DEFAULT_STANDARD_SETTINGS);
  const [allowlistSettings, setAllowlistSettings] = useState<AllowlistProtocolSettings>(DEFAULT_ALLOWLIST_SETTINGS);
  const [protectedSettings, setProtectedSettings] = useState<ProtectedProtocolSettings>(DEFAULT_PROTECTED_SETTINGS);
  const [harnessSettings, setHarnessSettings] = useState<HarnessProtocolSettings>(DEFAULT_HARNESS_SETTINGS);
  const [sonnetSettings, setSonnetSettings] = useState<SonnetProtocolSettings>(DEFAULT_SONNET_SETTINGS);

  // Load all settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          devMode,
          pin,
          presMode,
          watermark,
          activeProto,
          protocolsConfig,
          standard,
          allowlist,
          protected_,
          harness,
          sonnet,
          https,
          mlSafety,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.DEVELOPER_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.DEVELOPER_PIN),
          AsyncStorage.getItem(STORAGE_KEYS.PRESENTATION_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.TESTING_WATERMARK),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROTOCOL),
          AsyncStorage.getItem(STORAGE_KEYS.PROTOCOLS_CONFIG),
          AsyncStorage.getItem(STORAGE_KEYS.STANDARD_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.ALLOWLIST_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.PROTECTED_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.HARNESS_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.SONNET_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.HTTPS_ENFORCED),
          AsyncStorage.getItem(STORAGE_KEYS.ML_SAFETY),
        ]);

        if (devMode !== null) setDeveloperModeEnabled(devMode === 'true');
        if (pin) setDeveloperPinState(pin);
        if (presMode !== null) setPresentationMode(presMode === 'true');
        if (watermark !== null) setShowTestingWatermarkState(watermark === 'true');
        if (activeProto) setActiveProtocolState(activeProto as ProtocolType);
        if (protocolsConfig) {
          try {
            const parsed = JSON.parse(protocolsConfig);
            setProtocols({ ...DEFAULT_PROTOCOLS, ...parsed });
          } catch (e) {
            console.warn('[Protocol] Failed to parse protocols config:', e);
          }
        }
        if (standard) {
          try {
            setStandardSettings({ ...DEFAULT_STANDARD_SETTINGS, ...JSON.parse(standard) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse standard settings:', e);
          }
        }
        if (allowlist) {
          try {
            setAllowlistSettings({ ...DEFAULT_ALLOWLIST_SETTINGS, ...JSON.parse(allowlist) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse allowlist settings:', e);
          }
        }
        if (protected_) {
          try {
            setProtectedSettings({ ...DEFAULT_PROTECTED_SETTINGS, ...JSON.parse(protected_) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse protected settings:', e);
          }
        }
        if (harness) {
          try {
            setHarnessSettings({ ...DEFAULT_HARNESS_SETTINGS, ...JSON.parse(harness) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse harness settings:', e);
          }
        }
        if (sonnet) {
          try {
            setSonnetSettings({ ...DEFAULT_SONNET_SETTINGS, ...JSON.parse(sonnet) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse sonnet settings:', e);
          }
        }
        if (https !== null) setHttpsEnforcedState(https === 'true');
        if (mlSafety !== null) setMlSafetyEnabledState(mlSafety === 'true');

        console.log('[Protocol] Settings loaded successfully');
      } catch (error) {
        console.error('[Protocol] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const toggleDeveloperMode = useCallback(async () => {
    const newValue = !developerModeEnabled;
    setDeveloperModeEnabled(newValue);
    await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_MODE, String(newValue));
    console.log('[Protocol] Developer mode toggled:', newValue);
  }, [developerModeEnabled]);

  const setDeveloperModeWithPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!developerPin) {
      // First time setup - set the pin
      setDeveloperPinState(pin);
      await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_PIN, pin);
      setDeveloperModeEnabled(true);
      await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_MODE, 'true');
      return true;
    }
    
    if (pin === developerPin) {
      setDeveloperModeEnabled(true);
      await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_MODE, 'true');
      return true;
    }
    
    return false;
  }, [developerPin]);

  const setDeveloperPin = useCallback(async (pin: string) => {
    setDeveloperPinState(pin);
    await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_PIN, pin);
  }, []);

  const togglePresentationMode = useCallback(() => {
    const newValue = !presentationMode;
    setPresentationMode(newValue);
    AsyncStorage.setItem(STORAGE_KEYS.PRESENTATION_MODE, String(newValue)).catch(
      (err) => console.error('[Protocol] Failed to save presentation mode:', err)
    );
    console.log('[Protocol] Presentation mode toggled:', newValue);
  }, [presentationMode]);

  const setShowTestingWatermark = useCallback(async (show: boolean) => {
    setShowTestingWatermarkState(show);
    await AsyncStorage.setItem(STORAGE_KEYS.TESTING_WATERMARK, String(show));
  }, []);

  const setActiveProtocol = useCallback(async (protocol: ProtocolType) => {
    setActiveProtocolState(protocol);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROTOCOL, protocol);
    console.log('[Protocol] Active protocol set:', protocol);
  }, []);

  const updateProtocolConfig = useCallback(async <T extends ProtocolType>(
    protocol: T,
    updates: Partial<ProtocolConfig>
  ) => {
    const newProtocols = {
      ...protocols,
      [protocol]: { ...protocols[protocol], ...updates },
    };
    setProtocols(newProtocols);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS_CONFIG, JSON.stringify(newProtocols));
  }, [protocols]);

  const updateStandardSettings = useCallback(async (settings: Partial<StandardProtocolSettings>) => {
    const newSettings = { ...standardSettings, ...settings };
    setStandardSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.STANDARD_SETTINGS, JSON.stringify(newSettings));
  }, [standardSettings]);

  const updateAllowlistSettings = useCallback(async (settings: Partial<AllowlistProtocolSettings>) => {
    const newSettings = { ...allowlistSettings, ...settings };
    setAllowlistSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.ALLOWLIST_SETTINGS, JSON.stringify(newSettings));
  }, [allowlistSettings]);

  const updateProtectedSettings = useCallback(async (settings: Partial<ProtectedProtocolSettings>) => {
    const newSettings = { ...protectedSettings, ...settings };
    setProtectedSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTECTED_SETTINGS, JSON.stringify(newSettings));
  }, [protectedSettings]);

  const updateHarnessSettings = useCallback(async (settings: Partial<HarnessProtocolSettings>) => {
    const newSettings = { ...harnessSettings, ...settings };
    setHarnessSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.HARNESS_SETTINGS, JSON.stringify(newSettings));
  }, [harnessSettings]);

  const updateSonnetSettings = useCallback(async (settings: Partial<SonnetProtocolSettings>) => {
    const newSettings = { ...sonnetSettings, ...settings };
    setSonnetSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.SONNET_SETTINGS, JSON.stringify(newSettings));
  }, [sonnetSettings]);

  const addAllowlistDomain = useCallback(async (domain: string) => {
    const normalized = domain.trim().toLowerCase().replace(/^www\./, '');
    if (!normalized || allowlistSettings.domains.includes(normalized)) return;
    
    const newDomains = [...allowlistSettings.domains, normalized];
    await updateAllowlistSettings({ domains: newDomains });
  }, [allowlistSettings.domains, updateAllowlistSettings]);

  const removeAllowlistDomain = useCallback(async (domain: string) => {
    const newDomains = allowlistSettings.domains.filter(d => d !== domain);
    await updateAllowlistSettings({ domains: newDomains });
  }, [allowlistSettings.domains, updateAllowlistSettings]);

  const isAllowlisted = useCallback((hostname: string): boolean => {
    if (!allowlistSettings.enabled) return true;
    const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
    return allowlistSettings.domains.some(domain =>
      normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`)
    );
  }, [allowlistSettings.enabled, allowlistSettings.domains]);

  const setHttpsEnforced = useCallback(async (enforced: boolean) => {
    setHttpsEnforcedState(enforced);
    await AsyncStorage.setItem(STORAGE_KEYS.HTTPS_ENFORCED, String(enforced));
  }, []);

  const setMlSafetyEnabled = useCallback(async (enabled: boolean) => {
    setMlSafetyEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.ML_SAFETY, String(enabled));
  }, []);

  return {
    developerModeEnabled,
    toggleDeveloperMode,
    setDeveloperModeWithPin,
    developerPin,
    setDeveloperPin,
    presentationMode,
    togglePresentationMode,
    showTestingWatermark,
    setShowTestingWatermark,
    activeProtocol,
    setActiveProtocol,
    protocols,
    updateProtocolConfig,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    sonnetSettings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    updateSonnetSettings,
    addAllowlistDomain,
    removeAllowlistDomain,
    isAllowlisted,
    httpsEnforced,
    setHttpsEnforced,
    mlSafetyEnabled,
    setMlSafetyEnabled,
    isLoading,
  };
});
