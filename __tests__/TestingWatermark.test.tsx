import React from 'react';
import { act, create } from 'react-test-renderer';
import TestingWatermark from '@/components/TestingWatermark';

describe('TestingWatermark', () => {
  it('renders minimal variant', () => {
    let tree;
    act(() => {
      tree = create(<TestingWatermark visible={true} variant="minimal" showPulse={false} />).toJSON();
    });
    expect(tree).toMatchSnapshot();
  });

  it('renders full variant', () => {
    let tree;
    act(() => {
      tree = create(<TestingWatermark visible={true} variant="full" showPulse={false} />).toJSON();
    });
    expect(tree).toMatchSnapshot();
  });

  it('returns null when not visible', () => {
    let tree;
    act(() => {
      tree = create(<TestingWatermark visible={false} />).toJSON();
    });
    expect(tree).toBeNull();
  });
});
