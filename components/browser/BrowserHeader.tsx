import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  Globe,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  X,
  Settings,
  Shield,
  ShieldOff,
  Camera,
  Cloud,
} from 'lucide-react-native';

interface BrowserHeaderProps {
  inputUrl: string;
  setInputUrl: (url: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  safariModeEnabled: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleSafariMode: () => void;
  onSettings: () => void;
  onNavigate: () => void;
  onTestWebcam: () => void;
  onOpenRemoteBrowser: () => void;
}

const BrowserHeader = memo(function BrowserHeader({
  inputUrl,
  setInputUrl,
  canGoBack,
  canGoForward,
  safariModeEnabled,
  onGoBack,
  onGoForward,
  onReload,
  onToggleSafariMode,
  onSettings,
  onNavigate,
  onTestWebcam,
  onOpenRemoteBrowser,
}: BrowserHeaderProps) {
  return (
    <View style={styles.browserHeader}>
      <View style={styles.navButtons}>
        <TouchableOpacity 
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={onGoBack}
          disabled={!canGoBack}
        >
          <ArrowLeft size={18} color={canGoBack ? '#ffffff' : 'rgba(255,255,255,0.3)'} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={onGoForward}
          disabled={!canGoForward}
        >
          <ArrowRight size={18} color={canGoForward ? '#ffffff' : 'rgba(255,255,255,0.3)'} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={onReload}
        >
          <RefreshCw size={18} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navButton, safariModeEnabled && styles.safariModeActive]}
          onPress={onToggleSafariMode}
        >
          {safariModeEnabled ? (
            <Shield size={18} color="#00ff88" />
          ) : (
            <ShieldOff size={18} color="rgba(255,255,255,0.5)" />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={onSettings}
        >
          <Settings size={18} color="#00ff88" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.testWebcamButton}
          onPress={onTestWebcam}
        >
          <Camera size={14} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.remoteButton}
          onPress={onOpenRemoteBrowser}
        >
          <Cloud size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.urlBarContainer}>
        <Globe size={16} color="rgba(255,255,255,0.5)" />
        <TextInput
          style={styles.urlInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={onNavigate}
          placeholder="Enter URL or search"
          placeholderTextColor="rgba(255,255,255,0.4)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
        />
        {inputUrl.length > 0 && (
          <TouchableOpacity onPress={() => setInputUrl('')}>
            <X size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default BrowserHeader;

const styles = StyleSheet.create({
  browserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#151515',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  safariModeActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.4)',
  },
  testWebcamButton: {
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  remoteButton: {
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#00aaff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  urlBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    height: '100%',
  },
});
