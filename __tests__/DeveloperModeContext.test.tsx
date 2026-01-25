import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DeveloperModeProvider, useDeveloperMode } from '@/contexts/DeveloperModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DEVELOPER_MODE } from '@/types/protocols';

function Consumer({ onReady }: { onReady: (ctx: any) => void }) {
  const ctx = useDeveloperMode();
  useEffect(() => {
    if (ctx && !ctx.isLoading) {
      onReady(ctx);
    }
  }, [ctx, onReady]);
  return null;
}

describe('DeveloperModeContext', () => {
  test('defaults and PIN behavior', async () => {
    let ctxRef: any = null;

    render(
      <DeveloperModeProvider>
        <Consumer onReady={(ctx) => { ctxRef = ctx; }} />
      </DeveloperModeProvider>
    );

    await waitFor(() => expect(ctxRef).toBeTruthy());

    expect(ctxRef.developerMode.enabled).toBe(DEFAULT_DEVELOPER_MODE.enabled);
    expect(ctxRef.developerMode.pinCode).toBe(DEFAULT_DEVELOPER_MODE.pinCode);

    const toggleRes = await ctxRef.toggleDeveloperMode('wrong');
    expect(toggleRes).toBe(false);
    
    // We need to re-fetch or wait for state update? 
    // The ctxRef from closure might be stale if Consumer doesn't update it.
    // But Consumer has dependency [ctx], so it should update ctxRef.
    // However, ctxRef variable in test scope is just a reference to the LAST ctx passed.
    
    await waitFor(() => expect(ctxRef.isDeveloperModeEnabled).toBe(false));

    const successRes = await ctxRef.toggleDeveloperMode(DEFAULT_DEVELOPER_MODE.pinCode || '');
    expect(successRes).toBe(true);
    
    await waitFor(() => expect(ctxRef.isDeveloperModeEnabled).toBe(true));

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
