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
import { ChevronLeft, Shield, Film, FlaskConical, AlertTriangle } from 'lucide-react-native';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useProtocol } from '@/contexts/ProtocolContext';

export default function ProtectedPreviewScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const { 
    protectedSettings, 
    updateProtectedSettings,
    developerModeEnabled,
    presentationMode,
    mlSafetyEnabled,
  } = useProtocol();

  const simulateBodyDetected = protectedSettings.bodyDetectionEnabled;

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
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Shield size={18} color="#00ff88" />
            <Text style={styles.previewTitle}>Live Preview</Text>
          </View>
          <Text style={styles.previewSubtitle}>
            Simulates body detection and swaps to a safe looping video.
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
                <View style={styles.overlayLabel}>
                  <Text style={styles.overlayLabelText}>Protected Replacement Active</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Body Detection Active</Text>
            <Switch
              value={simulateBodyDetected}
              onValueChange={(v) => updateProtectedSettings({ bodyDetectionEnabled: v })}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={simulateBodyDetected ? '#ffffff' : '#888888'}
              disabled={!developerModeEnabled}
            />
          </View>
          
          <View style={styles.sensitivityRow}>
            <Text style={styles.toggleLabel}>Sensitivity</Text>
            <View style={styles.sensitivityButtons}>
              {(['low', 'medium', 'high'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.sensitivityBtn,
                    protectedSettings.sensitivityLevel === level && styles.sensitivityBtnActive,
                  ]}
                  onPress={() => developerModeEnabled && updateProtectedSettings({ sensitivityLevel: level })}
                  disabled={!developerModeEnabled}
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
          
          <Text style={styles.toggleHint}>
            {developerModeEnabled 
              ? 'Settings are editable in developer mode. ML-based body detection will trigger replacement.'
              : 'Enable developer mode in Protocols to modify settings.'}
          </Text>
        </View>
        
        {presentationMode && (
          <View style={styles.protocolBadge}>
            <FlaskConical size={14} color="#ffcc00" />
            <Text style={styles.protocolBadgeText}>Protocol 3: Protected Preview</Text>
            {mlSafetyEnabled && (
              <View style={styles.mlBadge}>
                <Shield size={10} color="#00aaff" />
                <Text style={styles.mlBadgeText}>ML SAFE</Text>
              </View>
            )}
          </View>
        )}

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
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
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
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  sensitivityBtnTextActive: {
    color: '#ffffff',
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.3)',
  },
  protocolBadgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffcc00',
  },
  mlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mlBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#00aaff',
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
});
