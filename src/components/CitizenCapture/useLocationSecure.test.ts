import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLocationSecure } from './useLocationSecure';

describe('useLocationSecure', () => {
  it('should export getSecureLocation', () => {
    const { result } = renderHook(() => useLocationSecure());
    expect(typeof result.current.getSecureLocation).toBe('function');
  });
});
