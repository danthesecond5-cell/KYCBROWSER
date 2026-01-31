import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TestingWatermark from '@/components/TestingWatermark';

describe('TestingWatermark', () => {
  const renderTree = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(element);
    });
    return tree!.toJSON();
  };

  it('renders minimal variant', () => {
    const tree = renderTree(
      <TestingWatermark visible={true} variant="minimal" showPulse={false} />
    );
    expect(tree).toMatchSnapshot();
  });

  it('renders full variant', () => {
    const tree = renderTree(
      <TestingWatermark visible={true} variant="full" showPulse={false} />
    );
    expect(tree).toMatchSnapshot();
  });

  it('returns null when not visible', () => {
    const tree = renderTree(<TestingWatermark visible={false} />);
    expect(tree).toBeNull();
  });

  it('renders fullscreen position with all elements', () => {
    const tree = renderTree(
      <TestingWatermark
        visible={true}
        position="fullscreen"
        showPulse={false}
        mlSafetyEnabled={true}
        httpsEnforced={true}
        protocolName="TEST-PROTOCOL"
      />
    );
    expect(tree).toMatchSnapshot();
  });
});
