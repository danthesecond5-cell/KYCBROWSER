import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

// Protocol Types
export type ProtocolType = 'standard' | 'allowlist' | 'protected' | 'harness' | 'gpt52' | 'gpt-5-2-codex-high';

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

export interface GPT52ProtocolSettings {
  autoInject: boolean;
  stealthByDefault: boolean;
  injectMotionData: boolean;
  forceSimulation: boolean;
  loopVideo: boolean;
  mirrorVideo: boolean;
  aggressiveRetry: boolean;
}

export interface CodexHighProtocolSettings {
  autoInject: boolean;
  stealthMode: boolean;
  forceSimulation: boolean;
  aggressiveRetries: boolean;
  autoRecover: boolean;
  showOverlayLabel: boolean;
  loopVideo: boolean;
  mirrorVideo: boolean;
  enableTelemetry: boolean;
}

export interface ProtocolContextValue {
  // Developer Mode
  developerModeEnabled: boolean;
  toggleDeveloperMode: (pinAttempt?: string) => Promise<boolean>;
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
  gpt52Settings: GPT52ProtocolSettings;
  codexSettings: CodexHighProtocolSettings;
  
  // Settings Updaters
  updateStandardSettings: (settings: Partial<StandardProtocolSettings>) => Promise<void>;
  updateAllowlistSettings: (settings: Partial<AllowlistProtocolSettings>) => Promise<void>;
  updateProtectedSettings: (settings: Partial<ProtectedProtocolSettings>) => Promise<void>;
  updateHarnessSettings: (settings: Partial<HarnessProtocolSettings>) => Promise<void>;
  updateGpt52Settings: (settings: Partial<GPT52ProtocolSettings>) => Promise<void>;
  updateCodexSettings: (settings: Partial<CodexHighProtocolSettings>) => Promise<void>;
  
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
  GPT52_SETTINGS: '@protocol_gpt52_settings',
  CODEX_SETTINGS: '@protocol_codex_settings',
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

const DEFAULT_GPT52_SETTINGS: GPT52ProtocolSettings = {
  autoInject: true,
  stealthByDefault: true,
  injectMotionData: true,
  forceSimulation: true,
  loopVideo: true,
  mirrorVideo: false,
  aggressiveRetry: true,
};

const DEFAULT_CODEX_SETTINGS: CodexHighProtocolSettings = {
  autoInject: true,
  stealthMode: true,
  forceSimulation: true,
  aggressiveRetries: true,
  autoRecover: true,
  showOverlayLabel: false,
  loopVideo: true,
  mirrorVideo: false,
  enableTelemetry: false,
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
  gpt52: {
    id: 'gpt52',
    name: 'Protocol 5: GPT-5.2 Advanced',
    description: 'Aggressive, best-effort injection preset with enhanced self-healing and diagnostics.',
    enabled: true,
    settings: {},
  },
  'gpt-5-2-codex-high': {
    id: 'gpt-5-2-codex-high',
    name: 'Protocol 6: GPT-5.2 Codex High',
    description: 'Advanced Codex protocol with aggressive retries and auto-recovery capabilities.',
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
  const [gpt52Settings, setGpt52Settings] = useState<GPT52ProtocolSettings>(DEFAULT_GPT52_SETTINGS);
  const [codexSettings, setCodexSettings] = useState<CodexHighProtocolSettings>(DEFAULT_CODEX_SETTINGS);

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
          gpt52,
          codex,
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
          AsyncStorage.getItem(STORAGE_KEYS.GPT52_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.CODEX_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.HTTPS_ENFORCED),
          AsyncStorage.getItem(STORAGE_KEYS.ML_SAFETY),
        ]);

