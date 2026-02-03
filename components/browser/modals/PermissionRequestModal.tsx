import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { 
  Camera, 
  Video as VideoIcon, 
  Shield, 
  AlertTriangle, 
  Check, 
  X,
  Zap,
  EyeOff,
  Monitor,
  Wifi,
  Globe
} from 'lucide-react-native';
import type { ProtocolType } from '@/contexts/ProtocolContext';
import type { SavedVideo } from '@/utils/videoManager';

interface PermissionRequestModalProps {
  visible: boolean;
  hostname: string;
  requestId: string;
  protocols: Record<string, any>; // Using any to avoid complex type imports for now
  selectedVideo: SavedVideo | null;
  onAction: (requestId: string, action: 'simulate' | 'allow' | 'deny', config?: any) => void;
  onSelectVideo: () => void;
}

export default function PermissionRequestModal({
  visible,
  hostname,
  requestId,
  protocols,
  selectedVideo,
  onAction,
  onSelectVideo,
}: PermissionRequestModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('standard');
  const [useSimulation, setUseSimulation] = useState(true);

  const protocolIcons: Record<ProtocolType, React.ReactNode> = {
    standard: <Zap size={18} color="#00ff88" />,
    allowlist: <Shield size={18} color="#00aaff" />,
    protected: <EyeOff size={18} color="#ff6b35" />,
    harness: <Monitor size={18} color="#b388ff" />,
    holographic: <VideoIcon size={18} color="#ff00ff" />,
    websocket: <Globe size={18} color="#00aaff" />,
    'webrtc-loopback': <Wifi size={18} color="#00aaff" />,
  };

  const handleSimulate = () => {
    onAction(requestId, 'simulate', {
      protocolId: selectedProtocol,
      videoUri: selectedVideo?.uri,
      videoName: selectedVideo?.name,
    });
  };

  const handleAllow = () => {
    onAction(requestId, 'allow');
  };

  const handleDeny = () => {
    onAction(requestId, 'deny');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDeny}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Camera size={20} color="#00ff88" />
              <Text style={styles.title}>Camera Request</Text>
            </View>
            <TouchableOpacity onPress={handleDeny}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.requestText}>
              <Text style={styles.hostname}>{hostname}</Text> is requesting camera access.
            </Text>

            <View style={styles.optionsContainer}>
              <Text style={styles.sectionTitle}>Action</Text>
              
              <TouchableOpacity 
                style={[styles.optionButton, useSimulation && styles.optionButtonActive]}
                onPress={() => setUseSimulation(true)}
              >
                <View style={styles.optionContent}>
                  <VideoIcon size={20} color={useSimulation ? "#00ff88" : "#ffffff"} />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, useSimulation && styles.optionTitleActive]}>
                      Simulate Video
                    </Text>
                    <Text style={styles.optionDesc}>Inject fake camera stream</Text>
                  </View>
                </View>
                {useSimulation && <Check size={18} color="#00ff88" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionButton, !useSimulation && styles.optionButtonActive]}
                onPress={() => setUseSimulation(false)}
              >
                <View style={styles.optionContent}>
                  <Camera size={20} color={!useSimulation ? "#00ff88" : "#ffffff"} />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, !useSimulation && styles.optionTitleActive]}>
                      Don&apos;t Simulate
                    </Text>
                    <Text style={styles.optionDesc}>Use real camera</Text>
                  </View>
                </View>
                {!useSimulation && <Check size={18} color="#00ff88" />}
              </TouchableOpacity>
            </View>

            {useSimulation && (
              <>
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>Protocol</Text>
                  <View style={styles.protocolsList}>
                    {(Object.keys(protocols) as ProtocolType[]).map((protocolId) => (
                      <TouchableOpacity
                        key={protocolId}
                        style={[
                          styles.protocolItem,
                          selectedProtocol === protocolId && styles.protocolItemActive
                        ]}
                        onPress={() => setSelectedProtocol(protocolId)}
                      >
                        {protocolIcons[protocolId]}
                        <Text style={[
                          styles.protocolName,
                          selectedProtocol === protocolId && styles.protocolNameActive
                        ]}>
                          {protocols[protocolId].name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>Video Source</Text>
                  <TouchableOpacity style={styles.videoSelector} onPress={onSelectVideo}>
                    <View style={styles.videoSelectorLeft}>
                      <VideoIcon size={20} color="#00aaff" />
                      <View>
                        <Text style={styles.videoName}>
                          {selectedVideo ? selectedVideo.name : 'Select Video...'}
                        </Text>
                        {selectedVideo && (
                          <Text style={styles.videoUri} numberOfLines={1}>
                            {selectedVideo.uri}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.warningBox}>
              <AlertTriangle size={16} color="#ffcc00" />
              <Text style={styles.warningText}>
                {useSimulation 
                  ? "The website will receive the simulated video stream instead of your camera."
                  : "The website will access your real camera directly."}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.denyButton} onPress={handleDeny}>
              <Text style={styles.denyButtonText}>Deny Request</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.confirmButton} 
              onPress={useSimulation ? handleSimulate : handleAllow}
            >
              <Text style={styles.confirmButtonText}>
                {useSimulation ? 'Start Simulation' : 'Allow Access'}
              </Text>
            </TouchableOpacity>
          </View>
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
  requestText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 24,
    lineHeight: 24,
  },
  hostname: {
    fontWeight: '700',
    color: '#00ff88',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTextContainer: {
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionTitleActive: {
    color: '#00ff88',
  },
  optionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  configSection: {
    marginBottom: 24,
  },
  protocolsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  protocolItemActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: '#00ff88',
  },
  protocolName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  protocolNameActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  videoSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 170, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 170, 255, 0.2)',
  },
  videoSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  videoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  videoUri: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    maxWidth: 200,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00aaff',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#ffcc00',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    gap: 12,
  },
  denyButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#ff4757',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 16,
  },
});
