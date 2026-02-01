import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

export interface GyroscopeData {
  x: number;
  y: number;
  z: number;
}

export interface OrientationData {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface SensorError {
  type: 'accelerometer' | 'gyroscope' | 'orientation';
  message: string;
  recoverable: boolean;
}

interface SensorState<T> {
  data: T;
  isAvailable: boolean;
  error: SensorError | null;
}

const DEFAULT_ACCEL: AccelerometerData = { x: 0, y: 0, z: 0 };
const DEFAULT_GYRO: GyroscopeData = { x: 0, y: 0, z: 0 };
const DEFAULT_ORIENT: OrientationData = { alpha: 0, beta: 0, gamma: 0 };

type WebPermissionRequester = () => Promise<'granted' | 'denied'>;

const getWebPermissionRequester = (eventType: 'motion' | 'orientation'): WebPermissionRequester | null => {
  const eventClass = eventType === 'orientation'
    ? (globalThis as { DeviceOrientationEvent?: { requestPermission?: WebPermissionRequester } }).DeviceOrientationEvent
    : (globalThis as { DeviceMotionEvent?: { requestPermission?: WebPermissionRequester } }).DeviceMotionEvent;

  if (eventClass && typeof eventClass.requestPermission === 'function') {
    return eventClass.requestPermission.bind(eventClass);
  }

  return null;
};

const requestWebSensorPermission = async (eventType: 'motion' | 'orientation'): Promise<boolean> => {
  const requester = getWebPermissionRequester(eventType);
  if (!requester) return true;
  try {
    const result = await requester();
    return result === 'granted';
  } catch {
    return false;
  }
};

const attachPermissionGestureListener = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('touchend', handler, { once: true });
  window.addEventListener('click', handler, { once: true });
  return () => {
    window.removeEventListener('touchend', handler);
    window.removeEventListener('click', handler);
  };
};

