import React from 'react';
import { render } from '@testing-library/react-native';
import TestingWatermark from '@/components/TestingWatermark';

describe('TestingWatermark', () => {
  it('renders minimal variant', () => {
    const { toJSON } = render(
      <TestingWatermark visible={true} variant="minimal" showPulse={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders full variant', () => {
    const { toJSON } = render(
      <TestingWatermark visible={true} variant="full" showPulse={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('returns null when not visible', () => {
    const { toJSON } = render(<TestingWatermark visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders fullscreen position with all elements', () => {
    const { toJSON } = render(
      <TestingWatermark
        visible={true}
        position="fullscreen"
        showPulse={false}
        mlSafetyEnabled={true}
        httpsEnforced={true}
        protocolName="TEST-PROTOCOL"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
