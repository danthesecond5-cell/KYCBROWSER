import { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { ChevronLeft, Shield, Film, FlaskConical, Settings, Lock, Play, CheckCircle } from 'lucide-react-native';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useProtocol } from '@/contexts/ProtocolContext';
import { BUILT_IN_TEST_VIDEO, BUILT_IN_TEST_PATTERNS } from '@/constants/builtInTestVideo';
import TestingWatermark from '@/components/TestingWatermark';

// Built-in animated fallback pattern component
const AnimatedFallbackPattern = ({ isActive }: { isActive: boolean }) => {
  const animation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const frameCount = useRef(0);
  const [displayFrame, setDisplayFrame] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    // Continuous rotation animation
    const rotateAnim = Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Pulse animation
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    rotateAnim.start();
    pulseAnim.start();

    // Frame counter update
    const interval = setInterval(() => {
      frameCount.current += 1;
      setDisplayFrame(frameCount.current % 10000);
    }, 33); // ~30fps

    return () => {
      rotateAnim.stop();
      pulseAnim.stop();
      clearInterval(interval);
    };
  }, [isActive, animation, pulseAnimation]);

  const rotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isActive) return null;

  return (
    <View style={fallbackStyles.container}>
      {/* Animated gradient background simulation with circles */}
      <View style={fallbackStyles.background}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={i}
            style={[
              fallbackStyles.circle,
              {
                top: 100 + i * 120,
                transform: [
                  { rotate },
                  { translateX: 80 + i * 20 },
                ],
                backgroundColor: `hsla(${(i * 60 + displayFrame) % 360}, 60%, 50%, 0.7)`,
              },
            ]}
          />
        ))}
      </View>

      {/* Center pulsing play icon */}
      <Animated.View style={[fallbackStyles.centerIcon, { transform: [{ scale: pulseAnimation }] }]}>
        <Play size={50} color="#ffffff" fill="#ffffff" />
      </Animated.View>

      {/* Status bar */}
      <View style={fallbackStyles.statusBar}>
        <View style={fallbackStyles.statusRow}>
          <CheckCircle size={16} color="#00ff88" />
          <Text style={fallbackStyles.statusTitle}>PROTECTION ACTIVE</Text>
        </View>
        <Text style={fallbackStyles.statusInfo}>
          Frame: {String(displayFrame).padStart(5, '0')} | 1080x1920 @30fps
        </Text>
        <Text style={fallbackStyles.statusHint}>Using built-in test pattern</Text>
      </View>

      {/* Scanning line effect */}
      <Animated.View
        style={[
          fallbackStyles.scanLine,
          {
            top: `${(displayFrame * 0.5) % 100}%`,
          },
        ]}
      />

      {/* Corner markers */}
      <View style={[fallbackStyles.corner, fallbackStyles.cornerTL]} />
      <View style={[fallbackStyles.corner, fallbackStyles.cornerTR]} />
      <View style={[fallbackStyles.corner, fallbackStyles.cornerBL]} />
      <View style={[fallbackStyles.corner, fallbackStyles.cornerBR]} />
    </View>
  );
};

const fallbackStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  circle: {
    position: 'absolute',
    left: '30%',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  centerIcon: {
    position: 'absolute',
    top: '55%',
    left: '50%',
    marginLeft: -30,
    marginTop: -30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    padding: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#00ff88',
  },
  statusInfo: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#ffffff',
    marginBottom: 4,
  },
  statusHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0, 255, 136, 0.4)',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#00ff88',
    borderWidth: 4,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
/**
 * Built-in Video Overlay Component
 * Renders an animated canvas-based video directly in React Native
 * This serves as a reliable fallback when no video is uploaded
 */
function BuiltInVideoOverlay({ onStatusChange }: { onStatusChange: (status: 'loading' | 'playing' | 'error') => void }) {
  const canvasRef = useRef<View>(null);
  
  useEffect(() => {
    // Notify parent that the built-in video is "playing"
    onStatusChange('playing');
  }, [onStatusChange]);
  
  return (
    <View style={builtInStyles.container}>
      <Animated.View style={builtInStyles.animatedBackground}>
        {/* Animated balls */}
        <AnimatedBall color="#ff6b6b" delay={0} />
        <AnimatedBall color="#4ecdc4" delay={200} />
        <AnimatedBall color="#ffe66d" delay={400} />
      </Animated.View>
      
      <View style={builtInStyles.labelContainer}>
        <Text style={builtInStyles.title}>BUILT-IN TEST VIDEO</Text>
        <Text style={builtInStyles.subtitle}>1080x1920 @ 30fps | Looping</Text>
      </View>
    </View>
  );
}

