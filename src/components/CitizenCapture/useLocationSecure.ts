import jurisdictions from '../../../config/jurisdictions.json';

export interface GeoLocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export interface JurisdictionMatch {
  id: string;
  name: string;
}

const MMR_BOUNDS = jurisdictions.region.bounds;

/**
 * Checks if coordinates fall within the MMR region, then matches a specific jurisdiction.
 */
export const matchJurisdiction = (lat: number, lng: number): JurisdictionMatch | null => {
  for (const jur of jurisdictions.jurisdictions) {
    if (
      lat >= jur.bounds.latMin &&
      lat <= jur.bounds.latMax &&
      lng >= jur.bounds.lngMin &&
      lng <= jur.bounds.lngMax
    ) {
      return { id: jur.id, name: jur.name };
    }
  }
  return null;
};

const isInMMR = (lat: number, lng: number): boolean => {
  return (
    lat >= MMR_BOUNDS.latMin &&
    lat <= MMR_BOUNDS.latMax &&
    lng >= MMR_BOUNDS.lngMin &&
    lng <= MMR_BOUNDS.lngMax
  );
};

export const useLocationSecure = () => {
  const getSecureLocation = (): Promise<{ latitude: number; longitude: number; jurisdiction: JurisdictionMatch | null }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by this device."));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // MMR Geofence Check
          if (isInMMR(latitude, longitude)) {
            const jurisdiction = matchJurisdiction(latitude, longitude);
            resolve({ latitude, longitude, jurisdiction });
          } else {
            // In DEMO_MODE, allow manual location with a fixed demo point
            const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
            if (demoMode) {
              // Use a fixed, deterministic demo location (CSMT, Mumbai)
              const demoLat = 18.9398;
              const demoLng = 72.8355;
              console.warn("[DEMO_MODE] Location outside MMR. Using fixed demo point (CSMT, Mumbai).");
              const jurisdiction = matchJurisdiction(demoLat, demoLng);
              resolve({ latitude: demoLat, longitude: demoLng, jurisdiction });
            } else {
              reject(
                new Error(
                  "Your location is outside the Mumbai Metropolitan Region (MMR). " +
                  "This system is currently configured for MMR jurisdictions only."
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
              errorMessage = "Location information is unavailable.";
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
          maximumAge: 0, // Force fresh location
        }
      );
    });
  };

  return { getSecureLocation, matchJurisdiction, isInMMR };
};
