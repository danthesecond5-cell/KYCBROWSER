import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as Crypto from 'expo-crypto';
import {
  DeveloperModeSettings,
  DEFAULT_DEVELOPER_MODE,
  DEFAULT_PROTOCOL_SETTINGS,
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
  
  // Loading state
  isLoading: boolean;
}

export const [DeveloperModeProvider, useDeveloperMode] = createContextHook<DeveloperModeContextValue>(() => {
  const [developerMode, setDeveloperMode] = useState<DeveloperModeSettings>(DEFAULT_DEVELOPER_MODE);
  const [, setProtocolSettings] = useState(DEFAULT_PROTOCOL_SETTINGS);
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
    isLoading,
  };
});