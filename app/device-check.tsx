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
  TestInjectionStep,
  CompleteStep,
} from '@/components/device-check';

const STEPS: CheckStep[] = ['info', 'permissions', 'devices', 'test', 'injection', 'complete'];

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
  const [injectionComplete, setInjectionComplete] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentStepIndex = STEPS.indexOf(currentStep);

  useEffect(() => {
    gatherDeviceInfo().then((info) => {
      if (info) {
        setTemplateName(generateTemplateName(info));
      }
    });
  }, [gatherDeviceInfo, generateTemplateName]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: (currentStepIndex + 1) / STEPS.length,
      useNativeDriver: false,
      friction: 10,
    }).start();
  }, [currentStepIndex, progressAnim]);

  useEffect(() => {
    if (currentStep === 'injection') {
      setInjectionComplete(false);
    }
  }, [currentStep]);

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
        setCurrentStep('injection');
        break;
      case 'injection':
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
        const isPast = currentStepIndex > index;
        return (
          <View key={step} style={styles.stepDotContainer}>
            <View style={[
              styles.stepDot,
              isActive && styles.stepDotActive,
              isPast && styles.stepDotComplete,
            ]}>
              {isPast && <CheckCircle size={10} color="#0a0a0a" />}
            </View>
            {index < STEPS.length - 1 && <View style={[styles.stepLine, isPast && styles.stepLineComplete]} />}
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
      case 'injection':
        return (
          <TestInjectionStep
            captureDevices={captureDevices}
            deviceInfo={deviceInfo}
            onCompletionChange={setInjectionComplete}
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
      case 'test': return 'Continue to Injection';
      case 'injection': return isSaving ? 'Saving...' : 'Save Template';
      case 'complete': return 'Start Testing';
    }
  };

  const canProceed = () => {
    if (currentStep === 'test' && testingDeviceId !== null) return false;
    if (currentStep === 'injection' && !injectionComplete) return false;
    if (isSaving) return false;
    return true;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Camera Check</Text>
          <Text style={styles.headerSubtitle}>Step {currentStepIndex + 1} of {STEPS.length}</Text>
        </View>

        {renderStepIndicator()}

        <Animated.View style={[
          styles.progressBar, 
          { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
        ]} />

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer} 
          showsVerticalScrollIndicator={false}
        >
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
            ) : currentStep === 'injection' ? (
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
    paddingHorizontal: 20,
  },
  stepDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 2,
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
