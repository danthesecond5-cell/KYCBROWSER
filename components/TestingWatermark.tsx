import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Shield, AlertTriangle, FlaskConical, Lock } from 'lucide-react-native';

type WatermarkPosition = 'top' | 'bottom' | 'top-right' | 'bottom-right' | 'fullscreen';
type WatermarkVariant = 'minimal' | 'full';

interface TestingWatermarkProps {
  visible?: boolean;
  position?: WatermarkPosition;
  showPulse?: boolean;
  variant?: WatermarkVariant;
  mlSafetyEnabled?: boolean;
  httpsEnforced?: boolean;
  protocolName?: string;
}

const TestingWatermark = memo(function TestingWatermark(props: TestingWatermarkProps) {
  const {
    visible = true,
    position = 'top-right',
    showPulse = true,
    variant = 'minimal',
    mlSafetyEnabled,
    httpsEnforced,
    protocolName,
  } = props;

  const hasVariantProp = props.variant !== undefined;
  const showOverlay =
    position === 'fullscreen' ||
    (!hasVariantProp &&
      (typeof mlSafetyEnabled === 'boolean' ||
        typeof httpsEnforced === 'boolean' ||
        typeof protocolName === 'string'));

  const overlayMlSafetyEnabled = mlSafetyEnabled ?? true;
  const overlayHttpsEnforced = httpsEnforced ?? true;

  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!showPulse) {
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [visible, showPulse, fadeAnim, pulseAnim]);

  if (!visible) return null;

  if (showOverlay) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.overlayContainer, { opacity: fadeAnim }]}
      >
        <View style={styles.topBanner}>
          <Animated.View style={[styles.bannerContent, { opacity: showPulse ? pulseAnim : 1 }]}>
            <FlaskConical size={14} color="#ffcc00" />
            <Text style={styles.bannerText}>TESTING PROTOTYPE</Text>
            <FlaskConical size={14} color="#ffcc00" />
          </Animated.View>
        </View>

        <View style={styles.safetyBadges}>
          {overlayHttpsEnforced && (
            <View style={styles.httpsBadge}>
              <Lock size={10} color="#00ff88" />
              <Text style={styles.httpsBadgeText}>HTTPS</Text>
            </View>
          )}
          {overlayMlSafetyEnabled && (
            <View style={styles.mlSafetyBadge}>
              <Shield size={10} color="#00aaff" />
              <Text style={styles.mlSafetyBadgeText}>ML SAFETY</Text>
            </View>
          )}
        </View>

        {protocolName && (
          <View style={styles.protocolIndicator}>
            <Text style={styles.protocolText}>{protocolName}</Text>
          </View>
        )}

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

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            For demonstration purposes only. Not for production use.
          </Text>
          <Text style={styles.footerSubtext}>
            ML safety protocols prevent malicious use in production builds.
          </Text>
        </View>
      </Animated.View>
    );
  }

  const positionStyles: Record<Exclude<WatermarkPosition, 'fullscreen'>, object> = {
    top: styles.positionTop,
    bottom: styles.positionBottom,
    'top-right': styles.positionTopRight,
    'bottom-right': styles.positionBottomRight,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badgeContainer,
        positionStyles[position as Exclude<WatermarkPosition, 'fullscreen'>],
        {
          opacity: showPulse ? pulseAnim : fadeAnim,
        },
      ]}
    >
      <View style={[styles.badge, variant === 'full' && styles.badgeFull]}>
        <View style={styles.iconContainer}>
          <Shield size={variant === 'full' ? 14 : 10} color="#FFB800" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.label, variant === 'full' && styles.labelFull]}>
            TESTING PROTOTYPE
          </Text>
          {variant === 'full' && (
            <Text style={styles.sublabel}>
              ML Protection Active
            </Text>
          )}
        </View>
        {variant === 'full' && (
          <View style={styles.statusDot} />
        )}
      </View>

      {variant === 'full' && (
        <View style={styles.securityNote}>
          <AlertTriangle size={10} color="rgba(255, 184, 0, 0.7)" />
          <Text style={styles.securityNoteText}>
            For demonstration purposes only
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

export default TestingWatermark;

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'space-between',
  },
  positionTop: {
    top: 60,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  positionBottom: {
    bottom: 100,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  positionTopRight: {
    top: 60,
    right: 12,
  },
  positionBottomRight: {
    bottom: 100,
    right: 12,
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
  httpsBadge: {
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
  httpsBadgeText: {
    color: '#00ff88',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mlSafetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 170, 255, 0.3)',
  },
  mlSafetyBadgeText: {
    color: '#00aaff',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
    gap: 4,
  },
  badgeFull: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  iconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelFull: {
    fontSize: 10,
    letterSpacing: 1,
  },
  sublabel: {
    fontSize: 8,
    color: 'rgba(255, 184, 0, 0.7)',
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff88',
    marginLeft: 4,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  securityNoteText: {
    fontSize: 8,
    color: 'rgba(255, 184, 0, 0.7)',
  },
});