/**
 * Animated Ball Component for the built-in video effect
 */
function AnimatedBall({ color, delay }: { color: string; delay: number }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const horizontalAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bounceAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(horizontalAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(horizontalAnim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };
    
    const timer = setTimeout(startAnimation, delay);
    return () => clearTimeout(timer);
  }, [bounceAnim, horizontalAnim, delay]);
  
  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -150],
  });
  
  const translateX = horizontalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 50],
  });
  
  return (
    <Animated.View
      style={[
        builtInStyles.ball,
        { 
          backgroundColor: color,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    />
  );
}

const builtInStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
    flexDirection: 'row',
    gap: 30,
  },
  ball: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  labelContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default function ProtectedPreviewScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [useBuiltInVideo, setUseBuiltInVideo] = useState(true);
  const [videoStatus, setVideoStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const videoRef = useRef<Video>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const {
    protectedSettings,
    updateProtectedSettings,
    developerModeEnabled,
    showTestingWatermark,
    protocols,
    presentationMode,
    mlSafetyEnabled,
  } = useProtocol();

  const protocolEnabled = protocols.protected?.enabled ?? true;
  const simulateBodyDetected = protectedSettings.bodyDetectionEnabled;

  const compatibleVideos = useMemo(() => {
    return savedVideos.filter(video => {
      const status = video.compatibility?.overallStatus;
      const isFullyCompatible = status === 'perfect' || status === 'compatible';
      return isFullyCompatible && isVideoReady(video.id);
    });
  }, [savedVideos, isVideoReady]);

  useEffect(() => {
    if (selectedVideoId || compatibleVideos.length === 0) return;
    const preferred = protectedSettings.replacementVideoId
      ? compatibleVideos.find(video => video.id === protectedSettings.replacementVideoId)
      : null;
    setSelectedVideoId(preferred?.id || compatibleVideos[0].id);
  }, [selectedVideoId, compatibleVideos, protectedSettings.replacementVideoId]);

  useEffect(() => {
    if (selectedVideoId && selectedVideoId !== protectedSettings.replacementVideoId) {
      updateProtectedSettings({ replacementVideoId: selectedVideoId });
    }
  }, [selectedVideoId, protectedSettings.replacementVideoId, updateProtectedSettings]);

  // Fade in/out animation for overlay
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: simulateBodyDetected ? 1 : 0,
      duration: protectedSettings.blurFallback ? 300 : 150,
      useNativeDriver: true,
    }).start();
  }, [simulateBodyDetected, fadeAnim, protectedSettings.blurFallback]);

  const selectedVideo = compatibleVideos.find(video => video.id === selectedVideoId) || null;
  const showCamera = permission?.granted && Platform.OS !== 'web';
  
  // Determine which video source to use
  const hasVideoSource = useBuiltInVideo || selectedVideo;
  
  const handleVideoStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.isPlaying) {
        setVideoStatus('playing');
      }
    } else if ('error' in status) {
      setVideoStatus('error');
      console.error('[ProtectedPreview] Video error:', status.error);
    }
  };

  return (
    <View style={styles.container}>
      <TestingWatermark 
        visible={showTestingWatermark}
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
          <View style={[styles.protocolIcon, protocolEnabled && styles.protocolIconActive]}>
              <Shield size={16} color={protocolEnabled ? '#0a0a0a' : '#ff6b35'} />
            </View>
            <View>
              <Text style={styles.protocolBannerTitle}>Protocol 3: Protected Preview</Text>
              <Text style={styles.protocolBannerStatus}>
                {protocolEnabled ? 'LIVE - Ready for Testing' : 'Disabled'}
              </Text>
            </View>
          </View>
          {!developerModeEnabled && (
            <View style={styles.lockedIndicator}>
              <Lock size={12} color="#ff6b35" />
            </View>
          )}
        </View>
        
        {developerModeEnabled && (
          <View style={styles.protocolBadge}>
            <FlaskConical size={14} color="#ffcc00" />
            <Text style={styles.protocolBadgeText}>Developer Mode Active</Text>
          </View>
        )}

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Shield size={18} color="#00ff88" />
            <Text style={styles.previewTitle}>Live Preview</Text>
          </View>
          <Text style={styles.previewSubtitle}>
            Simulates body detection and swaps to a safe looping video.
            {'\n'}Sensitivity: {protectedSettings.sensitivityLevel.toUpperCase()}
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
              <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {hasVideoSource ? (
                  <>
                    {useBuiltInVideo ? (
                      <BuiltInVideoOverlay onStatusChange={setVideoStatus} />
                    ) : selectedVideo ? (
                      <Video
                        ref={videoRef}
                        source={{ uri: selectedVideo.uri }}
                        style={styles.overlayVideo}
                        shouldPlay
                        isLooping
                        resizeMode={ResizeMode.COVER}
                        onPlaybackStatusUpdate={handleVideoStatusUpdate}
                      />
                    ) : null}
                    {videoStatus === 'playing' && (
                      <View style={styles.statusBadge}>
                        <CheckCircle size={12} color="#00ff88" />
                        <Text style={styles.statusBadgeText}>Video Playing</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.overlayFallback}>
                    <Film size={24} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.overlayFallbackText}>
                      Enable built-in video or select a compatible video.
                    </Text>
                  </View>
                )}
                {protectedSettings.showProtectedBadge && selectedVideo && (
                  <View style={styles.overlayLabel}>
                    <Text style={styles.overlayLabelText}>
                      {useBuiltInVideo ? 'Built-in Test Video Active' : 'Protected Replacement Active'}
                    </Text>
                  </View>
                )}
              </Animated.View>
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
          
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.toggleLabel}>Use Built-in Test Video</Text>
              <Text style={styles.toggleHintSmall}>
                Animated test pattern - no upload needed
              </Text>
            </View>
            <Switch
              value={useBuiltInVideo}
              onValueChange={setUseBuiltInVideo}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#8a2be2' }}
              thumbColor={useBuiltInVideo ? '#ffffff' : '#888888'}
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

        {/* Settings Card */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Settings size={16} color="#00aaff" />
            <Text style={styles.settingsTitle}>Protocol Settings</Text>
            {!developerModeEnabled && (
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
              value={protectedSettings.showProtectedBadge}
              onValueChange={(val) => { if (developerModeEnabled) updateProtectedSettings({ showProtectedBadge: val }); }}
              disabled={!developerModeEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={protectedSettings.showProtectedBadge ? '#ffffff' : '#888888'}
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
                    protectedSettings.sensitivityLevel === level && styles.segmentButtonActive,
                  ]}
                  onPress={() => developerModeEnabled && updateProtectedSettings({ sensitivityLevel: level })}
                  disabled={!developerModeEnabled}
                >
                  <Text style={[
                    styles.segmentButtonText,
                    protectedSettings.sensitivityLevel === level && styles.segmentButtonTextActive,
                  ]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Blur Fallback</Text>
              <Text style={styles.settingHint}>Blur preview if no video selected</Text>
            </View>
            <Switch
              value={protectedSettings.blurFallback}
              onValueChange={(val) => { if (developerModeEnabled) updateProtectedSettings({ blurFallback: val }); }}
              disabled={!developerModeEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={protectedSettings.blurFallback ? '#ffffff' : '#888888'}
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
    fontWeight: '600',
    color: '#ffffff',
  },
  protocolBannerStatus: {
    fontSize: 10,
    color: '#00ff88',
    marginTop: 2,
    fontWeight: '500',
  },
  lockedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
    color: '#ffcc00',
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
    fontWeight: '700',
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
    textAlign: 'center',
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
    fontWeight: '600',
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
    textAlign: 'center',
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
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  toggleHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },
  toggleLabelContainer: {
    flex: 1,
  },
  toggleHintSmall: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#00ff88',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    textAlign: 'center',
  },
  openLibraryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,170,255,0.15)',
  },
  openLibraryButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  segmentButtonTextActive: {
    color: '#0a0a0a',
    fontWeight: '600',
  },
});
