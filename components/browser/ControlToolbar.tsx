import React, { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  Modal,
  Switch,
  TextInput,
} from 'react-native';
import {
  ChevronUp,
  ChevronDown,
  Camera,
  Radio,
  Zap,
  EyeOff,
  Eye,
  Settings,
  Activity,
  Smartphone,
  Globe,
  Check,
  X,
  Trash2,
  Shield,
  ShieldOff,
  Film,
} from 'lucide-react-native';
import type { AccelerometerData, GyroscopeData } from '@/hooks/useMotionSensors';
import type { SimulationConfig, SimulationPattern, WebsiteSettings } from '@/types/browser';
import type { CaptureDevice } from '@/types/device';
import { PATTERN_PRESETS } from '@/constants/motionPatterns';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import type { SavedVideo } from '@/utils/videoManager';

interface ControlToolbarProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  activeTemplate: { name: string; captureDevices: CaptureDevice[] } | null;
  stealthMode: boolean;
  isSimulating: boolean;
  simulatingDevicesCount: number;
  activeCamerasCount: number;
  currentUrl: string;
  currentWebsiteSettings: WebsiteSettings | null;
  onStealthModeToggle: () => void;
  onOpenDevices: () => void;
  onOpenMyVideos: () => void;
  onOpenProtocols: () => void;
  onOpenSiteSettings: () => void;
  allowlistStatusLabel: string;
  allowlistBlocked: boolean;
  protocolEnabled: boolean;
  simulationActive: boolean;
  useRealSensors: boolean;
  accelData: AccelerometerData;
  gyroData: GyroscopeData;
  simConfig: SimulationConfig;
  onToggleSimulation: () => void;
  onToggleRealSensors: () => void;
  onSetSimConfig: (config: SimulationConfig) => void;
  onApplyVideoToDevice: (deviceId: string, video: SavedVideo) => void;
  onApplyVideoToAll: (video: SavedVideo) => void;
}

const getHostnameFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const ControlToolbar = memo(function ControlToolbar({
  isExpanded,
  onToggleExpanded,
  activeTemplate,
  stealthMode,
  isSimulating,
  simulatingDevicesCount,
  activeCamerasCount,
  currentUrl,
  currentWebsiteSettings,
  onStealthModeToggle,
  onOpenDevices,
  onOpenMyVideos,
  onOpenProtocols,
  onOpenSiteSettings,
  allowlistStatusLabel,
  allowlistBlocked,
  protocolEnabled,
  simulationActive,
  useRealSensors,
  accelData,
  gyroData,
  simConfig,
  onToggleSimulation,
  onToggleRealSensors,
  onSetSimConfig,
  onApplyVideoToDevice,
  onApplyVideoToAll,
}: ControlToolbarProps) {
  const [showMotionSection, setShowMotionSection] = useState(false);
  const [openVideoDropdownId, setOpenVideoDropdownId] = useState<string | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const { savedVideos, isVideoReady } = useVideoLibrary();

  const compatibleVideos = useMemo(() => {
    return savedVideos.filter(video => {
      const status = video.compatibility?.overallStatus;
      const isFullyCompatible = status === 'perfect' || status === 'compatible';
      return isFullyCompatible && isVideoReady(video.id);
    });
  }, [savedVideos, isVideoReady]);

  const hasCompatibleVideos = compatibleVideos.length > 0;
  const injectionDisabled = allowlistBlocked || !hasCompatibleVideos || !protocolEnabled;

  const applyAllLabel = useMemo(() => {
    if (!activeTemplate?.captureDevices.length) return 'Select compatible video';
    const assignedNames = activeTemplate.captureDevices
      .map(device => device.assignedVideoName)
      .filter((name): name is string => Boolean(name));

    if (assignedNames.length === 0) return 'Select compatible video';
    const uniqueNames = new Set(assignedNames);
    return uniqueNames.size === 1 ? assignedNames[0] : 'Mixed assignments';
  }, [activeTemplate]);

  const toggleVideoDropdown = useCallback((id: string) => {
    setOpenVideoDropdownId(prev => prev === id ? null : id);
  }, []);

  const handleSelectVideo = useCallback((video: SavedVideo, deviceId?: string) => {
    if (deviceId) {
      onApplyVideoToDevice(deviceId, video);
    } else {
      onApplyVideoToAll(video);
    }
    setOpenVideoDropdownId(null);
  }, [onApplyVideoToAll, onApplyVideoToDevice]);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 10,
    }).start();
  }, [isExpanded, expandAnim]);

  useEffect(() => {
    if (!isExpanded) {
      setOpenVideoDropdownId(null);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (injectionDisabled) {
      setOpenVideoDropdownId(null);
    }
  }, [injectionDisabled]);

  useEffect(() => {
    if (isSimulating) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isSimulating, pulseAnim]);

  const formatValue = (value: number) => value.toFixed(2);

  const siteStealthActive = currentWebsiteSettings?.useStealthByDefault ?? stealthMode;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.collapseBar} 
        onPress={onToggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusIndicators}>
            {isSimulating && (
              <Animated.View style={[
                styles.simIndicator,
                { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }
              ]}>
                <Radio size={12} color="#ff4444" />
                <Text style={styles.simIndicatorText}>SIM</Text>
              </Animated.View>
            )}
            
            <View style={[styles.statusBadge, siteStealthActive && styles.statusBadgeActive]}>
              {siteStealthActive ? (
                <EyeOff size={12} color="#0a0a0a" />
              ) : (
                <Eye size={12} color="rgba(255,255,255,0.6)" />
              )}
            </View>

            <View style={styles.countBadge}>
              <Camera size={12} color="#00ff88" />
              <Text style={styles.countText}>{activeCamerasCount}</Text>
            </View>

            {simulatingDevicesCount > 0 && (
              <View style={[styles.countBadge, styles.simCountBadge]}>
                <Zap size={12} color="#ff6b35" />
                <Text style={[styles.countText, styles.simCountText]}>{simulatingDevicesCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.collapseRight}>
            <Text style={styles.templateName} numberOfLines={1}>
              {activeTemplate?.name || 'No Template'}
            </Text>
            {isExpanded ? (
              <ChevronDown size={18} color="rgba(255,255,255,0.5)" />
            ) : (
              <ChevronUp size={18} color="rgba(255,255,255,0.5)" />
            )}
          </View>
        </View>
      </TouchableOpacity>

      <Animated.View style={[
        styles.expandedContent,
        {
          maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 680] }),
          opacity: expandAnim,
        }
      ]}>
        <ScrollView
          contentContainerStyle={styles.expandedContentScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusDashboard}>
            <Text style={styles.sectionTitle}>Status Dashboard</Text>
            
            <View style={styles.dashboardGrid}>
              <TouchableOpacity style={styles.dashboardCard} onPress={onOpenDevices}>
                <View style={styles.cardIcon}>
                  <Camera size={20} color="#00ff88" />
                </View>
                <Text style={styles.cardValue}>{activeTemplate?.captureDevices.length || 0}</Text>
                <Text style={styles.cardLabel}>Cameras</Text>
              </TouchableOpacity>

              <View 
                style={[styles.dashboardCard, simulatingDevicesCount > 0 && styles.dashboardCardActive]} 
              >
                <View style={[styles.cardIcon, simulatingDevicesCount > 0 && styles.cardIconActive]}>
                  <Zap size={20} color={simulatingDevicesCount > 0 ? '#0a0a0a' : '#ff6b35'} />
                </View>
                <Text style={[styles.cardValue, simulatingDevicesCount > 0 && styles.cardValueActive]}>
                  {simulatingDevicesCount}
                </Text>
                <Text style={[styles.cardLabel, simulatingDevicesCount > 0 && styles.cardLabelActive]}>
                  Simulating
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.dashboardCard, siteStealthActive && styles.dashboardCardStealth]} 
                onPress={onStealthModeToggle}
              >
                <View style={[styles.cardIcon, siteStealthActive && styles.cardIconStealth]}>
                  {siteStealthActive ? (
                    <ShieldOff size={20} color="#0a0a0a" />
                  ) : (
                    <Shield size={20} color="#00aaff" />
                  )}
                </View>
                <Text style={[styles.cardValue, siteStealthActive && styles.cardValueStealth]}>
                  {siteStealthActive ? 'ON' : 'OFF'}
                </Text>
                <Text style={[styles.cardLabel, siteStealthActive && styles.cardLabelStealth]}>
                  Stealth
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.siteSettingsButton}
            onPress={onOpenSiteSettings}
          >
            <Globe size={16} color="#00aaff" />
            <View style={styles.siteSettingsInfo}>
              <Text style={styles.siteSettingsLabel}>Site Settings</Text>
              <Text style={styles.siteSettingsUrl} numberOfLines={1}>
                {currentUrl ? getHostnameFromUrl(currentUrl) : 'No site loaded'}
              </Text>
            </View>
            {currentWebsiteSettings && (
              <View style={styles.siteSettingsBadge}>
                <Check size={12} color="#00ff88" />
              </View>
            )}
            <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={onOpenDevices}>
              <Smartphone size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Devices</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onOpenMyVideos}>
              <Film size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>My Videos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onOpenProtocols}>
              <Settings size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Protocols</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.settingsButton]} 
              onPress={() => setShowMotionSection(!showMotionSection)}
            >
              <Settings size={16} color={showMotionSection ? '#0a0a0a' : '#ffffff'} />
              <Text style={[styles.actionButtonText, showMotionSection && styles.actionButtonTextActive]}>
                Motion
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.videoSection}>
            <View style={styles.videoSectionHeader}>
              <View style={styles.videoSectionHeaderLeft}>
                <Film size={14} color="#00ff88" />
                <Text style={styles.videoSectionTitle}>Video Injection</Text>
              </View>
              <TouchableOpacity style={styles.videoSectionLink} onPress={onOpenMyVideos}>
                <Text style={styles.videoSectionLinkText}>Open Library</Text>
                <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          <Text style={styles.allowlistStatusText}>{allowlistStatusLabel}</Text>

            <View style={styles.dropdownGroup}>
              <Text style={styles.dropdownLabel}>Apply to all cameras</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, injectionDisabled && styles.dropdownButtonDisabled]}
                onPress={() => toggleVideoDropdown('all')}
                disabled={injectionDisabled}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    injectionDisabled && styles.dropdownButtonTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {applyAllLabel}
                </Text>
                <ChevronDown size={16} color={!injectionDisabled ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'} />
              </TouchableOpacity>
              {openVideoDropdownId === 'all' && !injectionDisabled && (
                <View style={styles.dropdownList}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {compatibleVideos.map(video => (
                      <TouchableOpacity
                        key={video.id}
                        style={[
                          styles.dropdownItem,
                          video.name === applyAllLabel && styles.dropdownItemSelected,
                        ]}
                        onPress={() => handleSelectVideo(video)}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            video.name === applyAllLabel && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {video.name}
                        </Text>
                        {video.name === applyAllLabel && <Check size={12} color="#00ff88" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {activeTemplate?.captureDevices.map(device => (
              <View key={device.id} style={styles.dropdownGroup}>
                <Text style={styles.dropdownLabel}>{device.name}</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, injectionDisabled && styles.dropdownButtonDisabled]}
                  onPress={() => toggleVideoDropdown(device.id)}
                  disabled={injectionDisabled}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      injectionDisabled && styles.dropdownButtonTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {device.assignedVideoName || 'Select compatible video'}
                  </Text>
                  <ChevronDown size={16} color={!injectionDisabled ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'} />
                </TouchableOpacity>
                {openVideoDropdownId === device.id && !injectionDisabled && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {compatibleVideos.map(video => (
                        <TouchableOpacity
                          key={video.id}
                          style={[
                            styles.dropdownItem,
                            video.name === device.assignedVideoName && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectVideo(video, device.id)}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              video.name === device.assignedVideoName && styles.dropdownItemTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {video.name}
                          </Text>
                          {video.name === device.assignedVideoName && <Check size={12} color="#00ff88" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))}

            {injectionDisabled && (
              <Text style={styles.dropdownEmptyText}>
                {!protocolEnabled
                  ? 'Active protocol is disabled. Enable it in Protocols to inject.'
                  : allowlistBlocked
                    ? 'Allowlist mode is blocking injection on this site.'
                    : 'Import compatible videos in My Videos to unlock injection options.'}
              </Text>
            )}
          </View>

          {showMotionSection && (
            <View style={styles.motionSection}>
              <Text style={styles.sectionTitle}>Motion Simulation</Text>
              
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeButton, useRealSensors && styles.modeButtonActive]}
                  onPress={onToggleRealSensors}
                >
                  <Smartphone size={14} color={useRealSensors ? '#0a0a0a' : '#ffffff'} />
                  <Text style={[styles.modeButtonText, useRealSensors && styles.modeButtonTextActive]}>
                    Real Sensors
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, simulationActive && styles.modeButtonActive]}
                  onPress={onToggleSimulation}
                >
                  <Activity size={14} color={simulationActive ? '#0a0a0a' : '#ffffff'} />
                  <Text style={[styles.modeButtonText, simulationActive && styles.modeButtonTextActive]}>
                    Simulate
                  </Text>
                </TouchableOpacity>
              </View>

              {simulationActive && (
                <View style={styles.patternGrid}>
                  {(Object.keys(PATTERN_PRESETS) as SimulationPattern[]).map((pattern) => (
                    <TouchableOpacity
                      key={pattern}
                      style={[
                        styles.patternChip,
                        simConfig.pattern === pattern && styles.patternChipActive,
                      ]}
                      onPress={() => onSetSimConfig({ ...simConfig, pattern })}
                    >
                      <Text style={[
                        styles.patternChipText,
                        simConfig.pattern === pattern && styles.patternChipTextActive,
                      ]}>
                        {PATTERN_PRESETS[pattern].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.sensorReadout}>
                <View style={styles.sensorColumn}>
                  <Text style={styles.sensorTitle}>Accel</Text>
                  <Text style={styles.sensorValue}>
                    X: {formatValue(accelData.x)} Y: {formatValue(accelData.y)} Z: {formatValue(accelData.z)}
                  </Text>
                </View>
                <View style={styles.sensorColumn}>
                  <Text style={styles.sensorTitle}>Gyro</Text>
                  <Text style={styles.sensorValue}>
                    X: {formatValue(gyroData.x)} Y: {formatValue(gyroData.y)} Z: {formatValue(gyroData.z)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
});

export default ControlToolbar;

interface SiteSettingsModalProps {
  visible: boolean;
  currentUrl: string;
  currentSettings: WebsiteSettings | null;
  globalStealthMode: boolean;
  allSiteSettings: WebsiteSettings[];
  onClose: () => void;
  onSave: (url: string, settings: { useStealthByDefault: boolean; applyToSubdomains: boolean }) => void;
  onDelete: (id: string) => void;
}

export function SiteSettingsModal({
  visible,
  currentUrl,
  currentSettings,
  globalStealthMode,
  allSiteSettings,
  onClose,
  onSave,
  onDelete,
}: SiteSettingsModalProps) {
  const [useStealthByDefault, setUseStealthByDefault] = useState(currentSettings?.useStealthByDefault ?? true);
  const [applyToSubdomains, setApplyToSubdomains] = useState(currentSettings?.applyToSubdomains ?? true);

  useEffect(() => {
    if (currentSettings) {
      setUseStealthByDefault(currentSettings.useStealthByDefault);
      setApplyToSubdomains(currentSettings.applyToSubdomains);
    } else {
      // Default to true for both - stealth and subdomains enabled by default
      setUseStealthByDefault(true);
      setApplyToSubdomains(true);
    }
  }, [currentSettings]);

  const hostname = useMemo(() => getHostnameFromUrl(currentUrl), [currentUrl]);

  const handleSave = () => {
    onSave(currentUrl, { useStealthByDefault, applyToSubdomains });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Site Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body}>
            <View style={modalStyles.currentSite}>
              <Globe size={20} color="#00aaff" />
              <Text style={modalStyles.currentSiteText}>{hostname}</Text>
            </View>

            <View style={modalStyles.settingRow}>
              <View style={modalStyles.settingInfo}>
                <Text style={modalStyles.settingLabel}>Use Stealth Mode by Default</Text>
                <Text style={modalStyles.settingHint}>
                  When enabled, stealth mode will automatically activate when visiting this site
                </Text>
              </View>
              <Switch
                value={useStealthByDefault}
                onValueChange={setUseStealthByDefault}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                thumbColor={useStealthByDefault ? '#ffffff' : '#888888'}
              />
            </View>

            <View style={modalStyles.settingRow}>
              <View style={modalStyles.settingInfo}>
                <Text style={modalStyles.settingLabel}>Apply to All Subdomains</Text>
                <Text style={modalStyles.settingHint}>
                  Settings will apply to *.{hostname} (all subdomains)
                </Text>
              </View>
              <Switch
                value={applyToSubdomains}
                onValueChange={setApplyToSubdomains}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={applyToSubdomains ? '#ffffff' : '#888888'}
              />
            </View>

            <TouchableOpacity style={modalStyles.saveButton} onPress={handleSave}>
              <Check size={18} color="#0a0a0a" />
              <Text style={modalStyles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>

            {allSiteSettings.length > 0 && (
              <View style={modalStyles.savedSites}>
                <Text style={modalStyles.savedSitesTitle}>Saved Site Settings</Text>
                {allSiteSettings.map(site => (
                  <View key={site.id} style={modalStyles.savedSiteItem}>
                    <View style={modalStyles.savedSiteInfo}>
                      <Text style={modalStyles.savedSiteUrl}>{site.baseUrl}</Text>
                      <View style={modalStyles.savedSiteBadges}>
                        {site.useStealthByDefault && (
                          <View style={modalStyles.savedSiteBadge}>
                            <EyeOff size={10} color="#ff6b35" />
                            <Text style={modalStyles.savedSiteBadgeText}>Stealth</Text>
                          </View>
                        )}
                        {site.applyToSubdomains && (
                          <View style={modalStyles.savedSiteBadge}>
                            <Globe size={10} color="#00aaff" />
                            <Text style={modalStyles.savedSiteBadgeText}>Subdomains</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={modalStyles.deleteSiteBtn}
                      onPress={() => onDelete(site.id)}
                    >
                      <Trash2 size={16} color="#ff4757" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface ProtocolSettingsModalProps {
  visible: boolean;
  allowlistEnabled: boolean;
  allowedDomains: string[];
  currentHostname: string;
  onToggleAllowlist: () => void;
  onAddDomain: (domain: string) => void;
  onRemoveDomain: (domain: string) => void;
  onOpenProtectedPreview: () => void;
  onOpenTestHarness: () => void;
  onClose: () => void;
}

export function ProtocolSettingsModal({
  visible,
  allowlistEnabled,
  allowedDomains,
  currentHostname,
  onToggleAllowlist,
  onAddDomain,
  onRemoveDomain,
  onOpenProtectedPreview,
  onOpenTestHarness,
  onClose,
}: ProtocolSettingsModalProps) {
  const [domainInput, setDomainInput] = useState('');
  const [expandedProtocol, setExpandedProtocol] = useState<ProtocolId | null>(null);
  
  const {
    isDeveloperModeEnabled,
    isAllowlistEditable,
    isProtocolEditable,
    toggleDeveloperMode,
    protocolSettings,
    updateStandardSettings,
    updateAllowlistSettings,
    updateProtectedSettings,
    updateHarnessSettings,
    resetProtocolSettings,
  } = useDeveloperMode();

  const currentAllowlisted = useMemo(() => {
    if (!allowlistEnabled || !currentHostname) return false;
    return allowedDomains.some(domain =>
      currentHostname === domain || currentHostname.endsWith(`.${domain}`)
    );
  }, [allowlistEnabled, currentHostname, allowedDomains]);

  const handleAddDomain = () => {
    if (!domainInput.trim()) return;
    if (!isAllowlistEditable) {
      Alert.alert('Locked', 'Enable Developer Mode to edit the allowlist.');
      return;
    }
    onAddDomain(domainInput);
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    if (!isAllowlistEditable) {
      Alert.alert('Locked', 'Enable Developer Mode to edit the allowlist.');
      return;
    }
    onRemoveDomain(domain);
  };

  const handleToggleAllowlist = () => {
    if (!isAllowlistEditable) {
      Alert.alert('Locked', 'Enable Developer Mode to toggle the allowlist.');
      return;
    }
    onToggleAllowlist();
  };

  const toggleProtocolExpanded = (protocolId: ProtocolId) => {
    setExpandedProtocol(prev => prev === protocolId ? null : protocolId);
  };

  const handleResetProtocol = (protocolId: ProtocolId) => {
    Alert.alert(
      'Reset Protocol Settings',
      `Are you sure you want to reset ${PROTOCOL_METADATA[protocolId].name} to default settings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetProtocolSettings(protocolId) },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={protocolStyles.overlay}>
        <View style={protocolStyles.content}>
          <View style={protocolStyles.header}>
            <View style={protocolStyles.headerLeft}>
              <FlaskConical size={20} color="#00ff88" />
              <Text style={protocolStyles.title}>Testing Protocols</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Developer Mode Toggle */}
          <View style={protocolStyles.developerModeBar}>
            <View style={protocolStyles.developerModeInfo}>
              <View style={[
                protocolStyles.developerModeIcon,
                isDeveloperModeEnabled && protocolStyles.developerModeIconActive
              ]}>
                {isDeveloperModeEnabled ? (
                  <Unlock size={16} color="#0a0a0a" />
                ) : (
                  <Lock size={16} color="#ff6b35" />
                )}
              </View>
              <View>
                <Text style={protocolStyles.developerModeLabel}>
                  {isDeveloperModeEnabled ? 'Developer Mode' : 'Parent Mode'}
                </Text>
                <Text style={protocolStyles.developerModeHint}>
                  {isDeveloperModeEnabled 
                    ? 'All settings unlocked for testing' 
                    : 'Settings locked for safety'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDeveloperModeEnabled}
              onValueChange={() => {
                toggleDeveloperMode();
              }}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={isDeveloperModeEnabled ? '#ffffff' : '#888888'}
            />
          </View>

          <ScrollView style={protocolStyles.body} showsVerticalScrollIndicator={false}>
            {/* Protocol 1: Standard Injection */}
            <View style={protocolStyles.section}>
              <TouchableOpacity 
                style={protocolStyles.sectionHeader}
                onPress={() => toggleProtocolExpanded('standard')}
              >
                <View style={protocolStyles.sectionHeaderLeft}>
                  <View style={[protocolStyles.protocolIcon, { backgroundColor: 'rgba(0, 255, 136, 0.15)' }]}>
                    <Code size={16} color="#00ff88" />
                  </View>
                  <View style={protocolStyles.sectionTitleContainer}>
                    <Text style={protocolStyles.sectionTitle}>Protocol 1: Standard Injection</Text>
                    <View style={protocolStyles.protocolBadges}>
                      <View style={[protocolStyles.liveBadge, protocolSettings.standard.enabled && protocolStyles.liveBadgeActive]}>
                        <Text style={protocolStyles.liveBadgeText}>
                          {protocolSettings.standard.enabled ? 'LIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <ChevronRight 
                  size={18} 
                  color="rgba(255,255,255,0.5)"
                  style={{ transform: [{ rotate: expandedProtocol === 'standard' ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              
              <Text style={protocolStyles.sectionText}>
                Uses the current media injection flow inside this app for controlled environments.
              </Text>

              {expandedProtocol === 'standard' && (
                <View style={protocolStyles.settingsPanel}>
                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Enabled</Text>
                    </View>
                    <Switch
                      value={protocolSettings.standard.enabled}
                      onValueChange={(val) => updateStandardSettings({ enabled: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.standard.enabled ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Auto Inject</Text>
                      <Text style={protocolStyles.settingHint}>Automatically inject on page load</Text>
                    </View>
                    <Switch
                      value={protocolSettings.standard.autoInject}
                      onValueChange={(val) => updateStandardSettings({ autoInject: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.standard.autoInject ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Stealth by Default</Text>
                      <Text style={protocolStyles.settingHint}>Hide injection from site scripts</Text>
                    </View>
                    <Switch
                      value={protocolSettings.standard.stealthByDefault}
                      onValueChange={(val) => updateStandardSettings({ stealthByDefault: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
                      thumbColor={protocolSettings.standard.stealthByDefault ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Retry on Fail</Text>
                      <Text style={protocolStyles.settingHint}>Max retries: {protocolSettings.standard.maxRetries}</Text>
                    </View>
                    <Switch
                      value={protocolSettings.standard.retryOnFail}
                      onValueChange={(val) => updateStandardSettings({ retryOnFail: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.standard.retryOnFail ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Logging Level</Text>
                    </View>
                    <View style={protocolStyles.segmentedControl}>
                      {(['none', 'minimal', 'verbose'] as const).map(level => (
                        <TouchableOpacity
                          key={level}
                          style={[
                            protocolStyles.segmentButton,
                            protocolSettings.standard.loggingLevel === level && protocolStyles.segmentButtonActive,
                          ]}
                          onPress={() => isProtocolEditable && updateStandardSettings({ loggingLevel: level })}
                          disabled={!isProtocolEditable}
                        >
                          <Text style={[
                            protocolStyles.segmentButtonText,
                            protocolSettings.standard.loggingLevel === level && protocolStyles.segmentButtonTextActive,
                          ]}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {isProtocolEditable && (
                    <TouchableOpacity 
                      style={protocolStyles.resetButton}
                      onPress={() => handleResetProtocol('standard')}
                    >
                      <RotateCcw size={14} color="#ff4757" />
                      <Text style={protocolStyles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Protocol 2: Allowlist Mode */}
            <View style={protocolStyles.section}>
              <TouchableOpacity 
                style={protocolStyles.sectionHeader}
                onPress={() => toggleProtocolExpanded('allowlist')}
              >
                <View style={protocolStyles.sectionHeaderLeft}>
                  <View style={[protocolStyles.protocolIcon, { backgroundColor: 'rgba(0, 170, 255, 0.15)' }]}>
                    <Shield size={16} color="#00aaff" />
                  </View>
                  <View style={protocolStyles.sectionTitleContainer}>
                    <Text style={protocolStyles.sectionTitle}>Protocol 2: Allowlist Mode</Text>
                    <View style={protocolStyles.protocolBadges}>
                      <View style={[protocolStyles.liveBadge, allowlistEnabled && protocolStyles.liveBadgeActive]}>
                        <Text style={protocolStyles.liveBadgeText}>
                          {allowlistEnabled ? 'ACTIVE' : 'OFF'}
                        </Text>
                      </View>
                      {!isAllowlistEditable && (
                        <View style={protocolStyles.lockedBadge}>
                          <Lock size={10} color="#ff6b35" />
                          <Text style={protocolStyles.lockedBadgeText}>LOCKED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <ChevronRight 
                  size={18} 
                  color="rgba(255,255,255,0.5)"
                  style={{ transform: [{ rotate: expandedProtocol === 'allowlist' ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              <Text style={protocolStyles.sectionText}>
                Limits injection to domains you explicitly allow. {!isAllowlistEditable && 'Enable Developer Mode to edit.'}
              </Text>

              {expandedProtocol === 'allowlist' && (
                <View style={protocolStyles.settingsPanel}>
                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Enable Allowlist</Text>
                      <Text style={protocolStyles.settingHint}>Only inject on approved domains</Text>
                    </View>
                    <Switch
                      value={allowlistEnabled}
                      onValueChange={handleToggleAllowlist}
                      disabled={!isAllowlistEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={allowlistEnabled ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.statusRow}>
                    <Text style={protocolStyles.statusLabel}>Current site:</Text>
                    <Text style={protocolStyles.statusValue}>
                      {currentHostname || 'No site loaded'}
                    </Text>
                    {allowlistEnabled && currentHostname.length > 0 && (
                      <View style={[
                        protocolStyles.statusBadge,
                        currentAllowlisted ? protocolStyles.statusBadgeAllowed : protocolStyles.statusBadgeBlocked,
                      ]}>
                        <Text style={protocolStyles.statusBadgeText}>
                          {currentAllowlisted ? 'Allowed' : 'Blocked'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[
                    protocolStyles.inputRow,
                    !isAllowlistEditable && protocolStyles.inputRowDisabled
                  ]}>
                    <TextInput
                      style={[
                        protocolStyles.domainInput,
                        !isAllowlistEditable && protocolStyles.domainInputDisabled
                      ]}
                      value={domainInput}
                      onChangeText={setDomainInput}
                      placeholder={isAllowlistEditable ? "Add domain (example.com)" : "Unlock to edit"}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={isAllowlistEditable}
                    />
                    <TouchableOpacity 
                      style={[
                        protocolStyles.addButton,
                        !isAllowlistEditable && protocolStyles.addButtonDisabled
                      ]} 
                      onPress={handleAddDomain}
                      disabled={!isAllowlistEditable}
                    >
                      <Text style={protocolStyles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {allowedDomains.length === 0 ? (
                    <Text style={protocolStyles.emptyText}>No domains added yet.</Text>
                  ) : (
                    <View style={protocolStyles.domainList}>
                      {allowedDomains.map(domain => (
                        <View key={domain} style={protocolStyles.domainItem}>
                          <Text style={protocolStyles.domainText}>{domain}</Text>
                          <TouchableOpacity 
                            onPress={() => handleRemoveDomain(domain)}
                            disabled={!isAllowlistEditable}
                          >
                            <Trash2 size={16} color={isAllowlistEditable ? "#ff4757" : "rgba(255,255,255,0.3)"} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Show Blocked Notification</Text>
                    </View>
                    <Switch
                      value={protocolSettings.allowlist.showBlockedNotification}
                      onValueChange={(val) => updateAllowlistSettings({ showBlockedNotification: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.allowlist.showBlockedNotification ? '#ffffff' : '#888888'}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Protocol 3: Protected Preview */}
            <View style={protocolStyles.section}>
              <TouchableOpacity 
                style={protocolStyles.sectionHeader}
                onPress={() => toggleProtocolExpanded('protected')}
              >
                <View style={protocolStyles.sectionHeaderLeft}>
                  <View style={[protocolStyles.protocolIcon, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
                    <Eye size={16} color="#ff6b35" />
                  </View>
                  <View style={protocolStyles.sectionTitleContainer}>
                    <Text style={protocolStyles.sectionTitle}>Protocol 3: Protected Preview</Text>
                    <View style={protocolStyles.protocolBadges}>
                      <View style={[protocolStyles.liveBadge, protocolSettings.protected.enabled && protocolStyles.liveBadgeActive]}>
                        <Text style={protocolStyles.liveBadgeText}>
                          {protocolSettings.protected.enabled ? 'LIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <ChevronRight 
                  size={18} 
                  color="rgba(255,255,255,0.5)"
                  style={{ transform: [{ rotate: expandedProtocol === 'protected' ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              
              <Text style={protocolStyles.sectionText}>
                A consent-based local preview that swaps to a safe video on body detection.
              </Text>

              {expandedProtocol === 'protected' && (
                <View style={protocolStyles.settingsPanel}>
                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Enabled</Text>
                    </View>
                    <Switch
                      value={protocolSettings.protected.enabled}
                      onValueChange={(val) => updateProtectedSettings({ enabled: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.protected.enabled ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Detection Sensitivity</Text>
                    </View>
                    <View style={protocolStyles.segmentedControl}>
                      {(['low', 'medium', 'high'] as const).map(level => (
                        <TouchableOpacity
                          key={level}
                          style={[
                            protocolStyles.segmentButton,
                            protocolSettings.protected.bodyDetectionSensitivity === level && protocolStyles.segmentButtonActive,
                          ]}
                          onPress={() => isProtocolEditable && updateProtectedSettings({ bodyDetectionSensitivity: level })}
                          disabled={!isProtocolEditable}
                        >
                          <Text style={[
                            protocolStyles.segmentButtonText,
                            protocolSettings.protected.bodyDetectionSensitivity === level && protocolStyles.segmentButtonTextActive,
                          ]}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Show Overlay Label</Text>
                      <Text style={protocolStyles.settingHint}>Display &quot;Protected&quot; indicator</Text>
                    </View>
                    <Switch
                      value={protocolSettings.protected.showOverlayLabel}
                      onValueChange={(val) => updateProtectedSettings({ showOverlayLabel: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.protected.showOverlayLabel ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Auto Start Camera</Text>
                    </View>
                    <Switch
                      value={protocolSettings.protected.autoStartCamera}
                      onValueChange={(val) => updateProtectedSettings({ autoStartCamera: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.protected.autoStartCamera ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <TouchableOpacity style={protocolStyles.actionButton} onPress={onOpenProtectedPreview}>
                    <Monitor size={14} color="#00aaff" />
                    <Text style={protocolStyles.actionButtonText}>Open Protected Preview</Text>
                  </TouchableOpacity>

                  {isProtocolEditable && (
                    <TouchableOpacity 
                      style={protocolStyles.resetButton}
                      onPress={() => handleResetProtocol('protected')}
                    >
                      <RotateCcw size={14} color="#ff4757" />
                      <Text style={protocolStyles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Protocol 4: Test Harness */}
            <View style={protocolStyles.section}>
              <TouchableOpacity 
                style={protocolStyles.sectionHeader}
                onPress={() => toggleProtocolExpanded('harness')}
              >
                <View style={protocolStyles.sectionHeaderLeft}>
                  <View style={[protocolStyles.protocolIcon, { backgroundColor: 'rgba(138, 43, 226, 0.15)' }]}>
                    <FlaskConical size={16} color="#8a2be2" />
                  </View>
                  <View style={protocolStyles.sectionTitleContainer}>
                    <Text style={protocolStyles.sectionTitle}>Protocol 4: Test Harness</Text>
                    <View style={protocolStyles.protocolBadges}>
                      <View style={[protocolStyles.liveBadge, protocolSettings.harness.enabled && protocolStyles.liveBadgeActive]}>
                        <Text style={protocolStyles.liveBadgeText}>
                          {protocolSettings.harness.enabled ? 'LIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <ChevronRight 
                  size={18} 
                  color="rgba(255,255,255,0.5)"
                  style={{ transform: [{ rotate: expandedProtocol === 'harness' ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              
              <Text style={protocolStyles.sectionText}>
                A local sandbox for safe overlay testing without touching third-party sites.
              </Text>

              {expandedProtocol === 'harness' && (
                <View style={protocolStyles.settingsPanel}>
                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Enabled</Text>
                    </View>
                    <Switch
                      value={protocolSettings.harness.enabled}
                      onValueChange={(val) => updateHarnessSettings({ enabled: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.harness.enabled ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Auto Request Camera</Text>
                      <Text style={protocolStyles.settingHint}>Request permissions automatically</Text>
                    </View>
                    <Switch
                      value={protocolSettings.harness.autoRequestCamera}
                      onValueChange={(val) => updateHarnessSettings({ autoRequestCamera: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.harness.autoRequestCamera ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Show Debug Overlay</Text>
                      <Text style={protocolStyles.settingHint}>Display FPS and timing info</Text>
                    </View>
                    <Switch
                      value={protocolSettings.harness.showDebugOverlay}
                      onValueChange={(val) => updateHarnessSettings({ showDebugOverlay: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.harness.showDebugOverlay ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Enable Console Logging</Text>
                    </View>
                    <Switch
                      value={protocolSettings.harness.enableConsoleLogging}
                      onValueChange={(val) => updateHarnessSettings({ enableConsoleLogging: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.harness.enableConsoleLogging ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <View style={protocolStyles.settingRow}>
                    <View style={protocolStyles.settingInfo}>
                      <Text style={protocolStyles.settingLabel}>Benchmark Mode</Text>
                      <Text style={protocolStyles.settingHint}>Record performance metrics</Text>
                    </View>
                    <Switch
                      value={protocolSettings.harness.recordTestResults}
                      onValueChange={(val) => updateHarnessSettings({ recordTestResults: val })}
                      disabled={!isProtocolEditable}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                      thumbColor={protocolSettings.harness.recordTestResults ? '#ffffff' : '#888888'}
                    />
                  </View>

                  <TouchableOpacity style={protocolStyles.actionButton} onPress={onOpenTestHarness}>
                    <FlaskConical size={14} color="#00aaff" />
                    <Text style={protocolStyles.actionButtonText}>Open Test Harness</Text>
                  </TouchableOpacity>

                  {isProtocolEditable && (
                    <TouchableOpacity 
                      style={protocolStyles.resetButton}
                      onPress={() => handleResetProtocol('harness')}
                    >
                      <RotateCcw size={14} color="#ff4757" />
                      <Text style={protocolStyles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Info Footer */}
            <View style={protocolStyles.infoFooter}>
              <Info size={14} color="rgba(255,255,255,0.4)" />
              <Text style={protocolStyles.infoFooterText}>
                All protocols use HTTPS enforcement. ML-based protection ensures the app cannot be used with malicious intent.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#151515',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 255, 136, 0.3)',
  },
  collapseBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
  },
  simIndicatorText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#ff4444',
    letterSpacing: 0.5,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeActive: {
    backgroundColor: '#ff6b35',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#00ff88',
  },
  simCountBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  simCountText: {
    color: '#ff6b35',
  },
  collapseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    maxWidth: 120,
  },
  expandedContent: {
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  expandedContentScroll: {
    paddingBottom: 16,
  },
  statusDashboard: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dashboardGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  dashboardCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dashboardCardActive: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  dashboardCardStealth: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardIconActive: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardIconStealth: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  cardValueActive: {
    color: '#0a0a0a',
  },
  cardValueStealth: {
    color: '#0a0a0a',
  },
  cardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  cardLabelActive: {
    color: 'rgba(0,0,0,0.6)',
  },
  cardLabelStealth: {
    color: 'rgba(0,0,0,0.6)',
  },
  siteSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 170, 255, 0.2)',
  },
  siteSettingsInfo: {
    flex: 1,
  },
  siteSettingsLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  siteSettingsUrl: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  siteSettingsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  settingsButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  actionButtonTextActive: {
    color: '#0a0a0a',
  },
  videoSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  videoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  videoSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  videoSectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoSectionLinkText: {
    fontSize: 11,
    color: '#00aaff',
    fontWeight: '600' as const,
  },
  allowlistStatusText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 8,
  },
  dropdownGroup: {
    marginBottom: 10,
  },
  dropdownLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
  },
  dropdownButtonTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  dropdownList: {
    marginTop: 6,
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
  },
  dropdownItemTextSelected: {
    color: '#00ff88',
  },
  dropdownEmptyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    marginTop: 4,
  },
  motionSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeButtonActive: {
    backgroundColor: '#00ff88',
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  modeButtonTextActive: {
    color: '#0a0a0a',
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  patternChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  patternChipActive: {
    backgroundColor: '#ff6b35',
  },
  patternChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  patternChipTextActive: {
    color: '#ffffff',
  },
  sensorReadout: {
    flexDirection: 'row',
    gap: 12,
  },
  sensorColumn: {
    flex: 1,
  },
  sensorTitle: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 10,
    color: '#00ff88',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  body: {
    padding: 16,
  },
  currentSite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  currentSiteText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  settingHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0a0a0a',
  },
  savedSites: {
    marginTop: 24,
  },
  savedSitesTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  savedSiteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  savedSiteInfo: {
    flex: 1,
  },
  savedSiteUrl: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  savedSiteBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  savedSiteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  savedSiteBadgeText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
  },
  deleteSiteBtn: {
    padding: 8,
  },
});

