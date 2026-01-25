import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { ChevronLeft, Shield, Film, Settings, Lock } from 'lucide-react-native';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import TestingWatermark from '@/components/TestingWatermark';

export default function ProtectedPreviewScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [simulateBodyDetected, setSimulateBodyDetected] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const { 
    developerMode, 
    protocolSettings, 
    isProtocolEditable,
    updateProtectedSettings 
  } = useDeveloperMode();

  const protectedSettings = protocolSettings.protected;

  const compatibleVideos = useMemo(() => {
    return savedVideos.filter(video => {
      const status = video.compatibility?.overallStatus;
      const isFullyCompatible = status === 'perfect' || status === 'compatible';
      return isFullyCompatible && isVideoReady(video.id);
    });
  }, [savedVideos, isVideoReady]);

  useEffect(() => {
    if (!selectedVideoId && compatibleVideos.length > 0) {
      setSelectedVideoId(compatibleVideos[0].id);
    }
  }, [selectedVideoId, compatibleVideos]);

  const selectedVideo = compatibleVideos.find(video => video.id === selectedVideoId) || null;
  const showCamera = permission?.granted && Platform.OS !== 'web';

  return (
    <View style={styles.container}>
      <TestingWatermark 
        visible={developerMode.showWatermark}
        position="top-right"
        variant="minimal"
      />
      
      <Stack.Screen
        options={{
          title: 'Protected Preview',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color="#00ff88" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Protocol Status Banner */}
        <View style={styles.protocolBanner}>
          <View style={styles.protocolBannerLeft}>
            <View style={[styles.protocolIcon, protectedSettings.enabled && styles.protocolIconActive]}>
              <Shield size={16} color={protectedSettings.enabled ? '#0a0a0a' : '#ff6b35'} />
            </View>
            <View>
              <Text style={styles.protocolBannerTitle}>Protocol 3: Protected Preview</Text>
              <Text style={styles.protocolBannerStatus}>
                {protectedSettings.enabled ? 'LIVE - Ready for Testing' : 'Disabled'}
              </Text>
            </View>
          </View>
          {!isProtocolEditable && (
            <View style={styles.lockedIndicator}>
              <Lock size={12} color="#ff6b35" />
            </View>
          )}
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Shield size={18} color="#00ff88" />
            <Text style={styles.previewTitle}>Live Preview</Text>
          </View>
          <Text style={styles.previewSubtitle}>
            Simulates body detection and swaps to a safe looping video.
            {'\n'}Sensitivity: {protectedSettings.bodyDetectionSensitivity.toUpperCase()}
          </Text>

          <View style={styles.previewWindow}>
            {showCamera ? (
              <CameraView style={styles.camera} facing="front" />
            ) : (
              <View style={styles.cameraFallback}>
                <Text style={styles.cameraFallbackText}>
                  {Platform.OS === 'web'
                    ? 'Camera preview not available on web.'
                    : 'Camera permission is required to preview.'}
                </Text>
                {!permission?.granted && (
                  <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {simulateBodyDetected && (
              <View style={styles.overlay}>
                {selectedVideo ? (
                  <Video
                    source={{ uri: selectedVideo.uri }}
                    style={styles.overlayVideo}
                    shouldPlay
                    isLooping
                    resizeMode={ResizeMode.COVER}
                  />
                ) : (
                  <View style={styles.overlayFallback}>
                    <Film size={24} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.overlayFallbackText}>
                      Select a compatible video to enable replacement.
                    </Text>
                  </View>
                )}
                {protectedSettings.showOverlayLabel && (
                  <View style={styles.overlayLabel}>
                    <Text style={styles.overlayLabelText}>Protected Replacement Active</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Simulate body detected</Text>
            <Switch
              value={simulateBodyDetected}
              onValueChange={setSimulateBodyDetected}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={simulateBodyDetected ? '#ffffff' : '#888888'}
            />
          </View>
          <Text style={styles.toggleHint}>
            Placeholder logic only. Toggle this to simulate body detection until your model is ready.
          </Text>
        </View>

        {/* Settings Card */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Settings size={16} color="#00aaff" />
            <Text style={styles.settingsTitle}>Protocol Settings</Text>
            {!isProtocolEditable && (
              <View style={styles.settingsLocked}>
                <Lock size={10} color="#ff6b35" />
                <Text style={styles.settingsLockedText}>Developer Mode Required</Text>
              </View>
            )}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Overlay Label</Text>
              <Text style={styles.settingHint}>Display "Protected" indicator</Text>
            </View>
            <Switch
              value={protectedSettings.showOverlayLabel}
              onValueChange={(val) => isProtocolEditable && updateProtectedSettings({ showOverlayLabel: val })}
              disabled={!isProtocolEditable}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={protectedSettings.showOverlayLabel ? '#ffffff' : '#888888'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Detection Sensitivity</Text>
            </View>
            <View style={styles.segmentedControl}>
              {(['low', 'medium', 'high'] as const).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.segmentButton,
                    protectedSettings.bodyDetectionSensitivity === level && styles.segmentButtonActive,
                  ]}
                  onPress={() => isProtocolEditable && updateProtectedSettings({ bodyDetectionSensitivity: level })}
                  disabled={!isProtocolEditable}
                >
                  <Text style={[
                    styles.segmentButtonText,
                    protectedSettings.bodyDetectionSensitivity === level && styles.segmentButtonTextActive,
                  ]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Fallback to Placeholder</Text>
              <Text style={styles.settingHint}>Use placeholder if no video selected</Text>
            </View>
            <Switch
              value={protectedSettings.fallbackToPlaceholder}
              onValueChange={(val) => isProtocolEditable && updateProtectedSettings({ fallbackToPlaceholder: val })}
              disabled={!isProtocolEditable}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={protectedSettings.fallbackToPlaceholder ? '#ffffff' : '#888888'}
            />
          </View>
        </View>

        <View style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Replacement Video</Text>
          {compatibleVideos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No compatible videos available. Import and check videos in My Videos.
              </Text>
              <TouchableOpacity style={styles.openLibraryButton} onPress={() => router.push('/my-videos')}>
                <Text style={styles.openLibraryButtonText}>Open My Videos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.videoList}>
              {compatibleVideos.map(video => {
                const isSelected = video.id === selectedVideoId;
                return (
                  <TouchableOpacity
                    key={video.id}
                    style={[styles.videoOption, isSelected && styles.videoOptionSelected]}
                    onPress={() => setSelectedVideoId(video.id)}
                  >
                    <Text
                      style={[styles.videoOptionText, isSelected && styles.videoOptionTextSelected]}
                      numberOfLines={1}
                    >
                      {video.name}
                    </Text>
                    {isSelected && <Text style={styles.videoOptionBadge}>Selected</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    padding: 16,
  },
  protocolBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  protocolBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  protocolIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolIconActive: {
    backgroundColor: '#00ff88',
  },
  protocolBannerTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  protocolBannerStatus: {
    fontSize: 10,
    color: '#00ff88',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  lockedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  previewSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  previewWindow: {
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111111',
    marginBottom: 12,
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cameraFallbackText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
  },
  permissionButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#00ff88',
  },
  permissionButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#0a0a0a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayFallback: {
    alignItems: 'center',
    gap: 8,
  },
  overlayFallbackText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center' as const,
  },
  overlayLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  overlayLabelText: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600' as const,
  },
  toggleHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },
  selectorCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: 10,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
  },
  openLibraryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,170,255,0.15)',
  },
  openLibraryButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#00aaff',
  },
  videoList: {
    gap: 8,
  },
  videoOption: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  videoOptionSelected: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  videoOptionText: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  videoOptionTextSelected: {
    color: '#00ff88',
  },
  videoOptionBadge: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    flex: 1,
  },
  settingsLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  settingsLockedText: {
    fontSize: 10,
    color: '#ff6b35',
    fontWeight: '500' as const,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#ffffff',
  },
  settingHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: 2,
  },
  segmentButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  segmentButtonActive: {
    backgroundColor: '#00ff88',
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  segmentButtonTextActive: {
    color: '#0a0a0a',
    fontWeight: '600' as const,
  },
});
