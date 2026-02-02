/**
 * WebRTC Webcam Test Component
 * 
 * Example implementation of WebRTC video injection for webcamtests.com
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import WebView from 'react-native-webview';
import { useWebRTCInjection } from '@/hooks/useWebRTCInjection';

export function WebRTCWebcamTest() {
  const webViewRef = useRef<WebView>(null);

  const {
    injectionScript,
    state,
    connect,
    disconnect,
    handleWebViewMessage,
  } = useWebRTCInjection({
    videoConfig: {
      width: 1080,
      height: 1920,
      fps: 30,
    },
    injectionConfig: {
      debug: true,
      stealthMode: true,
      deviceLabel: 'WebRTC Virtual Camera',
      deviceId: 'webrtc-camera-001',
    },
    debug: true,
    autoConnect: true,
  });

  const getStateColor = () => {
    switch (state.connectionState) {
      case 'connected':
        return '#00ff88';
      case 'connecting':
        return '#ffaa00';
      case 'failed':
        return '#ff4444';
      case 'disconnected':
        return '#888888';
      default:
        return '#888888';
    }
  };

  const getStateEmoji = () => {
    switch (state.connectionState) {
      case 'connected':
        return '✅';
      case 'connecting':
        return '🔄';
      case 'failed':
        return '❌';
      case 'disconnected':
        return '⭕';
      default:
        return '⭕';
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: getStateColor() }]}>
        <Text style={styles.statusText}>
          {getStateEmoji()} WebRTC: {state.connectionState.toUpperCase()}
        </Text>
        {state.isReady && (
          <Text style={styles.statusSubtext}>Stream Active</Text>
        )}
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://webcamtests.com/recorder' }}
        injectedJavaScriptBeforeContentLoaded={injectionScript}
        onMessage={handleWebViewMessage}
        
        // Critical settings for video injection
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsProtectedMedia={true}
        
        // Debugging
        onError={(syntheticEvent) => {
          console.error('WebView error:', syntheticEvent.nativeEvent);
        }}
        onLoad={() => {
          console.log('WebView loaded');
        }}
        onLoadEnd={() => {
          console.log('WebView load complete');
        }}
        
        style={styles.webview}
      />

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <ScrollView style={styles.statsContainer}>
          {/* Connection Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Connection Status</Text>
            <Text style={styles.infoText}>State: {state.connectionState}</Text>
            <Text style={styles.infoText}>Ready: {state.isReady ? 'Yes' : 'No'}</Text>
            {state.error && (
              <Text style={[styles.infoText, styles.errorText]}>
                Error: {state.error}
              </Text>
            )}
          </View>

          {/* Stats */}
          {state.stats && (
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Stream Statistics</Text>
              <Text style={styles.infoText}>
                Bytes Sent: {formatBytes(state.stats.bytesSent)}
              </Text>
              <Text style={styles.infoText}>
                Frames Sent: {state.stats.framesSent || 0}
              </Text>
              <Text style={styles.infoText}>
                Frames Encoded: {state.stats.framesEncoded || 0}
              </Text>
              <Text style={styles.infoText}>
                RTT: {state.stats.currentRoundTripTime.toFixed(3)}ms
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                state.connectionState === 'connected' && styles.buttonDisabled,
              ]}
              onPress={connect}
              disabled={state.connectionState === 'connected'}
            >
              <Text style={styles.buttonText}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonDanger,
                state.connectionState === 'disconnected' && styles.buttonDisabled,
              ]}
              onPress={disconnect}
              disabled={state.connectionState === 'disconnected'}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statusBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  webview: {
    flex: 1,
  },
  controlPanel: {
    height: 200,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statsContainer: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoTitle: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  errorText: {
    color: '#ff4444',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#ff4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
