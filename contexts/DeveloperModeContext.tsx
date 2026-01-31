import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as Crypto from 'expo-crypto';
import {
  DeveloperModeSettings,
  ProtocolSettings,
  StandardInjectionSettings,
  AllowlistSettings,
  ProtectedPreviewSettings,
  TestHarnessSettings,
  DEFAULT_DEVELOPER_MODE,
  DEFAULT_PROTOCOL_SETTINGS,
  ProtocolId,
} from '@/types/protocols';

const DEVELOPER_MODE_KEY = '@developer_mode_settings';
const PROTOCOL_SETTINGS_KEY = '@protocol_settings';
const PIN_HASH_PREFIX = 'sha256:';

const normalizePin = (pin: string): string => pin.trim();

const isHashedPin = (pin?: string | null): boolean =>
  Boolean(pin && pin.startsWith(PIN_HASH_PREFIX) && pin.length > PIN_HASH_PREFIX.length);

const hashPin = async (pin: string): Promise<string> => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizePin(pin)
  );
  return `${PIN_HASH_PREFIX}${digest}`;
};

interface DeveloperModeContextValue {
  // Developer Mode
  developerMode: DeveloperModeSettings;
  isDeveloperModeEnabled: boolean;
  isAllowlistEditable: boolean;
  isProtocolEditable: boolean;
  // Toggle now accepts an optional PIN attempt and returns a boolean indicating success
  toggleDeveloperMode: (pin?: string) => Promise<boolean>;
  updateDeveloperSettings: (updates: Partial<DeveloperModeSettings>) => Promise<void>;
  verifyPinCode: (pin: string) => Promise<boolean>;
  setPinCode: (pin: string | null) => Promise<void>;
  
  // Protocol Settings
  protocolSettings: ProtocolSettings;
  updateStandardSettings: (updates: Partial<StandardInjectionSettings>) => Promise<void>;
  updateAllowlistSettings: (updates: Partial<AllowlistSettings>) => Promise<void>;
  updateProtectedSettings: (updates: Partial<ProtectedPreviewSettings>) => Promise<void>;
  updateHarnessSettings: (updates: Partial<TestHarnessSettings>) => Promise<void>;
  toggleProtocolEnabled: (protocolId: ProtocolId) => Promise<void>;
  resetProtocolSettings: (protocolId?: ProtocolId) => Promise<void>;
  
  // Loading state
  isLoading: boolean;
}

