import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Check, ChevronRight, FlaskConical, Globe, Lock, Shield, Wand2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { useProtocol, type ProtocolType } from '@/contexts/ProtocolContext';

interface ProtocolSettingsModalProps {
  visible: boolean;
  currentHostname: string;
  onClose: () => void;
}

const PROTOCOL_ORDER: ProtocolType[] = ['standard', 'allowlist', 'protected', 'harness', 'gpt52'];

export default function ProtocolSettingsModal({ visible, currentHostname, onClose }: ProtocolSettingsModalProps) {
  const [domainInput, setDomainInput] = useState('');
  const [expanded, setExpanded] = useState<ProtocolType | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinEntry, setShowPinEntry] = useState(false);

  const { isDeveloperModeEnabled, isAllowlistEditable, isProtocolEditable, toggleDeveloperMode } = useDeveloperMode();

  const {
    activeProtocol,
    setActiveProtocol,
    protocols,
    updateProtocolConfig,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    gpt52Settings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    updateGpt52Settings,
    addAllowlistDomain,
    removeAllowlistDomain,
    isAllowlisted,
    httpsEnforced,
    setHttpsEnforced,
    mlSafetyEnabled,
    setMlSafetyEnabled,
    presentationMode,
    togglePresentationMode,
    showTestingWatermark,
    setShowTestingWatermark,
  } = useProtocol();

  const orderedProtocols = useMemo(() => {
    const available = new Set(Object.keys(protocols) as ProtocolType[]);
    return PROTOCOL_ORDER.filter((id) => available.has(id));
  }, [protocols]);

  const currentAllowlisted = useMemo(() => {
    if (!currentHostname) return false;
    return isAllowlisted(currentHostname);
  }, [currentHostname, isAllowlisted]);

  const handleAddDomain = useCallback(() => {
    const raw = domainInput.trim();
    if (!raw) return;
    if (!isAllowlistEditable) {
      Alert.alert('Locked', 'Enable Developer Mode to edit the allowlist.');
      return;
    }
    addAllowlistDomain(raw);
    setDomainInput('');
  }, [addAllowlistDomain, domainInput, isAllowlistEditable]);

  const handleRemoveDomain = useCallback((domain: string) => {
    if (!isAllowlistEditable) {
      Alert.alert('Locked', 'Enable Developer Mode to edit the allowlist.');
      return;
    }
    removeAllowlistDomain(domain);
  }, [isAllowlistEditable, removeAllowlistDomain]);

  const openProtectedPreview = useCallback(() => {
    onClose();
    requestAnimationFrame(() => setTimeout(() => router.push('/protected-preview'), 0));
  }, [onClose]);

  const openTestHarness = useCallback(() => {
    onClose();
    requestAnimationFrame(() => setTimeout(() => router.push('/test-harness'), 0));
  }, [onClose]);

  const toggleExpanded = useCallback((id: ProtocolType) => {
    setExpanded((prev) => (prev === id ? null : id));
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FlaskConical size={20} color="#00ff88" />
              <Text style={styles.title}>Protocols</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.devBar}>
            <View style={styles.devBarLeft}>
              <View style={[styles.devIcon, isDeveloperModeEnabled && styles.devIconActive]}>
                <Lock size={14} color={isDeveloperModeEnabled ? '#0a0a0a' : '#ff6b35'} />
              </View>
              <View>
                <Text style={styles.devTitle}>{isDeveloperModeEnabled ? 'Developer Mode' : 'Parent Mode'}</Text>
                <Text style={styles.devHint}>{isDeveloperModeEnabled ? 'Settings unlocked' : 'Settings locked for safety'}</Text>
              </View>
            </View>
            <Switch
              value={isDeveloperModeEnabled}
              onValueChange={() => {
                if (isDeveloperModeEnabled) {
                  toggleDeveloperMode();
                } else {
                  setShowPinEntry(true);
                }
              }}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={isDeveloperModeEnabled ? '#ffffff' : '#888888'}
            />
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {showPinEntry && !isDeveloperModeEnabled && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Enter PIN</Text>
                <Text style={styles.sectionHint}>Required to enable Developer Mode.</Text>
                <View style={styles.domainRow}>
                  <TextInput
                    style={styles.domainInput}
                    value={pinInput}
                    onChangeText={setPinInput}
                    placeholder="PIN"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={async () => {
                      const ok = await toggleDeveloperMode(pinInput);
                      if (!ok) {
                        Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect.');
                        return;
                      }
                      setPinInput('');
                      setShowPinEntry(false);
                    }}
                  >
                    <Text style={styles.addBtnText}>Unlock</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.domainItem, { justifyContent: 'center' }]}
                  onPress={() => {
                    setPinInput('');
                    setShowPinEntry(false);
                  }}
                >
                  <Text style={[styles.domainText, { textAlign: 'center', width: '100%' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionTitle}>Active Protocol</Text>
            <Text style={styles.sectionHint}>Select which protocol is driving injection behavior.</Text>

            <View style={styles.card}>
              {orderedProtocols.map((id) => {
                const cfg = protocols[id];
                const enabled = cfg?.enabled ?? true;
                const isActive = id === activeProtocol;
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.protocolRow}
                    onPress={() => setActiveProtocol(id)}
                    disabled={!enabled}
                  >
                    <View style={styles.protocolRowLeft}>
                      <Text style={styles.protocolName}>{cfg?.name || id}</Text>
                      {!enabled && <Text style={styles.protocolOff}>OFF</Text>}
                    </View>
                    <View style={styles.protocolRowRight}>
                      {isActive && <Check size={16} color="#00ff88" />}
                      <Switch
                        value={enabled}
                        onValueChange={(v) => updateProtocolConfig(id, { enabled: v })}
                        disabled={!isProtocolEditable}
                        trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                        thumbColor={enabled ? '#ffffff' : '#888888'}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>App Safeguards</Text>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>HTTPS Enforced</Text>
                <Switch
                  value={httpsEnforced}
                  onValueChange={(v) => setHttpsEnforced(v)}
                  disabled={!isProtocolEditable}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                  thumbColor={httpsEnforced ? '#ffffff' : '#888888'}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>ML Safety Mode</Text>
                <Switch
                  value={mlSafetyEnabled}
                  onValueChange={(v) => setMlSafetyEnabled(v)}
                  disabled={!isProtocolEditable}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                  thumbColor={mlSafetyEnabled ? '#ffffff' : '#888888'}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Presentation Mode</Text>
                <Switch
                  value={presentationMode}
                  onValueChange={togglePresentationMode}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                  thumbColor={presentationMode ? '#ffffff' : '#888888'}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Overlay Watermark</Text>
                <Switch
                  value={showTestingWatermark}
                  onValueChange={(v) => setShowTestingWatermark(v)}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                  thumbColor={showTestingWatermark ? '#ffffff' : '#888888'}
                />
              </View>
            </View>

            {/* Standard */}
            <TouchableOpacity style={styles.expandHeader} onPress={() => toggleExpanded('standard')}>
              <Text style={styles.expandTitle}>Standard</Text>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: expanded === 'standard' ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>
            {expanded === 'standard' && (
              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Auto Inject</Text>
                  <Switch value={standardSettings.autoInject} onValueChange={(v) => updateStandardSettings({ autoInject: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={standardSettings.autoInject ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Stealth by Default</Text>
                  <Switch value={standardSettings.stealthByDefault} onValueChange={(v) => updateStandardSettings({ stealthByDefault: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={standardSettings.stealthByDefault ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Respect Site Settings</Text>
                  <Switch value={standardSettings.respectSiteSettings} onValueChange={(v) => updateStandardSettings({ respectSiteSettings: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={standardSettings.respectSiteSettings ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Inject Motion Data</Text>
                  <Switch value={standardSettings.injectMotionData} onValueChange={(v) => updateStandardSettings({ injectMotionData: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={standardSettings.injectMotionData ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Loop Video</Text>
                  <Switch value={standardSettings.loopVideo} onValueChange={(v) => updateStandardSettings({ loopVideo: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={standardSettings.loopVideo ? '#ffffff' : '#888888'} />
                </View>
              </View>
            )}

            {/* Allowlist */}
            <TouchableOpacity style={styles.expandHeader} onPress={() => toggleExpanded('allowlist')}>
              <Text style={styles.expandTitle}>Allowlist</Text>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: expanded === 'allowlist' ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>
            {expanded === 'allowlist' && (
              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Enable Allowlist</Text>
                  <Switch value={allowlistSettings.enabled} onValueChange={(v) => updateAllowlistSettings({ enabled: v })} disabled={!isAllowlistEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={allowlistSettings.enabled ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Block Unlisted</Text>
                  <Switch value={allowlistSettings.blockUnlisted} onValueChange={(v) => updateAllowlistSettings({ blockUnlisted: v })} disabled={!isAllowlistEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={allowlistSettings.blockUnlisted ? '#ffffff' : '#888888'} />
                </View>

                <View style={styles.currentSiteRow}>
                  <Globe size={14} color="#00aaff" />
                  <Text style={styles.currentSiteText}>{currentHostname || 'No site loaded'}</Text>
                  {currentHostname ? (
                    <View style={[styles.siteBadge, currentAllowlisted ? styles.siteBadgeAllowed : styles.siteBadgeBlocked]}>
                      <Text style={styles.siteBadgeText}>{currentAllowlisted ? 'Allowed' : 'Blocked'}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.domainRow}>
                  <TextInput
                    style={[styles.domainInput, !isAllowlistEditable && styles.domainInputDisabled]}
                    value={domainInput}
                    onChangeText={setDomainInput}
                    placeholder={isAllowlistEditable ? 'Add domain (example.com)' : 'Unlock to edit'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={isAllowlistEditable}
                  />
                  <TouchableOpacity style={[styles.addBtn, !isAllowlistEditable && styles.addBtnDisabled]} onPress={handleAddDomain} disabled={!isAllowlistEditable}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {allowlistSettings.domains.map((domain) => (
                  <TouchableOpacity key={domain} style={styles.domainItem} onPress={() => handleRemoveDomain(domain)} disabled={!isAllowlistEditable}>
                    <Text style={styles.domainText}>{domain}</Text>
                    <Text style={styles.removeText}>{isAllowlistEditable ? 'Remove' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Protected */}
            <TouchableOpacity style={styles.expandHeader} onPress={() => toggleExpanded('protected')}>
              <Text style={styles.expandTitle}>Protected Preview</Text>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: expanded === 'protected' ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>
            {expanded === 'protected' && (
              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Body Detection Enabled</Text>
                  <Switch value={protectedSettings.bodyDetectionEnabled} onValueChange={(v) => updateProtectedSettings({ bodyDetectionEnabled: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={protectedSettings.bodyDetectionEnabled ? '#ffffff' : '#888888'} />
                </View>
                <TouchableOpacity style={styles.linkBtn} onPress={openProtectedPreview}>
                  <Shield size={14} color="#0a0a0a" />
                  <Text style={styles.linkBtnText}>Open Protected Preview</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Harness */}
            <TouchableOpacity style={styles.expandHeader} onPress={() => toggleExpanded('harness')}>
              <Text style={styles.expandTitle}>Local Test Harness</Text>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: expanded === 'harness' ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>
            {expanded === 'harness' && (
              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Overlay Enabled</Text>
                  <Switch value={harnessSettings.overlayEnabled} onValueChange={(v) => updateHarnessSettings({ overlayEnabled: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={harnessSettings.overlayEnabled ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Mirror Video</Text>
                  <Switch value={harnessSettings.mirrorVideo} onValueChange={(v) => updateHarnessSettings({ mirrorVideo: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={harnessSettings.mirrorVideo ? '#ffffff' : '#888888'} />
                </View>
                <TouchableOpacity style={styles.linkBtn} onPress={openTestHarness}>
                  <Shield size={14} color="#0a0a0a" />
                  <Text style={styles.linkBtnText}>Open Test Harness</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* GPT-5.2 */}
            <TouchableOpacity style={styles.expandHeader} onPress={() => toggleExpanded('gpt52')}>
              <Text style={styles.expandTitle}>GPT-5.2 Advanced</Text>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: expanded === 'gpt52' ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>
            {expanded === 'gpt52' && (
              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Auto Inject</Text>
                  <Switch value={gpt52Settings.autoInject} onValueChange={(v) => updateGpt52Settings({ autoInject: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.autoInject ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Force Simulation</Text>
                  <Switch value={gpt52Settings.forceSimulation} onValueChange={(v) => updateGpt52Settings({ forceSimulation: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.forceSimulation ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Inject Motion Data</Text>
                  <Switch value={gpt52Settings.injectMotionData} onValueChange={(v) => updateGpt52Settings({ injectMotionData: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.injectMotionData ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Loop Video</Text>
                  <Switch value={gpt52Settings.loopVideo} onValueChange={(v) => updateGpt52Settings({ loopVideo: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.loopVideo ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Mirror Video</Text>
                  <Switch value={gpt52Settings.mirrorVideo} onValueChange={(v) => updateGpt52Settings({ mirrorVideo: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.mirrorVideo ? '#ffffff' : '#888888'} />
                </View>
                <View style={styles.settingRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Wand2 size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.settingLabel}>Aggressive Retry</Text>
                  </View>
                  <Switch value={gpt52Settings.aggressiveRetry} onValueChange={(v) => updateGpt52Settings({ aggressiveRetry: v })} disabled={!isProtocolEditable} trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }} thumbColor={gpt52Settings.aggressiveRetry ? '#ffffff' : '#888888'} />
                </View>
              </View>
            )}

            <Text style={styles.footerText}>
              Protocol changes affect injection behavior immediately. Use only in controlled environments you own/operate.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  body: {
    padding: 16,
  },
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  devBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  devIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devIconActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  devTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  devHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  protocolRowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  protocolRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  protocolName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  protocolOff: {
    fontSize: 10,
    marginTop: 3,
    color: '#ff6b35',
    fontWeight: '700' as const,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingLabel: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600' as const,
  },
  expandHeader: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  currentSiteRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentSiteText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  siteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  siteBadgeAllowed: { backgroundColor: 'rgba(0, 255, 136, 0.2)' },
  siteBadgeBlocked: { backgroundColor: 'rgba(255, 71, 87, 0.2)' },
  siteBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#ffffff' },
  domainRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  domainInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  domainInputDisabled: {
    opacity: 0.6,
  },
  addBtn: {
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#00ff88',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#0a0a0a',
  },
  domainItem: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  domainText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  removeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  linkBtn: {
    marginTop: 10,
    backgroundColor: '#00aaff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  linkBtnText: {
    color: '#0a0a0a',
    fontWeight: '800' as const,
    fontSize: 12,
  },
  footerText: {
    marginTop: 16,
    marginBottom: 22,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.45)',
  },
});

