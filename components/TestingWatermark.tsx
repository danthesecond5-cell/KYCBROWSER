import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Shield, FlaskConical, Lock } from 'lucide-react-native';

interface TestingWatermarkProps {
  visible: boolean;
  mlSafetyEnabled?: boolean;
  httpsEnforced?: boolean;
  protocolName?: string;
}

const TestingWatermark = memo(function TestingWatermark({
  visible,
  mlSafetyEnabled = true,
  httpsEnforced = true,
  protocolName,
}: TestingWatermarkProps) {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top Banner */}
      <View style={styles.topBanner}>
        <Animated.View style={[styles.bannerContent, { opacity: pulseAnim }]}>
          <FlaskConical size={14} color="#ffcc00" />
          <Text style={styles.bannerText}>TESTING PROTOTYPE</Text>
          <FlaskConical size={14} color="#ffcc00" />
        </Animated.View>
      </View>

      {/* Safety Badges */}
      <View style={styles.safetyBadges}>
        {httpsEnforced && (
          <View style={styles.badge}>
            <Lock size={10} color="#00ff88" />
            <Text style={styles.badgeText}>HTTPS</Text>
          </View>
        )}
        {mlSafetyEnabled && (
          <View style={[styles.badge, styles.mlBadge]}>
            <Shield size={10} color="#00aaff" />
            <Text style={[styles.badgeText, styles.mlBadgeText]}>ML SAFETY</Text>
          </View>
        )}
      </View>

      {/* Protocol Indicator */}
      {protocolName && (
        <View style={styles.protocolIndicator}>
          <Text style={styles.protocolText}>{protocolName}</Text>
        </View>
      )}

      {/* Corner Watermarks */}
      <View style={styles.cornerTopLeft}>
        <Text style={styles.cornerText}>BETA</Text>
      </View>
      <View style={styles.cornerTopRight}>
        <Text style={styles.cornerText}>BETA</Text>
      </View>
      <View style={styles.cornerBottomLeft}>
        <Text style={styles.cornerText}>DEV</Text>
      </View>
      <View style={styles.cornerBottomRight}>
        <Text style={styles.cornerText}>DEV</Text>
      </View>

      {/* Disclaimer Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          For demonstration purposes only. Not for production use.
        </Text>
        <Text style={styles.footerSubtext}>
          ML safety protocols prevent malicious use in production builds.
        </Text>
      </View>
    </View>
  );
});

export default TestingWatermark;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'space-between',
  },
  topBanner: {
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 204, 0, 0.3)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    color: '#ffcc00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  safetyBadges: {
    position: 'absolute',
    top: 40,
    right: 8,
    flexDirection: 'column',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  mlBadge: {
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    borderColor: 'rgba(0, 170, 255, 0.3)',
  },
  badgeText: {
    color: '#00ff88',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mlBadgeText: {
    color: '#00aaff',
  },
  protocolIndicator: {
    position: 'absolute',
    top: 40,
    left: 8,
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.4)',
  },
  protocolText: {
    color: '#b388ff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 70,
    left: 8,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 70,
    right: 8,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 60,
    left: 8,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 60,
    right: 8,
  },
  cornerText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSubtext: {
    color: 'rgba(0, 255, 136, 0.8)',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
});
