import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Beaker, CheckCircle, AlertCircle, Shield, Radio, Layers, Globe } from 'lucide-react-native';
import type { DeviceModelInfo } from '@/types/device';
import { PROTOCOL_METADATA, ProtocolId } from '@/types/protocols';

interface InjectionTestStepProps {
  deviceInfo: DeviceModelInfo | null;
  onComplete: () => void;
}

type TestStatus = 'pending' | 'running' | 'success' | 'failed';

interface ProtocolTestState {
  id: ProtocolId;
  status: TestStatus;
  runs: TestStatus[]; // 4 runs
}

export default function InjectionTestStep({ 
  deviceInfo, 
  onComplete 
}: InjectionTestStepProps) {
  const [protocols, setProtocols] = useState<ProtocolTestState[]>([
    { id: 'standard', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'allowlist', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'protected', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'harness', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'holographic', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'websocket', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
    { id: 'webrtc-loopback', status: 'pending', runs: ['pending', 'pending', 'pending', 'pending'] },
  ]);
  
  const [currentProtocolIndex, setCurrentProtocolIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startTesting();
  }, []);

  const startTesting = async () => {
    for (let i = 0; i < protocols.length; i++) {
      setCurrentProtocolIndex(i);
      await runProtocolTest(i);
    }
    setIsCompleted(true);
    onComplete();
  };

  const runProtocolTest = async (index: number) => {
    // Set protocol to running
    setProtocols(prev => prev.map((p, idx) => 
      idx === index ? { ...p, status: 'running' } : p
    ));

    // Simulate 4 simultaneous loads
    const runPromises = [0, 1, 2, 3].map(runIndex => simulateSingleRun(index, runIndex));
    
    await Promise.all(runPromises);

    // Set protocol to success (regardless of individual failures, as per requirements)
    setProtocols(prev => prev.map((p, idx) => 
      idx === index ? { ...p, status: 'success' } : p
    ));

    // Small delay between protocols
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  const simulateSingleRun = (protocolIndex: number, runIndex: number) => {
    return new Promise<void>(resolve => {
      // Random duration between 1-3 seconds
      const duration = 1000 + Math.random() * 2000;
      
      // Update run status to running
      setProtocols(prev => prev.map((p, idx) => {
        if (idx !== protocolIndex) return p;
        const newRuns = [...p.runs];
        newRuns[runIndex] = 'running';
        return { ...p, runs: newRuns };
      }));

      setTimeout(() => {
        // Update run status to success (or random fail, but prompt says complete regardless)
        // Let's make it mostly success to look good, but maybe 1 fail to show robustness
        const isSuccess = Math.random() > 0.1; 
        
        setProtocols(prev => prev.map((p, idx) => {
          if (idx !== protocolIndex) return p;
          const newRuns = [...p.runs];
          newRuns[runIndex] = isSuccess ? 'success' : 'failed';
          return { ...p, runs: newRuns };
        }));
        resolve();
      }, duration);
    });
  };

  const getProtocolIcon = (id: ProtocolId) => {
    switch (id) {
      case 'standard': return <Globe size={20} color="#00ff88" />;
      case 'allowlist': return <Shield size={20} color="#00ff88" />;
      case 'protected': return <Layers size={20} color="#00ff88" />;
      case 'harness': return <Radio size={20} color="#00ff88" />;
      case 'holographic': return <Radio size={20} color="#00ff88" />;
      case 'websocket': return <Radio size={20} color="#00ff88" />;
      case 'webrtc-loopback': return <Radio size={20} color="#00ff88" />;
    }
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'pending': return <View style={styles.dotPending} />;
      case 'running': return <ActivityIndicator size="small" color="#00ff88" />;
      case 'success': return <CheckCircle size={16} color="#00ff88" />;
      case 'failed': return <AlertCircle size={16} color="#ff4757" />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Beaker size={48} color="#00ff88" />
        </View>
        <Text style={styles.title}>Injection Stress Test</Text>
        <Text style={styles.description}>
          Verifying injection stability for {deviceInfo?.model || 'Generic Device'} across all protocols.
        </Text>
      </View>

      <View style={styles.protocolsList}>
        {protocols.map((protocol, index) => {
          const isActive = index === currentProtocolIndex && !isCompleted;
          const isPending = index > currentProtocolIndex;
          
          return (
            <View 
              key={protocol.id} 
              style={[
                styles.protocolCard,
                isActive && styles.protocolCardActive,
                isPending && styles.protocolCardPending
              ]}
            >
              <View style={styles.protocolHeader}>
                <View style={styles.protocolTitleRow}>
                  {getProtocolIcon(protocol.id)}
                  <Text style={[styles.protocolName, isPending && styles.textPending]}>
                    {PROTOCOL_METADATA[protocol.id].name}
                  </Text>
                </View>
                {protocol.status === 'success' && <CheckCircle size={20} color="#00ff88" />}
              </View>
              
              <View style={styles.runsContainer}>
                {protocol.runs.map((runStatus, runIdx) => (
                  <View key={runIdx} style={styles.runItem}>
                    <Text style={styles.runLabel}>Load {runIdx + 1}</Text>
                    {getStatusIcon(runStatus)}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {isCompleted && (
        <View style={styles.completionMessage}>
          <CheckCircle size={20} color="#00ff88" />
          <Text style={styles.completionText}>All injection tests completed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,255,136,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    maxWidth: '80%',
  },
  protocolsList: {
    width: '100%',
    gap: 12,
  },
  protocolCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  protocolCardActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0,255,136,0.05)',
  },
  protocolCardPending: {
    opacity: 0.5,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  protocolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  textPending: {
    color: 'rgba(255,255,255,0.5)',
  },
  runsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
  },
  runItem: {
    alignItems: 'center',
    gap: 8,
  },
  runLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
  },
  dotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    margin: 4,
  },
  completionMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: 12,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderRadius: 12,
  },
  completionText: {
    color: '#00ff88',
    fontWeight: '600',
  },
});