        if (devMode !== null) setDeveloperModeEnabled(devMode === 'true');
        if (pin) setDeveloperPinState(pin);
        if (presMode !== null) setPresentationMode(presMode === 'true');
        if (watermark !== null) setShowTestingWatermarkState(watermark === 'true');
        if (activeProto) {
          setActiveProtocolState(isProtocolType(activeProto) ? activeProto : 'standard');
        }
        if (protocolsConfig) {
          try {
            const parsed = JSON.parse(protocolsConfig);
            // Merge only known protocol keys to avoid invalid persisted shapes.
            const merged = { ...DEFAULT_PROTOCOLS } as Record<ProtocolType, ProtocolConfig>;
            (Object.keys(DEFAULT_PROTOCOLS) as ProtocolType[]).forEach((key) => {
              if (parsed && parsed[key]) {
                merged[key] = { ...DEFAULT_PROTOCOLS[key], ...parsed[key], id: key };
              }
            });
            setProtocols(merged);
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
        if (gpt52) {
          try {
            setGpt52Settings({ ...DEFAULT_GPT52_SETTINGS, ...JSON.parse(gpt52) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse gpt52 settings:', e);
          }
        }
        if (codex) {
          try {
            setCodexSettings({ ...DEFAULT_CODEX_SETTINGS, ...JSON.parse(codex) });
          } catch (e) {
            console.warn('[Protocol] Failed to parse codex settings:', e);
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
  }, [isProtocolType]);

  const toggleDeveloperMode = useCallback(async (pinAttempt?: string): Promise<boolean> => {
    // Enabling requires a pin (if one has been set).
    if (!developerModeEnabled) {
      if (developerPin && pinAttempt !== developerPin) {
        console.warn('[Protocol] Incorrect PIN attempt to enable developer mode');
        return false;
      }
    }
    const newValue = !developerModeEnabled;
    setDeveloperModeEnabled(newValue);
    await AsyncStorage.setItem(STORAGE_KEYS.DEVELOPER_MODE, String(newValue));
    console.log('[Protocol] Developer mode toggled:', newValue);
    return true;
  }, [developerModeEnabled, developerPin]);

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
    // Defensive: callers should only pass known protocols, but guard against bad values.
    if (!isProtocolType(protocol)) {
      console.warn('[Protocol] Ignoring invalid protocol set:', protocol);
      return;
    }
    setActiveProtocolState(protocol);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROTOCOL, protocol);
    console.log('[Protocol] Active protocol set:', protocol);
  }, [isProtocolType]);

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

  const updateGpt52Settings = useCallback(async (settings: Partial<GPT52ProtocolSettings>) => {
    const newSettings = { ...gpt52Settings, ...settings };
    setGpt52Settings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.GPT52_SETTINGS, JSON.stringify(newSettings));
  }, [gpt52Settings]);

  const updateCodexSettings = useCallback(async (settings: Partial<CodexHighProtocolSettings>) => {
    const newSettings = { ...codexSettings, ...settings };
    setCodexSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.CODEX_SETTINGS, JSON.stringify(newSettings));
  }, [codexSettings]);

  const addAllowlistDomain = useCallback(async (domain: string) => {
    const normalized = domain.trim().toLowerCase().replace(/^www\./, '');
    if (!normalized) return;
    
    // Enhanced validation
    // Remove protocol if present
    let cleanDomain = normalized.replace(/^https?:\/\//, '');
    // Remove path if present
    cleanDomain = cleanDomain.split('/')[0];
    // Remove port if present
    cleanDomain = cleanDomain.split(':')[0];
    
    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      console.warn('[Protocol] Invalid domain format:', cleanDomain);
      return;
    }
    
    // Check for duplicates (including subdomains)
    const isDuplicate = allowlistSettings.domains.some(d => 
      d === cleanDomain || cleanDomain.endsWith('.' + d) || d.endsWith('.' + cleanDomain)
    );
    
    if (isDuplicate) {
      console.log('[Protocol] Domain already in allowlist or is a subdomain:', cleanDomain);
      return;
    }
    
    const newDomains = [...allowlistSettings.domains, cleanDomain];
    await updateAllowlistSettings({ domains: newDomains });
    console.log('[Protocol] Added domain to allowlist:', cleanDomain);
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
    gpt52Settings,
    codexSettings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    updateGpt52Settings,
    updateCodexSettings,
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