export const [DeveloperModeProvider, useDeveloperMode] = createContextHook<DeveloperModeContextValue>(() => {
  const [developerMode, setDeveloperMode] = useState<DeveloperModeSettings>(DEFAULT_DEVELOPER_MODE);
  const [protocolSettings, setProtocolSettings] = useState<ProtocolSettings>(DEFAULT_PROTOCOL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [devModeData, protocolData] = await Promise.all([
          AsyncStorage.getItem(DEVELOPER_MODE_KEY),
          AsyncStorage.getItem(PROTOCOL_SETTINGS_KEY),
        ]);

        let loadedDeveloperMode = DEFAULT_DEVELOPER_MODE;

        if (devModeData) {
          const parsed = JSON.parse(devModeData);
          loadedDeveloperMode = { ...DEFAULT_DEVELOPER_MODE, ...parsed };
        }

        if (loadedDeveloperMode.pinCode && !isHashedPin(loadedDeveloperMode.pinCode)) {
          const hashedPin = await hashPin(loadedDeveloperMode.pinCode);
          loadedDeveloperMode = { ...loadedDeveloperMode, pinCode: hashedPin };
          await AsyncStorage.setItem(DEVELOPER_MODE_KEY, JSON.stringify(loadedDeveloperMode));
          console.log('[DeveloperMode] Migrated developer PIN to hashed storage');
        }

        setDeveloperMode(loadedDeveloperMode);
        console.log('[DeveloperMode] Loaded developer mode settings');

        if (protocolData) {
          const parsed = JSON.parse(protocolData);
          setProtocolSettings({
            standard: { ...DEFAULT_PROTOCOL_SETTINGS.standard, ...parsed.standard },
            allowlist: { ...DEFAULT_PROTOCOL_SETTINGS.allowlist, ...parsed.allowlist },
            protected: { ...DEFAULT_PROTOCOL_SETTINGS.protected, ...parsed.protected },
            harness: { ...DEFAULT_PROTOCOL_SETTINGS.harness, ...parsed.harness },
          });
          console.log('[DeveloperMode] Loaded protocol settings');
        }
      } catch (error) {
        console.error('[DeveloperMode] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save developer mode settings
  const saveDeveloperMode = useCallback(async (settings: DeveloperModeSettings) => {
    try {
      await AsyncStorage.setItem(DEVELOPER_MODE_KEY, JSON.stringify(settings));
      console.log('[DeveloperMode] Saved developer mode settings');
    } catch (error) {
      console.error('[DeveloperMode] Failed to save developer mode:', error);
    }
  }, []);

  // Save protocol settings
  const saveProtocolSettings = useCallback(async (settings: ProtocolSettings) => {
    try {
      await AsyncStorage.setItem(PROTOCOL_SETTINGS_KEY, JSON.stringify(settings));
      console.log('[DeveloperMode] Saved protocol settings');
    } catch (error) {
      console.error('[DeveloperMode] Failed to save protocol settings:', error);
    }
  }, []);

  // PIN code management
  const verifyPinCode = useCallback(async (pin: string): Promise<boolean> => {
    if (!developerMode.pinCode) return true;
    const normalizedPin = normalizePin(pin);
    if (!normalizedPin) return false;
    if (isHashedPin(developerMode.pinCode)) {
      const hashed = await hashPin(normalizedPin);
      return hashed === developerMode.pinCode;
    }
    return developerMode.pinCode === normalizedPin;
  }, [developerMode.pinCode]);

  const setPinCode = useCallback(async (pin: string | null) => {
    const normalizedPin = pin ? normalizePin(pin) : null;
    const hashedPin = normalizedPin ? await hashPin(normalizedPin) : null;
    const updated = { ...developerMode, pinCode: hashedPin };
    setDeveloperMode(updated);
    await saveDeveloperMode(updated);
    console.log('[DeveloperMode] PIN code', hashedPin ? 'set' : 'cleared');
  }, [developerMode, saveDeveloperMode]);

  // Toggle developer mode (requires PIN when enabling)
  const toggleDeveloperMode = useCallback(async (pinAttempt?: string) => {
    // If enabling developer mode, require correct PIN
    if (!developerMode.enabled) {
      const validPin = await verifyPinCode(pinAttempt ?? '');
      if (!validPin) {
        console.warn('[DeveloperMode] Incorrect PIN attempt to enable developer mode');
        return false;
      }
    }

    const newEnabled = !developerMode.enabled;
    const updated = {
      ...developerMode,
      enabled: newEnabled,
      lastEnabledAt: newEnabled ? new Date().toISOString() : developerMode.lastEnabledAt,
    };
    setDeveloperMode(updated);
    await saveDeveloperMode(updated);
    console.log('[DeveloperMode] Developer mode toggled:', newEnabled);
    return true;
  }, [developerMode, saveDeveloperMode, verifyPinCode]);

  // Update developer settings
  const updateDeveloperSettings = useCallback(async (updates: Partial<DeveloperModeSettings>) => {
    const updated = { ...developerMode, ...updates };
    setDeveloperMode(updated);
    await saveDeveloperMode(updated);
  }, [developerMode, saveDeveloperMode]);

  // Protocol settings updates
  const updateStandardSettings = useCallback(async (updates: Partial<StandardInjectionSettings>) => {
    const updated = {
      ...protocolSettings,
      standard: { ...protocolSettings.standard, ...updates },
    };
    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
  }, [protocolSettings, saveProtocolSettings]);

  const updateAllowlistSettings = useCallback(async (updates: Partial<AllowlistSettings>) => {
    const updated = {
      ...protocolSettings,
      allowlist: { ...protocolSettings.allowlist, ...updates },
    };
    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
  }, [protocolSettings, saveProtocolSettings]);

  const updateProtectedSettings = useCallback(async (updates: Partial<ProtectedPreviewSettings>) => {
    const updated = {
      ...protocolSettings,
      protected: { ...protocolSettings.protected, ...updates },
    };
    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
  }, [protocolSettings, saveProtocolSettings]);

  const updateHarnessSettings = useCallback(async (updates: Partial<TestHarnessSettings>) => {
    const updated = {
      ...protocolSettings,
      harness: { ...protocolSettings.harness, ...updates },
    };
    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
  }, [protocolSettings, saveProtocolSettings]);

  // Toggle protocol enabled status
  const toggleProtocolEnabled = useCallback(async (protocolId: ProtocolId) => {
    const updates: Partial<ProtocolSettings> = {};
    
    switch (protocolId) {
      case 'standard':
        updates.standard = { ...protocolSettings.standard, enabled: !protocolSettings.standard.enabled };
        break;
      case 'allowlist':
        updates.allowlist = { ...protocolSettings.allowlist, enabled: !protocolSettings.allowlist.enabled };
        break;
      case 'protected':
        updates.protected = { ...protocolSettings.protected, enabled: !protocolSettings.protected.enabled };
        break;
      case 'harness':
        updates.harness = { ...protocolSettings.harness, enabled: !protocolSettings.harness.enabled };
        break;
    }

    const updated = { ...protocolSettings, ...updates };
    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
    console.log('[DeveloperMode] Protocol', protocolId, 'toggled');
  }, [protocolSettings, saveProtocolSettings]);

  // Reset protocol settings
  const resetProtocolSettings = useCallback(async (protocolId?: ProtocolId) => {
    let updated: ProtocolSettings;
    
    if (protocolId) {
      updated = { ...protocolSettings };
      switch (protocolId) {
        case 'standard':
          updated.standard = DEFAULT_PROTOCOL_SETTINGS.standard;
          break;
        case 'allowlist':
          updated.allowlist = DEFAULT_PROTOCOL_SETTINGS.allowlist;
          break;
        case 'protected':
          updated.protected = DEFAULT_PROTOCOL_SETTINGS.protected;
          break;
        case 'harness':
          updated.harness = DEFAULT_PROTOCOL_SETTINGS.harness;
          break;
      }
    } else {
      updated = DEFAULT_PROTOCOL_SETTINGS;
    }

    setProtocolSettings(updated);
    await saveProtocolSettings(updated);
    console.log('[DeveloperMode] Protocol settings reset:', protocolId || 'all');
  }, [protocolSettings, saveProtocolSettings]);

  // Computed values
  const isDeveloperModeEnabled = developerMode.enabled;
  const isAllowlistEditable = developerMode.enabled && developerMode.allowAllowlistEditing;
  const isProtocolEditable = developerMode.enabled && developerMode.allowProtocolEditing;

  return {
    developerMode,
    isDeveloperModeEnabled,
    isAllowlistEditable,
    isProtocolEditable,
    toggleDeveloperMode,
    updateDeveloperSettings,
    verifyPinCode,
    setPinCode,
    protocolSettings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    toggleProtocolEnabled,
    resetProtocolSettings,
    isLoading,
  };
});