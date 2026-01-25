import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Shield, AlertTriangle } from 'lucide-react-native';

interface TestingWatermarkProps {
  visible?: boolean;
  position?: 'top' | 'bottom' | 'top-right' | 'bottom-right';
  showPulse?: boolean;
  variant?: 'minimal' | 'full';
}

const TestingWatermark = memo(function TestingWatermark({
  visible = true,
  position = 'top-right',
  showPulse = true,
  variant = 'minimal',
}: TestingWatermarkProps) {
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (showPulse) {
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
      }
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, showPulse, fadeAnim, pulseAnim]);

  if (!visible) return null;

  const positionStyles = {
    'top': styles.positionTop,
    'bottom': styles.positionBottom,
    'top-right': styles.positionTopRight,
    'bottom-right': styles.positionBottomRight,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        positionStyles[position],
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
  container: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'flex-end',
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
