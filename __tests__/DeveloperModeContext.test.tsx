import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DeveloperModeProvider, useDeveloperMode } from '@/contexts/DeveloperModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DEVELOPER_MODE } from '@/types/protocols';
import { Text } from 'react-native';

function Consumer({ onReady }: { onReady?: (ctx: ReturnType<typeof useDeveloperMode>) => void }) {
  const ctx = useDeveloperMode();
  
  React.useEffect(() => {
    if (!ctx.isLoading && onReady) {
      onReady(ctx);
    }
  }, [ctx, onReady]);
  
  return <Text testID="consumer">Consumer</Text>;
}

describe('DeveloperModeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults match expected values', async () => {
    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;

    render(
      <DeveloperModeProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </DeveloperModeProvider>
    );

    await waitFor(() => {
      expect(ctxRef).not.toBeNull();
    });

    expect(ctxRef!.developerMode.enabled).toBe(DEFAULT_DEVELOPER_MODE.enabled);
    expect(ctxRef!.developerMode.pinCode).toEqual(expect.any(String));
    expect(ctxRef!.developerMode.pinCode).toMatch(/^sha256:/);
  });

  test('incorrect PIN does not enable developer mode', async () => {
    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;

    render(
      <DeveloperModeProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </DeveloperModeProvider>
    );

    await waitFor(() => {
      expect(ctxRef).not.toBeNull();
    });

    const result = await ctxRef!.toggleDeveloperMode('wrong');
    expect(result).toBe(false);
    expect(ctxRef!.isDeveloperModeEnabled).toBe(false);
  });

  test('correct PIN enables developer mode', async () => {
    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;

    render(
      <DeveloperModeProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </DeveloperModeProvider>
    );

    await waitFor(() => {
      expect(ctxRef).not.toBeNull();
    });

    const result = await ctxRef!.toggleDeveloperMode(DEFAULT_DEVELOPER_MODE.pinCode || '');
    expect(result).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
