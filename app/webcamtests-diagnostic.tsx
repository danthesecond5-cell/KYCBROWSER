/**
 * Webcamtests.com Diagnostic Page
 * 
 * This page loads webcamtests.com/recorder and tests each protocol
 * to identify what works and what doesn't.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { createWorkingInjectionScript } from '@/constants/workingInjection';
import { createMediaInjectionScript } from '@/constants/browserScripts';
import { createAdvancedProtocol2Script } from '@/utils/advancedProtocol/browserScript';
import { createSonnetProtocolScript } from '@/constants/sonnetProtocol';
import { createMinimalInjectionScript } from '@/constants/minimalInjection';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';
import { formatVideoUriForWebView, getDefaultFallbackVideoUri } from '@/utils/videoServing';
import type { SonnetProtocolConfig } from '@/constants/sonnetProtocol';
import type { CaptureDevice } from '@/types/device';

const TEST_URL = 'https://webcamtests.com/recorder';

interface TestResult {
  protocolName: string;
  protocolId: string;
  success: boolean;
  steps: {
    injectionLoaded?: boolean;
    getUserMediaOverridden?: boolean;
    enumerateDevicesOverridden?: boolean;
    streamCreated?: boolean;
    streamHasTracks?: boolean;
    trackHasCorrectMetadata?: boolean;
    webcamTestsDetectsCamera?: boolean;
    videoElementWorks?: boolean;
  };
  errors: string[];
  details: any;
}

type ProtocolKey = 'minimal' | 'working' | 'protocol1' | 'protocol2' | 'sonnet' | 'none';

const PROTOCOLS: Array<{ key: ProtocolKey; name: string; description: string }> = [
  { key: 'none', name: 'No Protocol (Baseline)', description: 'Test without any injection - should fail' },
  { key: 'minimal', name: 'Minimal Injection', description: 'Absolute simplest possible injection - if this fails, env is broken' },
  { key: 'working', name: 'Working Injection', description: 'Bulletproof canvas-based injection' },
  { key: 'protocol1', name: 'Protocol 1 (Standard)', description: 'Standard media injection with stealth mode' },
  { key: 'protocol2', name: 'Protocol 2 (Advanced)', description: 'Advanced with WebRTC relay and ASI' },
  { key: 'sonnet', name: 'Sonnet Protocol', description: 'AI-powered adaptive injection' },
];

export default function WebcamTestsDiagnosticScreen() {
  const webViewRef = useRef<WebView>(null);
  const { activeTemplate } = useDeviceTemplate();
  
  const [currentProtocol, setCurrentProtocol] = useState<ProtocolKey | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log('[WebcamTests]', message);
  }, []);
  
  const getTestDevices = useCallback((): CaptureDevice[] => {
    if (activeTemplate?.captureDevices && activeTemplate.captureDevices.length > 0) {
      return activeTemplate.captureDevices;
    }
    
    // Fallback test device
    return [
      {
        id: 'test_camera',
        nativeDeviceId: 'test_camera_native',
        name: 'Test Camera',
        type: 'camera',
        facing: 'front',
        isDefault: true,
        isPrimary: true,
        groupId: 'default',
        simulationEnabled: true,
        capabilities: {
          videoResolutions: [
            { width: 1920, height: 1080, fps: 30 },
            { width: 1280, height: 720, fps: 30 },
          ],
        },
      },
    ];
  }, [activeTemplate]);
  
  const getInjectionScript = useCallback((protocolKey: ProtocolKey): string => {
    if (protocolKey === 'none') {
      // Just a minimal script that logs but doesn't inject anything
      return `
(function() {
  console.log('[Diagnostic] No injection - baseline test');
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'baselineReady',
      payload: { hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) }
    }));
  }
})();
true;
      `;
    }
    
    const devices = getTestDevices();
    const fallbackVideoUri = formatVideoUriForWebView(getDefaultFallbackVideoUri());
    
    const normalizedDevices = devices.map(d => ({
      ...d,
      assignedVideoUri: d.assignedVideoUri 
        ? formatVideoUriForWebView(d.assignedVideoUri)
        : fallbackVideoUri,
      simulationEnabled: true,
    }));
    
    switch (protocolKey) {
      case 'minimal':
        return createMinimalInjectionScript();
      
      case 'working':
        return createWorkingInjectionScript({
          videoUri: fallbackVideoUri,
          devices: normalizedDevices,
          stealthMode: true,
          debugEnabled: true,
          targetWidth: 1280,
          targetHeight: 720,
          targetFPS: 30,
        });
      
      case 'protocol1':
        return createMediaInjectionScript(normalizedDevices, {
          stealthMode: true,
          fallbackVideoUri,
          forceSimulation: true,
          protocolId: 'protocol1',
          protocolLabel: 'Protocol 1 Test',
          showOverlayLabel: true,
          loopVideo: true,
          mirrorVideo: false,
          debugEnabled: true,
          permissionPromptEnabled: false, // CRITICAL: Disable permission prompt for testing
        });
      
      case 'protocol2':
        return createAdvancedProtocol2Script({
          videoUri: fallbackVideoUri,
          devices: normalizedDevices,
          enableWebRTCRelay: true,
          enableASI: true,
          enableGPU: false,
          enableCrypto: false,
          debugEnabled: true,
          stealthMode: true,
          protocolLabel: 'Protocol 2 Test',
          showOverlayLabel: true,
        });
      
      case 'sonnet':
        const sonnetConfig: SonnetProtocolConfig = {
          enabled: true,
          aiAdaptiveQuality: true,
          behavioralMimicry: true,
          neuralStyleTransfer: false,
          predictiveFrameOptimization: true,
          quantumTimingRandomness: true,
          biometricSimulation: true,
          realTimeProfiler: true,
          adaptiveStealth: true,
          performanceTarget: 'balanced',
          stealthIntensity: 'maximum',
          learningMode: true,
        };
        
        return createSonnetProtocolScript(normalizedDevices, sonnetConfig, fallbackVideoUri);
      
      default:
        return '';
    }
  }, [getTestDevices]);
  
  const getDiagnosticScript = useCallback(() => {
    return `
(function() {
  console.log('[Diagnostic] Comprehensive webcamtests.com test starting...');
  
  // Wait for page load
  setTimeout(async function() {
    const result = {
      protocolName: 'Unknown',
      protocolId: '${currentProtocol}',
      success: false,
      steps: {},
      errors: [],
      details: {},
    };
    
    try {
      // Check what's loaded
      result.details.hasMinimalInjection = !!window.__minimalInjectionActive;
      result.details.hasWorkingInjection = !!window.__workingInjectionActive;
      result.details.hasAdvancedProtocol2 = !!window.__advancedProtocol2Initialized;
      result.details.hasSonnetProtocol = !!window.__sonnetProtocolInitialized;
      result.details.hasMediaInjector = !!window.__mediaInjectorInitialized;
      
      console.log('[Diagnostic] State:', result.details);
      
      // Check MediaDevices API
      result.details.hasMediaDevices = !!navigator.mediaDevices;
      result.details.hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      result.details.hasEnumerateDevices = !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
      
      result.steps.injectionLoaded = 
        result.details.hasMinimalInjection ||
        result.details.hasWorkingInjection || 
        result.details.hasAdvancedProtocol2 || 
        result.details.hasSonnetProtocol ||
        result.details.hasMediaInjector;
      
      // Test enumerateDevices
      console.log('[Diagnostic] Testing enumerateDevices...');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        result.details.deviceCount = devices.length;
        result.details.videoDeviceCount = devices.filter(d => d.kind === 'videoinput').length;
        result.steps.enumerateDevicesOverridden = devices.filter(d => d.kind === 'videoinput').length > 0;
        result.steps.webcamTestsDetectsCamera = result.steps.enumerateDevicesOverridden;
        console.log('[Diagnostic] Found', result.details.videoDeviceCount, 'video devices');
      } catch (e) {
        console.error('[Diagnostic] enumerateDevices failed:', e);
        result.errors.push('enumerateDevices: ' + e.message);
      }
      
      // Test getUserMedia
      console.log('[Diagnostic] Testing getUserMedia...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        
        console.log('[Diagnostic] Stream created!', stream);
        result.steps.getUserMediaOverridden = true;
        result.steps.streamCreated = true;
        result.details.streamId = stream.id;
        result.details.streamActive = stream.active;
        
        const videoTracks = stream.getVideoTracks();
        result.details.trackCount = videoTracks.length;
        result.steps.streamHasTracks = videoTracks.length > 0;
        
        if (videoTracks.length > 0) {
          const track = videoTracks[0];
          result.details.trackId = track.id;
          result.details.trackLabel = track.label;
          result.details.trackReadyState = track.readyState;
          result.details.trackEnabled = track.enabled;
          result.details.trackMuted = track.muted;
          
          if (typeof track.getSettings === 'function') {
            result.details.trackSettings = track.getSettings();
            result.steps.trackHasCorrectMetadata = !!(
              result.details.trackSettings.width && 
              result.details.trackSettings.height
            );
          }
          
          // Test with video element
          console.log('[Diagnostic] Testing video element...');
          const video = document.createElement('video');
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.srcObject = stream;
          video.style.cssText = 'position:fixed;top:10px;right:10px;width:320px;height:240px;z-index:999999;border:4px solid lime;';
          
          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
              video.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve(null);
              };
              video.onerror = (e) => {
                clearTimeout(timeout);
                reject(e);
              };
            });
            
            document.body.appendChild(video);
            result.steps.videoElementWorks = true;
            result.details.videoWidth = video.videoWidth;
            result.details.videoHeight = video.videoHeight;
            console.log('[Diagnostic] Video element works!', video.videoWidth, 'x', video.videoHeight);
          } catch (e) {
            console.error('[Diagnostic] Video element failed:', e);
            result.errors.push('Video element: ' + e.message);
          }
        }
        
        result.success = 
          result.steps.streamCreated && 
          result.steps.streamHasTracks && 
          result.steps.trackHasCorrectMetadata &&
          result.steps.videoElementWorks;
          
      } catch (e) {
        console.error('[Diagnostic] getUserMedia failed:', e);
        result.errors.push('getUserMedia: ' + e.message);
      }
      
    } catch (e) {
      console.error('[Diagnostic] Test failed:', e);
      result.errors.push('Test error: ' + e.message);
    }
    
    console.log('[Diagnostic] Test complete:', result);
    
    // Send result back
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'testResult',
        payload: result,
      }));
    }
    
  }, 3000); // Wait 3 seconds for everything to initialize
  
})();
true;
    `;
  }, [currentProtocol]);
  
  const runTest = useCallback(async (protocolKey: ProtocolKey) => {
    addLog(`Starting test: ${PROTOCOLS.find(p => p.key === protocolKey)?.name}`);
    setCurrentProtocol(protocolKey);
    setIsLoading(true);
    
    // Reload WebView to clear any previous state
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [addLog]);
  
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'testResult') {
        const result = data.payload as TestResult;
        result.protocolName = PROTOCOLS.find(p => p.key === currentProtocol)?.name || 'Unknown';
        setTestResults(prev => [...prev, result]);
        setIsLoading(false);
        
        if (result.success) {
          addLog(`✓ ${result.protocolName} PASSED`);
        } else {
          addLog(`✗ ${result.protocolName} FAILED: ${result.errors.join(', ')}`);
        }
      } else if (data.type === 'baselineReady') {
        addLog(`Baseline test ready - has getUserMedia: ${data.payload.hasGetUserMedia}`);
      } else if (data.type === 'console') {
        addLog(`[WebView] ${data.message}`);
      }
    } catch (e) {
      // Not JSON or not our message
    }
  }, [currentProtocol, addLog]);
  
  const runAllTests = useCallback(async () => {
    addLog('========================================');
    addLog('Running comprehensive protocol tests');
    addLog('========================================');
    setTestResults([]);
    
    for (const protocol of PROTOCOLS) {
      addLog(`\n--- Testing ${protocol.name} ---`);
      await runTest(protocol.key);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s between tests
    }
    
    addLog('\n========================================');
    addLog('All tests complete');
    addLog('========================================');
  }, [runTest, addLog]);
  
  const injectionScript = currentProtocol ? getInjectionScript(currentProtocol) + '\n' + getDiagnosticScript() : '';
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Webcamtests Diagnostic</Text>
          <TouchableOpacity onPress={runAllTests} style={styles.runAllButton}>
            <Text style={styles.runAllButtonText}>Run All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.protocolList}>
          {PROTOCOLS.map((protocol) => {
            const result = testResults.find(r => r.protocolId === protocol.key);
            const isRunning = currentProtocol === protocol.key && isLoading;
            
            return (
              <View key={protocol.key} style={styles.protocolCard}>
                <View style={styles.protocolHeader}>
                  <View style={styles.protocolInfo}>
                    <Text style={styles.protocolName}>
                      {result ? (result.success ? '✓' : '✗') : '○'} {protocol.name}
                    </Text>
                    <Text style={styles.protocolDescription}>{protocol.description}</Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => runTest(protocol.key)}
                    disabled={isRunning}
                    style={[styles.testButton, isRunning && styles.testButtonDisabled]}
                  >
                    {isRunning ? (
                      <ActivityIndicator size="small" color="#00ff88" />
                    ) : (
                      <Text style={styles.testButtonText}>Test</Text>
                    )}
                  </TouchableOpacity>
                </View>
                
                {result && (
                  <View style={[styles.resultBox, result.success ? styles.successBox : styles.errorBox]}>
                    <Text style={[styles.resultText, result.success ? styles.successText : styles.errorText]}>
                      {result.success ? 'SUCCESS' : 'FAILED'}
                    </Text>
                    {!result.success && result.errors.length > 0 && (
                      <Text style={styles.errorDetails}>{result.errors.join('\n')}</Text>
                    )}
                    {result.details && (
                      <Text style={styles.detailsText}>
                        Devices: {result.details.videoDeviceCount || 0} | 
                        Tracks: {result.details.trackCount || 0} | 
                        Video: {result.details.videoWidth}x{result.details.videoHeight}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        
        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Test Logs:</Text>
          <ScrollView style={styles.logsList}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.webViewContainer}>
          <Text style={styles.webViewLabel}>Live WebView ({currentProtocol || 'none'}):</Text>
          <WebView
            ref={webViewRef}
            source={{ uri: TEST_URL }}
            style={styles.webView}
            injectedJavaScriptBeforeContentLoaded={injectionScript}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => {}}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  runAllButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  runAllButtonText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '700',
  },
  protocolList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  protocolCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  protocolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  protocolInfo: {
    flex: 1,
  },
  protocolName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  protocolDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  testButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#333',
  },
  testButtonText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '700',
  },
  resultBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  successBox: {
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderColor: 'rgba(0,255,136,0.3)',
  },
  errorBox: {
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderColor: 'rgba(255,71,87,0.3)',
  },
  resultText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  successText: {
    color: '#00ff88',
  },
  errorText: {
    color: '#ff4757',
  },
  errorDetails: {
    color: '#ff4757',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  detailsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 4,
  },
  logsContainer: {
    height: 120,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111',
    padding: 8,
  },
  logsTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  logsList: {
    flex: 1,
  },
  logText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  webViewContainer: {
    height: 200,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111',
  },
  webViewLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    padding: 6,
    backgroundColor: '#0a0a0a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
