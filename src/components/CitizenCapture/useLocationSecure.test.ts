/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocationSecure } from './useLocationSecure';

describe('useLocationSecure - Delhi Geofencing', () => {
  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).navigator.geolocation = mockGeolocation;
  });

  it('resolves coordinates if within Delhi bounds', async () => {
    // Connaught Place, New Delhi coordinates
    const validDelhiCoords = { latitude: 28.6304, longitude: 77.2177 };
    
    mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => 
      success({ coords: validDelhiCoords })
    );

    const { result } = renderHook(() => useLocationSecure());
    const location = await result.current.getSecureLocation();

    expect(location).toEqual(validDelhiCoords);
  });

  it('rejects with Access Denied if outside Delhi bounds', async () => {
    // Mumbai coordinates
    const invalidCoords = { latitude: 19.0760, longitude: 72.8777 };
    
    mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => 
      success({ coords: invalidCoords })
    );

    const { result } = renderHook(() => useLocationSecure());
    
    await expect(result.current.getSecureLocation()).rejects.toThrow(
      'Access Denied: Your location is outside the authorized Delhi jurisdiction.'
    );
  });

  it('rejects securely if permission is denied', async () => {
    mockGeolocation.getCurrentPosition.mockImplementationOnce((_, error) => 
      error({ code: 1, PERMISSION_DENIED: 1 })
    );

    const { result } = renderHook(() => useLocationSecure());

    await expect(result.current.getSecureLocation()).rejects.toThrow(
      'Location permission denied. Capture blocked.'
    );
  });
});