export function useAccelerometer(updateInterval = 100): SensorState<AccelerometerData> {
  const [data, setData] = useState<AccelerometerData>(DEFAULT_ACCEL);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<SensorError | null>(null);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let permissionCleanup: (() => void) | null = null;
    let mounted = true;

    const init = async () => {
      console.log('[Accelerometer] Initializing sensor...');
      setError(null);
      
      try {
        if (Platform.OS !== 'web') {
          const available = await Accelerometer.isAvailableAsync();
          console.log('[Accelerometer] Availability check:', available);
          
          if (!mounted) return;
          setIsAvailable(available);
          
          if (available) {
            try {
              Accelerometer.setUpdateInterval(updateInterval);
              subscription = Accelerometer.addListener((sensorData) => {
                if (mounted) {
                  if (sensorData && typeof sensorData.x === 'number') {
                    setData({
                      x: isFinite(sensorData.x) ? sensorData.x : 0,
                      y: isFinite(sensorData.y) ? sensorData.y : 0,
                      z: isFinite(sensorData.z) ? sensorData.z : 0,
                    });
                  }
                }
              });
              console.log('[Accelerometer] Listener attached successfully');
            } catch (listenerError) {
              console.error('[Accelerometer] Failed to attach listener:', listenerError);
              if (mounted) {
                setError({
                  type: 'accelerometer',
                  message: 'Failed to start accelerometer updates',
                  recoverable: true,
                });
              }
            }
          } else {
            console.warn('[Accelerometer] Sensor not available on this device');
            if (mounted) {
              setError({
                type: 'accelerometer',
                message: 'Accelerometer not available on this device',
                recoverable: false,
              });
            }
          }
        } else {
          if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
            console.log('[Accelerometer] Using web DeviceMotion API');

            const startWebListener = async () => {
              const granted = await requestWebSensorPermission('motion');
              if (!mounted) return;

              if (!granted) {
                setIsAvailable(false);
                setError({
                  type: 'accelerometer',
                  message: 'Motion permission required. Tap to enable.',
                  recoverable: true,
                });

                if (!permissionCleanup) {
                  permissionCleanup = attachPermissionGestureListener(() => {
                    permissionCleanup?.();
                    permissionCleanup = null;
                    void startWebListener();
                  });
                }
                return;
              }

              setError(null);
              setIsAvailable(true);

              const handleMotion = (event: DeviceMotionEvent) => {
                if (!mounted) return;
                try {
                  if (event.accelerationIncludingGravity) {
                    setData({
                      x: event.accelerationIncludingGravity.x || 0,
                      y: event.accelerationIncludingGravity.y || 0,
                      z: event.accelerationIncludingGravity.z || 0,
                    });
                  }
                } catch (err) {
                  console.error('[Accelerometer] Web motion event error:', err);
                }
              };

              if (subscription) {
                subscription.remove();
              }
              window.addEventListener('devicemotion', handleMotion as EventListener);
              subscription = {
                remove: () => window.removeEventListener('devicemotion', handleMotion as EventListener),
              };
            };

            void startWebListener();
          } else {
            console.warn('[Accelerometer] DeviceMotion not supported in web');
            if (mounted) {
              setIsAvailable(false);
              setError({
                type: 'accelerometer',
                message: 'Motion sensors not supported in this browser',
                recoverable: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('[Accelerometer] Initialization error:', err);
        if (mounted) {
          setError({
            type: 'accelerometer',
            message: err instanceof Error ? err.message : 'Failed to initialize accelerometer',
            recoverable: true,
          });
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (subscription) {
        try {
          subscription.remove();
          console.log('[Accelerometer] Listener removed');
        } catch (err) {
          console.error('[Accelerometer] Error removing listener:', err);
        }
      }
      if (permissionCleanup) {
        permissionCleanup();
        permissionCleanup = null;
      }
    };
  }, [updateInterval]);

  return { data, isAvailable, error };
}

export function useGyroscope(updateInterval = 100): SensorState<GyroscopeData> {
  const [data, setData] = useState<GyroscopeData>(DEFAULT_GYRO);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<SensorError | null>(null);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let permissionCleanup: (() => void) | null = null;
    let mounted = true;

    const init = async () => {
      console.log('[Gyroscope] Initializing sensor...');
      setError(null);
      
      try {
        if (Platform.OS !== 'web') {
          const available = await Gyroscope.isAvailableAsync();
          console.log('[Gyroscope] Availability check:', available);
          
          if (!mounted) return;
          setIsAvailable(available);
          
          if (available) {
            try {
              Gyroscope.setUpdateInterval(updateInterval);
              subscription = Gyroscope.addListener((sensorData) => {
                if (mounted) {
                  if (sensorData && typeof sensorData.x === 'number') {
                    setData({
                      x: isFinite(sensorData.x) ? sensorData.x : 0,
                      y: isFinite(sensorData.y) ? sensorData.y : 0,
                      z: isFinite(sensorData.z) ? sensorData.z : 0,
                    });
                  }
                }
              });
              console.log('[Gyroscope] Listener attached successfully');
            } catch (listenerError) {
              console.error('[Gyroscope] Failed to attach listener:', listenerError);
              if (mounted) {
                setError({
                  type: 'gyroscope',
                  message: 'Failed to start gyroscope updates',
                  recoverable: true,
                });
              }
            }
          } else {
            console.warn('[Gyroscope] Sensor not available on this device');
            if (mounted) {
              setError({
                type: 'gyroscope',
                message: 'Gyroscope not available on this device',
                recoverable: false,
              });
            }
          }
        } else {
          if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
            console.log('[Gyroscope] Using web DeviceMotion API');

            const startWebListener = async () => {
              const granted = await requestWebSensorPermission('motion');
              if (!mounted) return;

              if (!granted) {
                setIsAvailable(false);
                setError({
                  type: 'gyroscope',
                  message: 'Motion permission required. Tap to enable.',
                  recoverable: true,
                });

                if (!permissionCleanup) {
                  permissionCleanup = attachPermissionGestureListener(() => {
                    permissionCleanup?.();
                    permissionCleanup = null;
                    void startWebListener();
                  });
                }
                return;
              }

              setError(null);
              setIsAvailable(true);

              const handleMotion = (event: DeviceMotionEvent) => {
                if (!mounted) return;
                try {
                  if (event.rotationRate) {
                    setData({
                      x: event.rotationRate.alpha || 0,
                      y: event.rotationRate.beta || 0,
                      z: event.rotationRate.gamma || 0,
                    });
                  }
                } catch (err) {
                  console.error('[Gyroscope] Web motion event error:', err);
                }
              };

              if (subscription) {
                subscription.remove();
              }
              window.addEventListener('devicemotion', handleMotion as EventListener);
              subscription = {
                remove: () => window.removeEventListener('devicemotion', handleMotion as EventListener),
              };
            };

            void startWebListener();
          } else {
            console.warn('[Gyroscope] DeviceMotion not supported in web');
            if (mounted) {
              setIsAvailable(false);
              setError({
                type: 'gyroscope',
                message: 'Motion sensors not supported in this browser',
                recoverable: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('[Gyroscope] Initialization error:', err);
        if (mounted) {
          setError({
            type: 'gyroscope',
            message: err instanceof Error ? err.message : 'Failed to initialize gyroscope',
            recoverable: true,
          });
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (subscription) {
        try {
          subscription.remove();
          console.log('[Gyroscope] Listener removed');
        } catch (err) {
          console.error('[Gyroscope] Error removing listener:', err);
        }
      }
      if (permissionCleanup) {
        permissionCleanup();
        permissionCleanup = null;
      }
    };
  }, [updateInterval]);

  return { data, isAvailable, error };
}

export function useOrientation(updateInterval = 100): SensorState<OrientationData> {
  const [data, setData] = useState<OrientationData>(DEFAULT_ORIENT);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<SensorError | null>(null);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let permissionCleanup: (() => void) | null = null;
    let mounted = true;

    const init = async () => {
      console.log('[Orientation] Initializing sensor...');
      setError(null);
      
      try {
        if (Platform.OS !== 'web') {
          const available = await Magnetometer.isAvailableAsync();
          console.log('[Orientation] Magnetometer availability check:', available);
          
          if (!mounted) return;
          setIsAvailable(available);
          
          if (available) {
            try {
              Magnetometer.setUpdateInterval(updateInterval);
              subscription = Magnetometer.addListener((magData) => {
                if (mounted && magData) {
                  try {
                    const x = isFinite(magData.x) ? magData.x : 0;
                    const y = isFinite(magData.y) ? magData.y : 0;
                    const heading = Math.atan2(y, x) * (180 / Math.PI);
                    setData({ 
                      alpha: isFinite(heading) ? heading : 0, 
                      beta: 0, 
                      gamma: 0 
                    });
                  } catch (calcError) {
                    console.error('[Orientation] Calculation error:', calcError);
                  }
                }
              });
              console.log('[Orientation] Listener attached successfully');
            } catch (listenerError) {
              console.error('[Orientation] Failed to attach listener:', listenerError);
              if (mounted) {
                setError({
                  type: 'orientation',
                  message: 'Failed to start orientation updates',
                  recoverable: true,
                });
              }
            }
          } else {
            console.warn('[Orientation] Magnetometer not available on this device');
            if (mounted) {
              setError({
                type: 'orientation',
                message: 'Orientation sensor not available on this device',
                recoverable: false,
              });
            }
          }
        } else {
          if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
            console.log('[Orientation] Using web DeviceOrientation API');

            const startWebListener = async () => {
              const granted = await requestWebSensorPermission('orientation');
              if (!mounted) return;

              if (!granted) {
                setIsAvailable(false);
                setError({
                  type: 'orientation',
                  message: 'Orientation permission required. Tap to enable.',
                  recoverable: true,
                });

                if (!permissionCleanup) {
                  permissionCleanup = attachPermissionGestureListener(() => {
                    permissionCleanup?.();
                    permissionCleanup = null;
                    void startWebListener();
                  });
                }
                return;
              }

              setError(null);
              setIsAvailable(true);

              const handleOrientation = (event: DeviceOrientationEvent) => {
                if (!mounted) return;
                try {
                  setData({
                    alpha: event.alpha || 0,
                    beta: event.beta || 0,
                    gamma: event.gamma || 0,
                  });
                } catch (err) {
                  console.error('[Orientation] Web orientation event error:', err);
                }
              };

              if (subscription) {
                subscription.remove();
              }
              window.addEventListener('deviceorientation', handleOrientation as EventListener);
              subscription = {
                remove: () => window.removeEventListener('deviceorientation', handleOrientation as EventListener),
              };
            };

            void startWebListener();
          } else {
            console.warn('[Orientation] DeviceOrientation not supported in web');
            if (mounted) {
              setIsAvailable(false);
              setError({
                type: 'orientation',
                message: 'Orientation sensors not supported in this browser',
                recoverable: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('[Orientation] Initialization error:', err);
        if (mounted) {
          setError({
            type: 'orientation',
            message: err instanceof Error ? err.message : 'Failed to initialize orientation sensor',
            recoverable: true,
          });
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (subscription) {
        try {
          subscription.remove();
          console.log('[Orientation] Listener removed');
        } catch (err) {
          console.error('[Orientation] Error removing listener:', err);
        }
      }
      if (permissionCleanup) {
        permissionCleanup();
        permissionCleanup = null;
      }
    };
  }, [updateInterval]);

  return { data, isAvailable, error };
}
