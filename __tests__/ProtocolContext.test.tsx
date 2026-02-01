import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProtocolProvider, useProtocol } from '@/contexts/ProtocolContext';

function Consumer({ onReady }: { onReady?: (ctx: ReturnType<typeof useProtocol>) => void }) {
  const ctx = useProtocol();

  React.useEffect(() => {
    if (!ctx.isLoading && onReady) {
      onReady(ctx);
    }
  }, [ctx, onReady]);

  return <Text testID="consumer">Consumer</Text>;
}

describe('ProtocolContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes the GPT-5.2 protocol by default', async () => {
    let ctxRef: ReturnType<typeof useProtocol> | null = null;

    render(
      <ProtocolProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </ProtocolProvider>
    );

    await waitFor(() => {
      expect(ctxRef).not.toBeNull();
    });

    expect(ctxRef!.protocols.gpt52).toBeDefined();
    expect(ctxRef!.protocols.gpt52.name).toContain('GPT-5.2');
    expect(ctxRef!.gpt52Settings.ultraStealth).toBe(true);
  });

  test('invalid stored active protocol falls back to standard', async () => {
    // @ts-expect-error jest mock typing varies by setup
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@protocol_active') return 'not-a-real-protocol';
      return null;
    });

    let ctxRef: ReturnType<typeof useProtocol> | null = null;

    render(
      <ProtocolProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </ProtocolProvider>
    );

    await waitFor(() => {
      expect(ctxRef).not.toBeNull();
    });

    expect(ctxRef!.activeProtocol).toBe('standard');
  });
});

