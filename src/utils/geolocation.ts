
export type LocationStatus = 'precise' | 'fallback' | 'denied' | 'unavailable' | 'loading';

export interface GeolocationResult {
  lat: number;
  lng: number;
  name: string;
  status: LocationStatus;
}

export const FALLBACK_LOCATION: GeolocationResult = {
  lat: -18.9188,
  lng: -48.2768,
  name: 'Uberlândia, MG',
  status: 'fallback'
};

export async function fetchCurrentLocation(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...FALLBACK_LOCATION, status: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            'Localização Atual';
          
          const state = data.address?.state_code?.toUpperCase() || data.address?.state || '';
          
          resolve({ 
            lat, 
            lng: lon, 
            name: `${city}${state ? `, ${state}` : ''}`, 
            status: 'precise' 
          });
        } catch {
          resolve({ lat, lng: lon, name: 'Localização Atual', status: 'precise' });
        }
      },
      (error) => {
        console.warn('[Geolocation] Error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ...FALLBACK_LOCATION, status: 'denied' });
        } else {
          resolve({ ...FALLBACK_LOCATION, status: 'unavailable' });
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

export function isFallbackLocation(lat: number, lng: number): boolean {
  return Math.abs(lat - FALLBACK_LOCATION.lat) < 0.0001 && Math.abs(lng - FALLBACK_LOCATION.lng) < 0.0001;
}
