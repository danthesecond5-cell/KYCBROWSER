import React, { useState, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import {
  X,
  Shield,
  Lock,
  Unlock,
  Trash2,
  ChevronRight,
  EyeOff,
  Zap,
  Monitor,
  FlaskConical,
  Check,
  AlertTriangle,
  Globe,
  Cpu,
  Wifi,
  Video,
  Activity,
  ZapOff,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useProtocol, ProtocolType } from '@/contexts/ProtocolContext';
import { exportRingBufferToPhotos } from '@/utils/webrtcLoopbackNative';

interface ProtocolSettingsModalProps {
  visible: boolean;
  currentHostname: string;
  onClose: () => void;
}

export default function ProtocolSettingsModal({
  visible,
  currentHostname,
  onClose,
}: ProtocolSettingsModalProps) {
  const {
    developerModeEnabled,
    toggleDeveloperMode,
    setDeveloperModeWithPin,
    developerPin,
    presentationMode,
    togglePresentationMode,
    showTestingWatermark,
    setShowTestingWatermark,
    activeProtocol,
    setActiveProtocol,
    protocols,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    holographicSettings,
    webrtcLoopbackSettings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    updateHolographicSettings,
    updateWebRtcLoopbackSettings,
    addAllowlistDomain,
    removeAllowlistDomain,
    isAllowlisted,
    httpsEnforced,
    setHttpsEnforced,
    mlSafetyEnabled,
    setMlSafetyEnabled,
    enterpriseWebKitEnabled,
    setEnterpriseWebKitEnabled,
  } = useProtocol();

  const [pinInput, setPinInput] = useState('');
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [domainInput, setDomainInput] = useState('');

  const handleToggleEnterpriseWebKit = async (nextValue: boolean) => {
    if (!developerModeEnabled) {
      Alert.alert('Developer Mode Required', 'Enable developer mode to modify enterprise WebKit settings.');
      return;
    }
    await setEnterpriseWebKitEnabled(nextValue);
    Alert.alert(
      'Enterprise WebKit',
      'This setting requires the WebView to reload. The browser view will restart automatically.',
      [{ text: 'OK' }]
    );
  };
  const [expandedProtocol, setExpandedProtocol] = useState<ProtocolType | null>(activeProtocol);

  const currentAllowlisted = useMemo(() => {
    return isAllowlisted(currentHostname);
  }, [isAllowlisted, currentHostname]);

  const handleAddDomain = () => {
    if (!domainInput.trim()) return;
    addAllowlistDomain(domainInput);
    setDomainInput('');
  };

  const handleAddCurrentSite = () => {
    if (!currentHostname) return;
    addAllowlistDomain(currentHostname);
  };

  const handlePinSubmit = async () => {
    if (pinInput.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 characters.');
      return;
    }
    
    const success = await setDeveloperModeWithPin(pinInput);
    if (success) {
      setShowPinEntry(false);
      setPinInput('');
      Alert.alert('Developer Mode', developerPin ? 'Developer mode enabled.' : 'PIN set. Developer mode enabled.');
    } else {
      Alert.alert('Invalid PIN', 'The PIN you entered is incorrect.');
      setPinInput('');
    }
  };

  const handleToggleDeveloperMode = () => {
    if (developerModeEnabled) {
      Alert.alert(
        'Disable Developer Mode',
        'This will lock all protocol settings and the allowlist. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable', style: 'destructive', onPress: toggleDeveloperMode },
        ]
      );
    } else {
      if (developerPin) {
        setShowPinEntry(true);
      } else {
        Alert.alert(
          'Set Developer PIN',
          'You need to set a PIN to enable developer mode.',
          [{ text: 'OK', onPress: () => setShowPinEntry(true) }]
        );
      }
    }
  };

  // Legacy handlers removed
  // const handleAddDomain = () => {};
  // const handleAddCurrentSite = () => {};

  const toggleProtocol = (protocol: ProtocolType) => {
    setExpandedProtocol(expandedProtocol === protocol ? null : protocol);
  };

  const handleOpenProtectedPreview = () => {
    onClose();
    router.push('/protected-preview');
  };

  const handleOpenTestHarness = () => {
    onClose();
    router.push('/test-harness');
  };

  const renderProtocolSettings = (protocol: ProtocolType) => {
    if (!developerModeEnabled) {
      return (
        <View style={styles.lockedNotice}>
          <Lock size={14} color="rgba(255,255,255,0.4)" />
          <Text style={styles.lockedNoticeText}>
            Enable developer mode to customize settings
          </Text>
        </View>
      );
    }

    switch (protocol) {
      case 'standard':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto Inject</Text>
                <Text style={styles.settingHint}>Automatically inject media on page load</Text>
              </View>
              <Switch
                value={standardSettings.autoInject}
                onValueChange={(v) => updateStandardSettings({ autoInject: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={standardSettings.autoInject ? '#ffffff' : '#888'}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Stealth by Default</Text>
                <Text style={styles.settingHint}>Hide injection from site detection</Text>
              </View>
              <Switch
                value={standardSettings.stealthByDefault}
                onValueChange={(v) => updateStandardSettings({ stealthByDefault: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={standardSettings.stealthByDefault ? '#ffffff' : '#888'}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Inject Motion Data</Text>
                <Text style={styles.settingHint}>Include accelerometer/gyroscope simulation</Text>
              </View>
              <Switch
                value={standardSettings.injectMotionData}
                onValueChange={(v) => updateStandardSettings({ injectMotionData: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={standardSettings.injectMotionData ? '#ffffff' : '#888'}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Loop Video</Text>
                <Text style={styles.settingHint}>Loop video when it ends</Text>
              </View>
              <Switch
                value={standardSettings.loopVideo}
                onValueChange={(v) => updateStandardSettings({ loopVideo: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={standardSettings.loopVideo ? '#ffffff' : '#888'}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Native WebRTC Bridge</Text>
                <Text style={styles.settingHint}>Forced ON (native dev client required)</Text>
              </View>
              <Text style={styles.settingValue}>FORCED</Text>
            </View>
          </View>
        );

      case 'allowlist':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Allowlist</Text>
                <Text style={styles.settingHint}>Only inject on allowed domains</Text>
              </View>
              <Switch
                value={allowlistSettings.enabled}
                onValueChange={(v) => updateAllowlistSettings({ enabled: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={allowlistSettings.enabled ? '#ffffff' : '#888'}
              />
            </View>

            {currentHostname && (
              <View style={styles.currentSiteRow}>
                <Globe size={14} color="#00aaff" />
                <Text style={styles.currentSiteText}>{currentHostname}</Text>
                <View style={[
                  styles.statusBadge,
                  currentAllowlisted ? styles.statusAllowed : styles.statusBlocked,
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {currentAllowlisted ? 'Allowed' : 'Blocked'}
                  </Text>
                </View>
                {!currentAllowlisted && (
                  <TouchableOpacity style={styles.addCurrentBtn} onPress={handleAddCurrentSite}>
                    <Text style={styles.addCurrentBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Block Unlisted</Text>
                <Text style={styles.settingHint}>Block injection on unlisted domains</Text>
              </View>
              <Switch
                value={allowlistSettings.blockUnlisted}
                onValueChange={(v) => updateAllowlistSettings({ blockUnlisted: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff4757' }}
                thumbColor={allowlistSettings.blockUnlisted ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Blocked Indicator</Text>
                <Text style={styles.settingHint}>Display indicator when blocked</Text>
              </View>
              <Switch
                value={allowlistSettings.showBlockedIndicator}
                onValueChange={(v) => updateAllowlistSettings({ showBlockedIndicator: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={allowlistSettings.showBlockedIndicator ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.domainInputRow}>
              <TextInput
                style={styles.domainInput}
                value={domainInput}
                onChangeText={setDomainInput}
                placeholder="Add domain (e.g., example.com)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddDomain}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {allowlistSettings.domains.length > 0 ? (
              <View style={styles.domainList}>
                {allowlistSettings.domains.map((domain) => (
                  <View key={domain} style={styles.domainItem}>
                    <Text style={styles.domainText}>{domain}</Text>
                    <TouchableOpacity onPress={() => removeAllowlistDomain(domain)}>
                      <Trash2 size={14} color="#ff4757" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No domains in allowlist</Text>
            )}
          </View>
        );

      case 'holographic':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Wifi size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>WebSocket Bridge</Text>
                </View>
                <Text style={styles.settingHint}>Local socket server for binary streaming</Text>
              </View>
              <Switch
                value={holographicSettings.useWebSocketBridge}
                onValueChange={(v) => updateHolographicSettings({ useWebSocketBridge: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={holographicSettings.useWebSocketBridge ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Video size={12} color="#b388ff" />
                  <Text style={styles.settingLabel}>Canvas Resolution</Text>
                </View>
                <Text style={styles.settingHint}>Target injection quality</Text>
              </View>
              <View style={styles.sensitivityButtons}>
                {(['720p', '1080p', '4k'] as const).map((res) => (
                  <TouchableOpacity
                    key={res}
                    style={[
                      styles.sensitivityBtn,
                      holographicSettings.canvasResolution === res && styles.sensitivityBtnActive,
                    ]}
                    onPress={() => updateHolographicSettings({ canvasResolution: res })}
                  >
                    <Text style={[
                      styles.sensitivityBtnText,
                      holographicSettings.canvasResolution === res && styles.sensitivityBtnTextActive,
                    ]}>
                      {res}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Cpu size={12} color="#ff6b35" />
                  <Text style={styles.settingLabel}>SDP Masquerade</Text>
                </View>
                <Text style={styles.settingHint}>Rewrite WebRTC SDP to mock hardware</Text>
              </View>
              <Switch
                value={holographicSettings.sdpMasquerade}
                onValueChange={(v) => updateHolographicSettings({ sdpMasquerade: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={holographicSettings.sdpMasquerade ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#ffcc00" />
                  <Text style={styles.settingLabel}>Noise Injection</Text>
                </View>
                <Text style={styles.settingHint}>Add sensor noise to bypass detection</Text>
              </View>
               <View style={styles.sliderContainer}>
                  <Text style={styles.sliderValue}>{(holographicSettings.noiseInjectionLevel * 100).toFixed(0)}%</Text>
                  <View style={styles.miniBarContainer}>
                     {[0.1, 0.2, 0.5, 0.8].map((level) => (
                        <TouchableOpacity 
                           key={level}
                           style={[
                             styles.miniBar, 
                             holographicSettings.noiseInjectionLevel >= level && styles.miniBarActive
                           ]}
                           onPress={() => updateHolographicSettings({ noiseInjectionLevel: level })}
                        />
                     ))}
                  </View>
               </View>
            </View>
            
            <View style={styles.mlNotice}>
                <ZapOff size={14} color="#00aaff" />
                <Text style={styles.mlNoticeText}>
                  Holographic mode bypasses standard browser security checks.
                </Text>
             </View>
          </View>
        );

      case 'webrtc-loopback':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Wifi size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Auto Start</Text>
                </View>
                <Text style={styles.settingHint}>Automatically start loopback when injected</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.autoStart}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ autoStart: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={webrtcLoopbackSettings.autoStart ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Shield size={12} color="#ff6b35" />
                  <Text style={styles.settingLabel}>Require Native Bridge</Text>
                </View>
                <Text style={styles.settingHint}>Fail fast when native WebRTC provider is missing</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.requireNativeBridge}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ requireNativeBridge: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={webrtcLoopbackSettings.requireNativeBridge ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#ffcc00" />
                  <Text style={styles.settingLabel}>Signaling Timeout (ms)</Text>
                </View>
                <Text style={styles.settingHint}>How long to wait for a native answer</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.signalingTimeoutMs)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    updateWebRtcLoopbackSettings({ signalingTimeoutMs: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Cpu size={12} color="#00ff88" />
                  <Text style={styles.settingLabel}>Preferred Codec</Text>
                </View>
                <Text style={styles.settingHint}>Codec ordering for receive pipeline</Text>
              </View>
              <View style={styles.sensitivityButtons}>
                {(['auto', 'h264', 'vp8', 'vp9'] as const).map((codec) => (
                  <TouchableOpacity
                    key={codec}
                    style={[
                      styles.sensitivityBtn,
                      webrtcLoopbackSettings.preferredCodec === codec && styles.sensitivityBtnActive,
                    ]}
                    onPress={() => updateWebRtcLoopbackSettings({ preferredCodec: codec })}
                  >
                    <Text style={[
                      styles.sensitivityBtnText,
                      webrtcLoopbackSettings.preferredCodec === codec && styles.sensitivityBtnTextActive,
                    ]}>
                      {codec.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Max Bitrate (kbps)</Text>
                </View>
                <Text style={styles.settingHint}>0 = no cap, tune for stability</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.maxBitrateKbps)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ maxBitrateKbps: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#b388ff" />
                  <Text style={styles.settingLabel}>Keepalive Interval (ms)</Text>
                </View>
                <Text style={styles.settingHint}>Ping channel to keep loopback alive</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.keepAliveIntervalMs)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    updateWebRtcLoopbackSettings({ keepAliveIntervalMs: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#ff6b35" />
                  <Text style={styles.settingLabel}>Stats Interval (ms)</Text>
                </View>
                <Text style={styles.settingHint}>How often to sample WebRTC stats</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.statsIntervalMs)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    updateWebRtcLoopbackSettings({ statsIntervalMs: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Shield size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Data Channel Keepalive</Text>
                </View>
                <Text style={styles.settingHint}>Use a data channel for ping/pong</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.enableDataChannel}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ enableDataChannel: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={webrtcLoopbackSettings.enableDataChannel ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00ff88" />
                  <Text style={styles.settingLabel}>ICE Restart</Text>
                </View>
                <Text style={styles.settingHint}>Auto-restart ICE on failure</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.enableIceRestart}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ enableIceRestart: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={webrtcLoopbackSettings.enableIceRestart ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Video size={12} color="#ff00ff" />
                  <Text style={styles.settingLabel}>Simulcast</Text>
                </View>
                <Text style={styles.settingHint}>Enable multi-layer receive hints</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.enableSimulcast}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ enableSimulcast: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff00ff' }}
                thumbColor={webrtcLoopbackSettings.enableSimulcast ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00ff88" />
                  <Text style={styles.settingLabel}>Adaptive Bitrate</Text>
                </View>
                <Text style={styles.settingHint}>Auto-tune bitrate based on live stats</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.enableAdaptiveBitrate}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ enableAdaptiveBitrate: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={webrtcLoopbackSettings.enableAdaptiveBitrate ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Adaptive Resolution</Text>
                </View>
                <Text style={styles.settingHint}>Auto-scale resolution under stress</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.enableAdaptiveResolution}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ enableAdaptiveResolution: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={webrtcLoopbackSettings.enableAdaptiveResolution ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Cpu size={12} color="#ff6b35" />
                  <Text style={styles.settingLabel}>Min Bitrate (kbps)</Text>
                </View>
                <Text style={styles.settingHint}>Floor for adaptive bitrate</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.minBitrateKbps)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ minBitrateKbps: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Cpu size={12} color="#ffcc00" />
                  <Text style={styles.settingLabel}>Target Bitrate (kbps)</Text>
                </View>
                <Text style={styles.settingHint}>Adaptive bitrate target</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.targetBitrateKbps)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ targetBitrateKbps: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Video size={12} color="#b388ff" />
                  <Text style={styles.settingLabel}>Ring Buffer Recording</Text>
                </View>
                <Text style={styles.settingHint}>Keep a rolling buffer of recent frames</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.recordingEnabled}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ recordingEnabled: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#b388ff' }}
                thumbColor={webrtcLoopbackSettings.recordingEnabled ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Ring Buffer (s)</Text>
                </View>
                <Text style={styles.settingHint}>Total seconds to keep</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.ringBufferSeconds)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ ringBufferSeconds: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#ff6b35" />
                  <Text style={styles.settingLabel}>Segment Size (s)</Text>
                </View>
                <Text style={styles.settingHint}>Segment length for rotation</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.ringSegmentSeconds)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ ringSegmentSeconds: parsed });
                  }
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                try {
                  await exportRingBufferToPhotos();
                  Alert.alert('Ring Buffer Exported', 'Saved to Photos.');
                } catch (err) {
                  Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unable to export ring buffer.');
                }
              }}
            >
              <Video size={16} color="#00ff88" />
              <Text style={styles.actionButtonText}>Export Ring Buffer to Photos</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Wifi size={12} color="#00aaff" />
                  <Text style={styles.settingLabel}>Cache Remote Videos</Text>
                </View>
                <Text style={styles.settingHint}>Download & cache remote URLs for stable decode</Text>
              </View>
              <Switch
                value={webrtcLoopbackSettings.cacheRemoteVideos}
                onValueChange={(v) => updateWebRtcLoopbackSettings({ cacheRemoteVideos: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={webrtcLoopbackSettings.cacheRemoteVideos ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#00ff88" />
                  <Text style={styles.settingLabel}>Cache TTL (hours)</Text>
                </View>
                <Text style={styles.settingHint}>How long to keep remote cache</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.cacheTTLHours)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ cacheTTLHours: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Activity size={12} color="#ffcc00" />
                  <Text style={styles.settingLabel}>Cache Max (MB)</Text>
                </View>
                <Text style={styles.settingHint}>Limit cache size</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(webrtcLoopbackSettings.cacheMaxSizeMB)}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  if (!Number.isNaN(parsed)) {
                    updateWebRtcLoopbackSettings({ cacheMaxSizeMB: parsed });
                  }
                }}
              />
            </View>

            <View style={styles.infoNotice}>
              <AlertTriangle size={14} color="#ffcc00" />
              <Text style={styles.infoNoticeText}>
                Requires a native iOS WebRTC provider. JavaScript-only injection cannot work on WKWebView.
              </Text>
            </View>
          </View>
        );

      case 'protected':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Body Detection</Text>
                <Text style={styles.settingHint}>Enable ML-based body detection</Text>
              </View>
              <Switch
                value={protectedSettings.bodyDetectionEnabled}
                onValueChange={(v) => updateProtectedSettings({ bodyDetectionEnabled: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={protectedSettings.bodyDetectionEnabled ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sensitivity</Text>
              </View>
              <View style={styles.sensitivityButtons}>
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.sensitivityBtn,
                      protectedSettings.sensitivityLevel === level && styles.sensitivityBtnActive,
                    ]}
                    onPress={() => updateProtectedSettings({ sensitivityLevel: level })}
                  >
                    <Text style={[
                      styles.sensitivityBtnText,
                      protectedSettings.sensitivityLevel === level && styles.sensitivityBtnTextActive,
                    ]}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Protected Badge</Text>
                <Text style={styles.settingHint}>Display protection status overlay</Text>
              </View>
              <Switch
                value={protectedSettings.showProtectedBadge}
                onValueChange={(v) => updateProtectedSettings({ showProtectedBadge: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={protectedSettings.showProtectedBadge ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Blur Fallback</Text>
                <Text style={styles.settingHint}>Blur if no replacement video</Text>
              </View>
              <Switch
                value={protectedSettings.blurFallback}
                onValueChange={(v) => updateProtectedSettings({ blurFallback: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={protectedSettings.blurFallback ? '#ffffff' : '#888'}
              />
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleOpenProtectedPreview}>
              <Shield size={16} color="#00ff88" />
              <Text style={styles.actionButtonText}>Open Protected Preview</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        );

      case 'harness':
        return (
          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Overlay Enabled</Text>
                <Text style={styles.settingHint}>Enable video overlay on camera</Text>
              </View>
              <Switch
                value={harnessSettings.overlayEnabled}
                onValueChange={(v) => updateHarnessSettings({ overlayEnabled: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={harnessSettings.overlayEnabled ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Debug Info</Text>
                <Text style={styles.settingHint}>Display FPS, latency, and status</Text>
              </View>
              <Switch
                value={harnessSettings.showDebugInfo}
                onValueChange={(v) => updateHarnessSettings({ showDebugInfo: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                thumbColor={harnessSettings.showDebugInfo ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Mirror Video</Text>
                <Text style={styles.settingHint}>Flip video horizontally</Text>
              </View>
              <Switch
                value={harnessSettings.mirrorVideo}
                onValueChange={(v) => updateHarnessSettings({ mirrorVideo: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={harnessSettings.mirrorVideo ? '#ffffff' : '#888'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Test Pattern</Text>
                <Text style={styles.settingHint}>Show test pattern when no video</Text>
              </View>
              <Switch
                value={harnessSettings.testPatternOnNoVideo}
                onValueChange={(v) => updateHarnessSettings({ testPatternOnNoVideo: v })}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#b388ff' }}
                thumbColor={harnessSettings.testPatternOnNoVideo ? '#ffffff' : '#888'}
              />
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleOpenTestHarness}>
              <Monitor size={16} color="#00aaff" />
              <Text style={styles.actionButtonText}>Open Test Harness</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const protocolIcons: Record<ProtocolType, React.ReactNode> = {
    standard: <Zap size={18} color="#00ff88" />,
    allowlist: <Shield size={18} color="#00aaff" />,
    protected: <EyeOff size={18} color="#ff6b35" />,
    harness: <Monitor size={18} color="#b388ff" />,
    holographic: <ZapOff size={18} color="#00ff88" />,
    websocket: <Globe size={18} color="#00aaff" />,
    'webrtc-loopback': <Wifi size={18} color="#00aaff" />,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FlaskConical size={20} color="#ffcc00" />
              <Text style={styles.title}>Testing Protocols</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Developer Mode Section */}
            <View style={styles.developerSection}>
              <View style={styles.developerHeader}>
                <View style={styles.developerHeaderLeft}>
                  {developerModeEnabled ? (
                    <Unlock size={20} color="#00ff88" />
                  ) : (
                    <Lock size={20} color="#ff4757" />
                  )}
                  <Text style={styles.developerTitle}>Developer Mode</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.developerToggle,
                    developerModeEnabled && styles.developerToggleActive,
                  ]}
                  onPress={handleToggleDeveloperMode}
                >
                  <Text style={[
                    styles.developerToggleText,
                    developerModeEnabled && styles.developerToggleTextActive,
                  ]}>
                    {developerModeEnabled ? 'Enabled' : 'Locked'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.developerHint}>
                {developerModeEnabled
                  ? 'All settings are unlocked. Changes will affect injection behavior.'
                  : 'Enable developer mode with PIN to modify protocol settings and allowlist.'}
              </Text>

              {showPinEntry && (
                <View style={styles.pinEntry}>
                  <TextInput
                    style={styles.pinInput}
                    value={pinInput}
                    onChangeText={setPinInput}
                    placeholder={developerPin ? 'Enter PIN' : 'Set a new PIN'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry
                    autoFocus
                  />
                  <TouchableOpacity style={styles.pinButton} onPress={handlePinSubmit}>
                    <Check size={18} color="#0a0a0a" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pinCancelButton}
                    onPress={() => {
                      setShowPinEntry(false);
                      setPinInput('');
                    }}
                  >
                    <X size={18} color="#ff4757" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {Platform.OS === 'ios' && (
              <View style={styles.enterpriseSection}>
                <Text style={styles.sectionTitle}>Enterprise iOS WebKit</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingLabelRow}>
                      <Shield size={12} color="#00ff88" />
                      <Text style={styles.settingLabel}>Enable Private WebKit Flags</Text>
                    </View>
                    <Text style={styles.settingHint}>
                      Unlocks WebCodecs/captureStream in enterprise builds.
                    </Text>
                  </View>
                  <Switch
                    value={enterpriseWebKitEnabled}
                    onValueChange={handleToggleEnterpriseWebKit}
                    trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                    thumbColor={enterpriseWebKitEnabled ? '#ffffff' : '#888'}
                    disabled={!developerModeEnabled}
                  />
                </View>
                <View style={styles.enterpriseNotice}>
                  <AlertTriangle size={14} color="#ffcc00" />
                  <Text style={styles.enterpriseNoticeText}>
                    Enterprise-only. Not App Store safe. WebView reload required.
                  </Text>
                </View>
              </View>
            )}

            {/* Presentation Mode Section */}
            <View style={styles.presentationSection}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Presentation Mode</Text>
                  <Text style={styles.settingHint}>Optimize UI for demonstrations</Text>
                </View>
                <Switch
                  value={presentationMode}
                  onValueChange={togglePresentationMode}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ffcc00' }}
                  thumbColor={presentationMode ? '#ffffff' : '#888'}
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Testing Watermark</Text>
                  <Text style={styles.settingHint}>Show &quot;Testing Prototype&quot; overlay</Text>
                </View>
                <Switch
                  value={showTestingWatermark}
                  onValueChange={setShowTestingWatermark}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ffcc00' }}
                  thumbColor={showTestingWatermark ? '#ffffff' : '#888'}
                />
              </View>
            </View>

            {/* Safety Features */}
            <View style={styles.safetySection}>
              <Text style={styles.sectionTitle}>Safety Features</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingLabelRow}>
                    <Lock size={12} color="#00ff88" />
                    <Text style={styles.settingLabel}>HTTPS Enforced</Text>
                  </View>
                  <Text style={styles.settingHint}>Only allow HTTPS connections</Text>
                </View>
                <Switch
                  value={httpsEnforced}
                  onValueChange={setHttpsEnforced}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                  thumbColor={httpsEnforced ? '#ffffff' : '#888'}
                  disabled={!developerModeEnabled}
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingLabelRow}>
                    <Cpu size={12} color="#00aaff" />
                    <Text style={styles.settingLabel}>ML Safety Mode</Text>
                  </View>
                  <Text style={styles.settingHint}>Enable ML-based content protection</Text>
                </View>
                <Switch
                  value={mlSafetyEnabled}
                  onValueChange={setMlSafetyEnabled}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
                  thumbColor={mlSafetyEnabled ? '#ffffff' : '#888'}
                  disabled={!developerModeEnabled}
                />
              </View>
              <View style={styles.mlNotice}>
                <AlertTriangle size={14} color="#ffcc00" />
                <Text style={styles.mlNoticeText}>
                  In production, ML models will prevent malicious use automatically.
                </Text>
              </View>
            </View>

            {/* Protocol List */}
            <View style={styles.protocolsSection}>
              <Text style={styles.sectionTitle}>Available Protocols</Text>
              
              {(Object.keys(protocols) as ProtocolType[]).map((protocolId) => {
                const protocol = protocols[protocolId];
                const isExpanded = expandedProtocol === protocolId;
                const isActive = activeProtocol === protocolId;

                return (
                  <View
                    key={protocolId}
                    style={[
                      styles.protocolCard,
                      isActive && styles.protocolCardActive,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.protocolHeader}
                      onPress={() => toggleProtocol(protocolId)}
                    >
                      <View style={styles.protocolHeaderLeft}>
                        {protocolIcons[protocolId]}
                        <View style={styles.protocolInfo}>
                          <Text style={styles.protocolName}>{protocol.name}</Text>
                          <Text style={styles.protocolDescription} numberOfLines={1}>
                            {protocol.description}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.protocolHeaderRight}>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>ACTIVE</Text>
                          </View>
                        )}
                        <ChevronRight
                          size={18}
                          color="rgba(255,255,255,0.4)"
                          style={{
                            transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                          }}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.protocolContent}>
                        <Text style={styles.protocolFullDescription}>
                          {protocol.description}
                        </Text>

                        {!isActive && (
                          <TouchableOpacity
                            style={styles.setActiveButton}
                            onPress={() => setActiveProtocol(protocolId)}
                          >
                            <Check size={14} color="#0a0a0a" />
                            <Text style={styles.setActiveButtonText}>Set as Active</Text>
                          </TouchableOpacity>
                        )}

                        {renderProtocolSettings(protocolId)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  body: {
    padding: 16,
  },
  developerSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  developerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  developerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  developerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  developerToggle: {
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.4)',
  },
  developerToggleActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: 'rgba(0, 255, 136, 0.4)',
  },
  developerToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff4757',
  },
  developerToggleTextActive: {
    color: '#00ff88',
  },
  developerHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  enterpriseSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  enterpriseNotice: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enterpriseNoticeText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 16,
  },
  pinEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  pinInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  pinButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    padding: 10,
  },
  pinCancelButton: {
    backgroundColor: 'rgba(255,71,87,0.2)',
    borderRadius: 10,
    padding: 10,
  },
  presentationSection: {
    backgroundColor: 'rgba(255, 204, 0, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.2)',
  },
  safetySection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  settingHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00ff88',
  },
  mlNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  mlNoticeText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255, 204, 0, 0.9)',
    lineHeight: 16,
  },
  protocolsSection: {
    marginBottom: 32,
  },
  protocolCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  protocolCardActive: {
    borderColor: 'rgba(0, 255, 136, 0.4)',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  protocolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  protocolHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  protocolInfo: {
    flex: 1,
  },
  protocolName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  protocolDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  protocolHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00ff88',
    letterSpacing: 0.5,
  },
  protocolContent: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  protocolFullDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginBottom: 12,
  },
  setActiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  setActiveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  settingsGroup: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  lockedNoticeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  currentSiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  currentSiteText: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusAllowed: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  statusBlocked: {
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  addCurrentBtn: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addCurrentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  sensitivityButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sensitivityBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sensitivityBtnActive: {
    backgroundColor: '#ff6b35',
  },
  sensitivityBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  sensitivityBtnTextActive: {
    color: '#ffffff',
  },
  domainInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  domainInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  numberInput: {
    minWidth: 90,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
  },
  infoNotice: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,204,0,0.12)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.35)',
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  addButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  domainList: {
    marginTop: 10,
    gap: 6,
  },
  domainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  domainText: {
    fontSize: 12,
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 10,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#00aaff',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderValue: {
    fontSize: 12,
    color: '#ffffff',
    width: 30,
    textAlign: 'right',
  },
  miniBarContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  miniBar: {
    width: 8,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  miniBarActive: {
    backgroundColor: '#ffcc00',
  },
});
