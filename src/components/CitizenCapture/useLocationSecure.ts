export interface GeoLocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

// Delhi Geographical Bounding Box
const DELHI_BOUNDS = {
  latMin: 28.4041,
  latMax: 28.8834,
  lngMin: 76.8389,
  lngMax: 77.3482,
};

export const useLocationSecure = () => {
  const getSecureLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by this device."));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Strict Delhi Geofence Check
          if (
            latitude >= DELHI_BOUNDS.latMin &&
            latitude <= DELHI_BOUNDS.latMax &&
            longitude >= DELHI_BOUNDS.lngMin &&
            longitude <= DELHI_BOUNDS.lngMax
          ) {
            resolve({ latitude, longitude });
          } else {
            // DEV MOCK: If we are in development, automatically spoof location to a random spot in Delhi for testing
            if (import.meta.env.DEV) {
              const randomLat = DELHI_BOUNDS.latMin + Math.random() * (DELHI_BOUNDS.latMax - DELHI_BOUNDS.latMin);
              const randomLng = DELHI_BOUNDS.lngMin + Math.random() * (DELHI_BOUNDS.lngMax - DELHI_BOUNDS.lngMin);
              console.warn("DEV MODE: Spoofing location to a random Delhi coordinate");
              resolve({ latitude: randomLat, longitude: randomLng });
            } else {
              // Log securely, zero data leak
              reject(
                new Error(
                  "Access Denied: Your location is outside the authorized Delhi jurisdiction."
                )
              );
            }
          }
        },
        (error) => {
          let errorMessage = "Unable to retrieve location securely.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Capture blocked.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable or spoofed.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force fresh location, prevent cached/spoofed data
        }
      );
    });
  };

  return { getSecureLocation };
};
