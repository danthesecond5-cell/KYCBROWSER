import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import type { 
  CaptureDevice, 
  PermissionStatus, 
  DeviceModelInfo,
  CameraCapabilities,
  PhotoResolution,
  VideoResolution,
} from '@/types/device';
import {
  DEFAULT_PHOTO_RESOLUTIONS,
  DEFAULT_VIDEO_RESOLUTIONS,
} from '@/constants/cameraResolutions';
import {
  detectCameraType,
  detectCameraFacing,
  createDefaultCapabilities,
} from '@/utils/cameraDetection';
import { createiOSCameraDevices, createAndroidCameraDevices } from '@/utils/cameraConfigs';

export function useDeviceEnumeration() {
  const [captureDevices, setCaptureDevices] = useState<CaptureDevice[]>([]);
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceModelInfo | null>(null);
  const [enumerationDetails, setEnumerationDetails] = useState<string[]>([]);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const generateTemplateName = useCallback((info: DeviceModelInfo): string => {
    const modelPart = info.model || info.brand || 'Unknown';
    const devicePart = info.deviceName || 'Device';
    return `${modelPart} - ${devicePart}`;
  }, []);

  const gatherDeviceInfo = useCallback(async () => {
    console.log('[DeviceCheck] Gathering device info...');
    
    const info: DeviceModelInfo = {
      platform: Platform.OS,
      osVersion: Platform.Version?.toString() || 'Unknown',
      deviceName: Device.deviceName || 'Unknown Device',
      brand: Device.brand || undefined,
      model: Device.modelName || undefined,
      modelId: Device.modelId || Device.modelName || undefined,
    };
    
    setDeviceInfo(info);
    console.log('[DeviceCheck] Device info:', info);
    return info;
  }, []);

  const requestAllPermissions = useCallback(async () => {
    console.log('[DeviceCheck] Requesting camera permissions...');
    const permResults: PermissionStatus[] = [];

    try {
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      permResults.push({
        name: 'Camera',
        status: cameraResult.granted ? 'granted' : 'denied',
        requested: true,
      });
    } catch (error) {
      console.error('[DeviceCheck] Camera permission error:', error);
      permResults.push({ name: 'Camera', status: 'denied', requested: true });
    }

    setPermissions(permResults);
    return permResults;
  }, []);

  const getDefaultCameraDevices = useCallback((): CaptureDevice[] => {
    return [
      {
        id: 'camera_back_default',
        name: 'Back Camera',
        type: 'camera',
        facing: 'back',
        lensType: 'wide',
        isDefault: true,
        tested: false,
        simulationEnabled: false,
      },
      {
        id: 'camera_front_default',
        name: 'Front Camera',
        type: 'camera',
        facing: 'front',
        lensType: 'wide',
        isDefault: false,
        tested: false,
        simulationEnabled: false,
      },
    ];
  }, []);

  const enumerateNativeDevices = useCallback(async (): Promise<CaptureDevice[]> => {
    const modelName = Device.modelName?.toLowerCase() || '';
    const brand = Device.brand?.toLowerCase() || '';
    
    console.log('[DeviceCheck] Native device enumeration for:', Device.modelName, Device.brand);

    try {
      const cameraPermission = await Camera.getCameraPermissionsAsync();
      if (cameraPermission.granted) {
        if (Platform.OS === 'ios') {
          return createiOSCameraDevices(modelName);
        } else if (Platform.OS === 'android') {
          return createAndroidCameraDevices(brand, modelName);
        }
      }
      
      return getDefaultCameraDevices().map(d => ({
        ...d,
        capabilities: createDefaultCapabilities(),
      }));
    } catch (err) {
      console.error('[DeviceCheck] Native camera enumeration error:', err);
      return getDefaultCameraDevices().map(d => ({
        ...d,
        capabilities: createDefaultCapabilities(),
      }));
    }
  }, [getDefaultCameraDevices]);

  const enumerateDevicesAdvanced = useCallback(async () => {
    console.log('[DeviceCheck] Starting advanced device enumeration...');
    const devices: CaptureDevice[] = [];
    const details: string[] = [];

    if (Platform.OS === 'web') {
      try {
        details.push('Checking Web MediaDevices API...');
        
        const hasNavigator = typeof navigator !== 'undefined';
        const hasMediaDevices = hasNavigator && typeof navigator.mediaDevices !== 'undefined';
        const hasEnumerate = hasMediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function';
        const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        
        if (!hasNavigator) {
          details.push('Navigator not available (non-browser environment)');
        } else if (!hasMediaDevices) {
          details.push('MediaDevices not available - requires HTTPS or localhost');
        } else if (!hasEnumerate) {
          details.push('enumerateDevices not supported in this browser');
        }
        
        if (hasMediaDevices && hasGetUserMedia) {
          details.push('Requesting camera access to unlock device labels...');
          
          let videoGranted = false;
          
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            videoGranted = true;
            details.push('Camera access granted');
          } catch (streamErr) {
            console.warn('[DeviceCheck] Could not get video stream:', streamErr);
            details.push(`Camera access failed: ${streamErr instanceof Error ? streamErr.message : 'Permission denied'}`);
          }
          
          if (hasEnumerate) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            let mediaDevices = await navigator.mediaDevices.enumerateDevices();
            details.push(`Initial enumeration: ${mediaDevices.length} devices`);
            
            const hasUnlabeledDevices = mediaDevices.some(d => 
              d.kind === 'videoinput' && !d.label
            );
            
            if (hasUnlabeledDevices && videoGranted) {
              details.push('Retrying enumeration after permission grant...');
              await new Promise(resolve => setTimeout(resolve, 200));
              mediaDevices = await navigator.mediaDevices.enumerateDevices();
              details.push(`Re-enumeration: ${mediaDevices.length} devices`);
            }
            
            const cameras = mediaDevices.filter(d => d.kind === 'videoinput');
            details.push(`Found ${cameras.length} cameras`);
            
            let cameraIndex = 0;
            const seenDeviceIds = new Set<string>();
            
            for (const device of cameras) {
              if (seenDeviceIds.has(device.deviceId) && device.deviceId !== '') {
                continue;
              }
              if (device.deviceId) {
                seenDeviceIds.add(device.deviceId);
              }
              
              cameraIndex++;
              const hasLabel = device.label && device.label.length > 0;
              const facing = detectCameraFacing(device.label, cameraIndex);
              const cameraType = detectCameraType(device.label);
              const displayName = hasLabel 
                ? device.label 
                : (cameraType !== 'wide' ? `${cameraType.charAt(0).toUpperCase() + cameraType.slice(1)} Camera ${cameraIndex}` : `Camera ${cameraIndex}`);
              
              const deviceIdPreview = device.deviceId ? device.deviceId.substring(0, 12) + '...' : 'no-id';
              details.push(`📷 ${displayName} [${facing}] (${deviceIdPreview})`);
              
              let capabilities: CameraCapabilities = createDefaultCapabilities();
              
              if (videoGranted && device.deviceId) {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } }
                  });
                  const videoTrack = stream.getVideoTracks()[0];
                  if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    const trackCaps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
                    
                    const photoRes: PhotoResolution[] = [];
                    const videoRes: VideoResolution[] = [];
                    
                    if (settings.width && settings.height) {
                      const mp = Math.round((settings.width * settings.height) / 1000000 * 10) / 10;
                      photoRes.push({
                        width: settings.width,
                        height: settings.height,
                        megapixels: mp,
                        label: `${mp}MP ${settings.width}x${settings.height}`,
                      });
                      videoRes.push({
                        width: settings.width,
                        height: settings.height,
                        label: `${settings.width}x${settings.height}`,
                        maxFps: settings.frameRate ? Math.round(settings.frameRate) : 30,
                      });
                    }

                    if (trackCaps) {
                      const maxW = (trackCaps as { width?: { max?: number } }).width?.max;
                      const maxH = (trackCaps as { height?: { max?: number } }).height?.max;
                      const maxFps = (trackCaps as { frameRate?: { max?: number } }).frameRate?.max;
                      
                      if (maxW && maxH && (maxW !== settings.width || maxH !== settings.height)) {
                        const mp = Math.round((maxW * maxH) / 1000000 * 10) / 10;
                        photoRes.unshift({
                          width: maxW,
                          height: maxH,
                          megapixels: mp,
                          label: `${mp}MP Max (${maxW}x${maxH})`,
                        });
                      }
                      
                      if (maxFps && maxFps > 60) {
                        videoRes.push({
                          width: settings.width || 1920,
                          height: settings.height || 1080,
                          label: `SlowMo ${maxFps}fps`,
                          maxFps: Math.round(maxFps),
                        });
                      }
                    }
                    
                    capabilities = {
                      photoResolutions: photoRes.length > 0 ? photoRes : DEFAULT_PHOTO_RESOLUTIONS,
                      videoResolutions: videoRes.length > 0 ? videoRes : DEFAULT_VIDEO_RESOLUTIONS,
                      supportedModes: ['photo', 'video'],
                    };
                    
                    let capDetails = `   └─ ${settings.width}x${settings.height}`;
                    if (settings.frameRate) capDetails += ` @ ${Math.round(settings.frameRate)}fps`;
                    details.push(capDetails);
                  }
                  stream.getTracks().forEach(track => track.stop());
                } catch {
                  details.push(`   └─ Capabilities unavailable`);
                }
              }
              
              devices.push({
                id: device.deviceId || `camera_${cameraIndex}`,
                name: displayName,
                type: 'camera',
                facing,
                lensType: cameraType,
                isDefault: cameraIndex === 1,
                tested: false,
                simulationEnabled: false,
                nativeDeviceId: device.deviceId,
                groupId: device.groupId,
                capabilities,
              });
            }
            
            if (devices.length === 0) {
              details.push('⚠️ No cameras enumerated, adding platform defaults...');
              devices.push(...getDefaultCameraDevices().map(d => ({
                ...d,
                capabilities: createDefaultCapabilities(),
              })));
            }
          } else {
            details.push('⚠️ Device enumeration not supported, using defaults');
            devices.push(...getDefaultCameraDevices().map(d => ({
              ...d,
              capabilities: createDefaultCapabilities(),
            })));
          }
        } else {
          details.push('⚠️ MediaDevices API unavailable - using platform defaults');
          details.push('Note: Full device detection requires HTTPS connection');
          devices.push(...getDefaultCameraDevices().map(d => ({
            ...d,
            capabilities: createDefaultCapabilities(),
          })));
        }
      } catch (err) {
        console.error('[DeviceCheck] Web enumeration error:', err);
        details.push(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        details.push('Falling back to default devices...');
        devices.push(...getDefaultCameraDevices().map(d => ({
          ...d,
          capabilities: createDefaultCapabilities(),
        })));
      }
    } else {
      details.push('Native platform detected, using native enumeration...');
      
      const nativeDevices = await enumerateNativeDevices();
      devices.push(...nativeDevices);
      
      const backCameras = nativeDevices.filter(d => d.facing === 'back');
      const frontCameras = nativeDevices.filter(d => d.facing === 'front');
      details.push(`📷 Found ${nativeDevices.length} total cameras:`);
      details.push(`   └─ ${backCameras.length} rear cameras`);
      details.push(`   └─ ${frontCameras.length} front cameras`);
      backCameras.forEach(c => {
        let info = `   └─ ${c.name}`;
        if (c.zoomFactor) info += ` (${c.zoomFactor})`;
        if (c.hardwareInfo?.megapixels) info += ` - ${c.hardwareInfo.megapixels}MP`;
        details.push(info);
      });
      frontCameras.forEach(c => {
        details.push(`   └─ ${c.name}`);
      });
    }

    if (isMountedRef.current) {
      setEnumerationDetails(details);
      setCaptureDevices(devices);
    }
    console.log('[DeviceCheck] Total cameras found:', devices.length);
    return devices;
  }, [enumerateNativeDevices, getDefaultCameraDevices]);

  const testCameraDevice = useCallback(async (device: CaptureDevice) => {
    console.log('[DeviceCheck] Testing camera:', device.id, device.name);
    setTestingDeviceId(device.id);
    
    const facing = device.facing === 'external' ? 'back' : (device.facing || 'back');
    setCameraFacing(facing);
    setShowCameraPreview(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!isMountedRef.current) {
      return;
    }

    setCaptureDevices(prev => prev.map(d =>
      d.id === device.id ? { ...d, tested: true, testResult: 'success' } : d
    ));
    
    setShowCameraPreview(false);
    setTestingDeviceId(null);
  }, []);

  const testDevice = useCallback(async (device: CaptureDevice) => {
    await testCameraDevice(device);
  }, [testCameraDevice]);

  const testAllDevices = useCallback(async () => {
    for (const device of captureDevices) {
      if (!device.tested) {
        await testDevice(device);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [captureDevices, testDevice]);

  return {
    deviceInfo,
    permissions,
    captureDevices,
    enumerationDetails,
    testingDeviceId,
    showCameraPreview,
    cameraFacing,
    setCaptureDevices,
    gatherDeviceInfo,
    generateTemplateName,
    requestAllPermissions,
    enumerateDevicesAdvanced,
    testDevice,
    testAllDevices,
    setShowCameraPreview,
  };
}
