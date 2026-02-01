import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Camera,
  Video,
  Shield,
  X,
  ChevronDown,
  Check,
  Ban,
  Play,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import type { SavedVideo } from '@/utils/videoManager';
import type { ProtocolType } from '@/contexts/ProtocolContext';

export type PermissionChoice = 'simulate' | 'allow' | 'deny';

export interface CameraPermissionPromptResult {
  choice: PermissionChoice;
  protocolId?: ProtocolType;
  videoId?: string;
  videoUri?: string;
  videoName?: string;
}

interface CameraPermissionPromptModalProps {
  visible: boolean;
  requestingUrl: string;
  compatibleVideos: SavedVideo[];
  protocols: { id: ProtocolType; name: string; enabled: boolean }[];
  activeProtocol: ProtocolType;
  defaultVideoId?: string;
  onResponse: (result: CameraPermissionPromptResult) => void;
  onClose: () => void;
}

export default function CameraPermissionPromptModal({
  visible,
  requestingUrl,
  compatibleVideos,
  protocols,
  activeProtocol,
  defaultVideoId,
  onResponse,
  onClose,
}: CameraPermissionPromptModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>(activeProtocol);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(defaultVideoId || null);
  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
  const [showVideoDropdown, setShowVideoDropdown] = useState(false);

  const hostname = useMemo(() => {
    try {
      return new URL(requestingUrl).hostname;
    } catch {
      return requestingUrl;
    }
  }, [requestingUrl]);

  const enabledProtocols = useMemo(() => {
    return protocols.filter(p => p.enabled);
  }, [protocols]);

  const selectedProtocolName = useMemo(() => {
    return protocols.find(p => p.id === selectedProtocol)?.name || 'Standard Injection';
  }, [protocols, selectedProtocol]);

  const selectedVideo = useMemo(() => {
    if (!selectedVideoId) return compatibleVideos[0] || null;
    return compatibleVideos.find(v => v.id === selectedVideoId) || compatibleVideos[0] || null;
  }, [selectedVideoId, compatibleVideos]);

  const hasVideos = compatibleVideos.length > 0;

  const handleSimulate = useCallback(() => {
    if (!selectedVideo) return;
    
    onResponse({
      choice: 'simulate',
      protocolId: selectedProtocol,
      videoId: selectedVideo.id,
      videoUri: selectedVideo.uri,
      videoName: selectedVideo.name,
    });
    onClose();
  }, [selectedProtocol, selectedVideo, onResponse, onClose]);

  const handleAllow = useCallback(() => {
    onResponse({
      choice: 'allow',
    });
    onClose();
  }, [onResponse, onClose]);

  const handleDeny = useCallback(() => {
    onResponse({
      choice: 'deny',
    });
    onClose();
  }, [onResponse, onClose]);

  const toggleProtocolDropdown = useCallback(() => {
    setShowProtocolDropdown(prev => !prev);
    setShowVideoDropdown(false);
  }, []);

  const toggleVideoDropdown = useCallback(() => {
    setShowVideoDropdown(prev => !prev);
    setShowProtocolDropdown(false);
  }, []);

  const handleSelectProtocol = useCallback((protocolId: ProtocolType) => {
    setSelectedProtocol(protocolId);
    setShowProtocolDropdown(false);
  }, []);

  const handleSelectVideo = useCallback((videoId: string) => {
    setSelectedVideoId(videoId);
    setShowVideoDropdown(false);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Camera size={24} color="#00ff88" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Camera Permission Request</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {hostname}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Request Info */}
          <View style={styles.requestInfo}>
            <Shield size={16} color="#ff6b35" />
            <Text style={styles.requestInfoText}>
              This site is requesting access to your camera
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Simulate Option */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Video size={18} color="#00ff88" />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Simulate Video</Text>
                  <Text style={styles.sectionSubtitle}>
                    Replace camera feed with a video
                  </Text>
                </View>
              </View>

              {/* Protocol Dropdown */}
              <View style={styles.dropdownGroup}>
                <Text style={styles.dropdownLabel}>Protocol</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={toggleProtocolDropdown}
                >
                  <Text style={styles.dropdownButtonText} numberOfLines={1}>
                    {selectedProtocolName}
                  </Text>
                  <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
                
                {showProtocolDropdown && (
                  <View style={styles.dropdownList}>
                    {enabledProtocols.map(protocol => (
                      <TouchableOpacity
                        key={protocol.id}
                        style={[
                          styles.dropdownItem,
                          protocol.id === selectedProtocol && styles.dropdownItemSelected,
                        ]}
                        onPress={() => handleSelectProtocol(protocol.id)}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            protocol.id === selectedProtocol && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {protocol.name}
                        </Text>
                        {protocol.id === selectedProtocol && (
                          <Check size={14} color="#00ff88" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Video Dropdown */}
              <View style={styles.dropdownGroup}>
                <Text style={styles.dropdownLabel}>Video to inject</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    !hasVideos && styles.dropdownButtonDisabled,
                  ]}
                  onPress={toggleVideoDropdown}
                  disabled={!hasVideos}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      !hasVideos && styles.dropdownButtonTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {hasVideos
                      ? selectedVideo?.name || 'Select video'
                      : 'No compatible videos'}
                  </Text>
                  <ChevronDown
                    size={16}
                    color={hasVideos ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}
                  />
                </TouchableOpacity>

                {showVideoDropdown && hasVideos && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {compatibleVideos.map(video => (
                        <TouchableOpacity
                          key={video.id}
                          style={[
                            styles.dropdownItem,
                            video.id === selectedVideo?.id && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectVideo(video.id)}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              video.id === selectedVideo?.id && styles.dropdownItemTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {video.name}
                          </Text>
                          {video.id === selectedVideo?.id && (
                            <Check size={14} color="#00ff88" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Simulate Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !hasVideos && styles.primaryButtonDisabled,
                ]}
                onPress={handleSimulate}
                disabled={!hasVideos}
              >
                <Play size={18} color={hasVideos ? '#0a0a0a' : 'rgba(255,255,255,0.4)'} />
                <Text
                  style={[
                    styles.primaryButtonText,
                    !hasVideos && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Simulate Video
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Allow Option */}
            <TouchableOpacity
              style={styles.secondaryOption}
              onPress={handleAllow}
            >
              <View style={styles.secondaryOptionIcon}>
                <Eye size={18} color="#00aaff" />
              </View>
              <View style={styles.secondaryOptionText}>
                <Text style={styles.secondaryOptionTitle}>Allow Camera Access</Text>
                <Text style={styles.secondaryOptionSubtitle}>
                  Use real camera without simulation
                </Text>
              </View>
              <ChevronDown
                size={18}
                color="rgba(255,255,255,0.4)"
                style={{ transform: [{ rotate: '-90deg' }] }}
              />
            </TouchableOpacity>

            {/* Deny Option */}
            <TouchableOpacity
              style={[styles.secondaryOption, styles.denyOption]}
              onPress={handleDeny}
            >
              <View style={[styles.secondaryOptionIcon, styles.denyOptionIcon]}>
                <Ban size={18} color="#ff4757" />
              </View>
              <View style={styles.secondaryOptionText}>
                <Text style={styles.secondaryOptionTitle}>Deny Request</Text>
                <Text style={styles.secondaryOptionSubtitle}>
                  Block camera access for this site
                </Text>
              </View>
              <ChevronDown
                size={18}
                color="rgba(255,255,255,0.4)"
                style={{ transform: [{ rotate: '-90deg' }] }}
              />
            </TouchableOpacity>

            {/* Info Footer */}
            <View style={styles.infoFooter}>
              <EyeOff size={14} color="rgba(255,255,255,0.4)" />
              <Text style={styles.infoFooterText}>
                Your choice applies only to this permission request. You can change settings in the Protocols menu.
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  requestInfoText: {
    fontSize: 12,
    color: '#ff6b35',
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  dropdownGroup: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonText: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  dropdownButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  dropdownList: {
    marginTop: 6,
    backgroundColor: '#111111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 150,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#00ff88',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00ff88',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0a0a0a',
  },
  primaryButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 12,
  },
  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  denyOption: {
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  secondaryOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  denyOptionIcon: {
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
  },
  secondaryOptionText: {
    flex: 1,
  },
  secondaryOptionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  secondaryOptionSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
  },
  infoFooterText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    lineHeight: 16,
  },
});
