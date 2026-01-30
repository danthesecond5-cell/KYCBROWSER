import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { CheckCircle, ChevronRight, ArrowRight, Save, FlaskConical } from 'lucide-react-native';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';
import { useDeviceEnumeration } from '@/hooks/useDeviceEnumeration';
import type { CheckStep } from '@/types/browser';
import {
  InfoStep,
  PermissionsStep,
  DevicesStep,
  TestStep,
  InjectionTestStep,
  CompleteStep,
} from '@/components/device-check';

// Type for injection test results
interface InjectionTestResult {
  protocol: 'standard' | 'allowlist' | 'protected' | 'harness';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'timeout';
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  error: string | null;
  streamDetected: boolean;
  injectionActive: boolean;
  deviceLabel: string | null;
  resolution: { width: number; height: number } | null;
  fps: number | null;
}

export default function DeviceCheckScreen() {
  const { createTemplate } = useDeviceTemplate();
  const {
    deviceInfo,
    permissions,
    captureDevices,
    enumerationDetails,
    testingDeviceId,
    showCameraPreview,
    cameraFacing,
    gatherDeviceInfo,
    generateTemplateName,
    requestAllPermissions,
    enumerateDevicesAdvanced,
    testDevice,
    testAllDevices,
  } = useDeviceEnumeration();

  const [currentStep, setCurrentStep] = useState<CheckStep>('info');
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [injectionTestResults, setInjectionTestResults] = useState<InjectionTestResult[]>([]);
  const [injectionTestsComplete, setInjectionTestsComplete] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // All steps including the new injection-test step
  const STEPS: CheckStep[] = ['info', 'permissions', 'devices', 'test', 'injection-test', 'complete'];
  const TOTAL_STEPS = STEPS.length;

  useEffect(() => {
    gatherDeviceInfo().then((info) => {
      if (info) {
        setTemplateName(generateTemplateName(info));
      }
    });
  }, [gatherDeviceInfo, generateTemplateName]);

  useEffect(() => {
    const stepIndex = STEPS.indexOf(currentStep);
    Animated.spring(progressAnim, {
      toValue: (stepIndex + 1) / TOTAL_STEPS,
      useNativeDriver: false,
      friction: 10,
    }).start();
  }, [currentStep, progressAnim]);

  // Handler for when injection tests complete
  const handleInjectionTestsComplete = (results: InjectionTestResult[]) => {
    console.log('[DeviceCheck] Injection tests complete:', results);
    setInjectionTestResults(results);
    setInjectionTestsComplete(true);
  };

  const saveTemplate = async () => {
    if (!deviceInfo) return;
    
    setIsSaving(true);
    console.log('[DeviceCheck] Saving template...');

    try {
      await createTemplate({
        name: templateName || generateTemplateName(deviceInfo),
        deviceInfo,
        captureDevices,
        permissions,
        isComplete: true,
      });

      setCurrentStep('complete');
    } catch (error) {
      console.error('[DeviceCheck] Failed to save template:', error);
      Alert.alert('Error', 'Failed to save device template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const proceedToTesting = () => {
    router.replace('/');
  };

  const handleNextStep = async () => {
    switch (currentStep) {
      case 'info':
        setCurrentStep('permissions');
        break;
      case 'permissions':
        await requestAllPermissions();
        setCurrentStep('devices');
        await enumerateDevicesAdvanced();
        break;
      case 'devices':
        setCurrentStep('test');
        break;
      case 'test':
        // Move to injection test step
        setCurrentStep('injection-test');
        break;
      case 'injection-test':
        // Save template after injection tests complete
        await saveTemplate();
        break;
      case 'complete':
        proceedToTesting();
        break;
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => {
        const isActive = currentStep === step;
        const isPast = STEPS.indexOf(currentStep) > index;
        const isInjectionTest = step === 'injection-test';
        return (
          <View key={step} style={styles.stepDotContainer}>
            <View style={[
              styles.stepDot,
              isActive && styles.stepDotActive,
              isPast && styles.stepDotComplete,
              isInjectionTest && isActive && styles.stepDotInjection,
            ]}>
              {isPast && <CheckCircle size={12} color="#0a0a0a" />}
              {isInjectionTest && isActive && <FlaskConical size={12} color="#0a0a0a" />}
            </View>
            {index < TOTAL_STEPS - 1 && <View style={[styles.stepLine, isPast && styles.stepLineComplete]} />}
          </View>
        );
      })}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'info':
        return (
          <InfoStep
            deviceInfo={deviceInfo}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
          />
        );
      case 'permissions':
        return <PermissionsStep permissions={permissions} />;
      case 'devices':
        return (
          <DevicesStep
            captureDevices={captureDevices}
            enumerationDetails={enumerationDetails}
          />
        );
      case 'test':
        return (
          <TestStep
            captureDevices={captureDevices}
            testingDeviceId={testingDeviceId}
            showCameraPreview={showCameraPreview}
            cameraFacing={cameraFacing}
            onTestDevice={testDevice}
            onTestAllDevices={testAllDevices}
          />
        );
      case 'injection-test':
        return (
          <InjectionTestStep
            captureDevices={captureDevices}
            deviceInfo={deviceInfo}
            onTestsComplete={handleInjectionTestsComplete}
            stealthMode={true}
            assignedVideoUri={null}
          />
        );
      case 'complete':
        return (
          <CompleteStep
            templateName={templateName}
            deviceInfo={deviceInfo}
            captureDevices={captureDevices}
            permissions={permissions}
          />
        );
    }
  };

  const getButtonText = () => {
    switch (currentStep) {
      case 'info': return 'Continue';
      case 'permissions': return 'Request Permission';
      case 'devices': return 'Continue to Testing';
      case 'test': return 'Run Injection Tests';
      case 'injection-test': return isSaving ? 'Saving...' : 'Save Template';
      case 'complete': return 'Start Testing';
    }
  };

  const canProceed = () => {
    if (currentStep === 'test' && testingDeviceId !== null) return false;
    if (currentStep === 'injection-test' && !injectionTestsComplete) return false;
    if (currentStep === 'injection-test' && isSaving) return false;
    return true;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Camera Check</Text>
          <Text style={styles.headerSubtitle}>Step {STEPS.indexOf(currentStep) + 1} of {TOTAL_STEPS}</Text>
        </View>

        {renderStepIndicator()}

        <Animated.View style={[styles.progressBar, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>{getButtonText()}</Text>
            {currentStep === 'complete' ? (
              <ArrowRight size={20} color="#0a0a0a" />
            ) : currentStep === 'injection-test' ? (
              <Save size={20} color="#0a0a0a" />
            ) : currentStep === 'test' ? (
              <FlaskConical size={20} color="#0a0a0a" />
            ) : (
              <ChevronRight size={20} color="#0a0a0a" />
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  stepDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  stepDotComplete: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  stepDotInjection: {
    backgroundColor: '#8a2be2',
    borderColor: '#8a2be2',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  stepLineComplete: {
    backgroundColor: '#00ff88',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#00ff88',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ff88',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(0,255,136,0.3)',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0a0a0a',
  },
});
