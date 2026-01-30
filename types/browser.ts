import type { AccelerometerData, GyroscopeData } from '@/hooks/useMotionSensors';

export type SimulationPattern = 'idle' | 'walking' | 'running' | 'shake' | 'rotate' | 'freefall' | 'driving' | 'custom';

export interface SimulationConfig {
  pattern: SimulationPattern;
  intensity: number;
  frequency: number;
  noise: number;
}

export type VideoSourceType = 'url' | 'upload';

export interface PatternPreset {
  label: string;
  description: string;
  baseAccel: AccelerometerData;
  baseGyro: GyroscopeData;
  accelAmplitude: AccelerometerData;
  gyroAmplitude: GyroscopeData;
  freq: number;
}

export type CheckStep = 'info' | 'permissions' | 'devices' | 'test' | 'injection' | 'complete';

export interface WebsiteSettings {
  id: string;
  baseUrl: string;
  fullUrl: string;
  useStealthByDefault: boolean;
  applyToSubdomains: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ValidatedVideo {
  uri: string;
  name: string;
  format: string;
  width: number;
  height: number;
  duration: number;
  fileSize: number;
  isValidated: boolean;
  validatedAt: string;
}

export interface VideoAssignmentResult {
  success: boolean;
  deviceId: string;
  video?: ValidatedVideo;
  requiresRestart: boolean;
  error?: string;
}
