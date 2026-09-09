import type { GeoPoint } from "@/types";

/**
 * Coordinates observed from the browser, in the same shape the server
 * expects on `SelfAttendanceAttemptInput.location`.
 */
export interface ObservedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  /**
   * Browsers CANNOT reliably detect mock/fake-GPS apps — there is no web
   * API that exposes "is this location spoofed". We always report this as
   * `undefined` from here. Real mock-location detection (Android's
   * `LocationManager.isFromMockProvider()` / `isMock()`) is only available
   * on the native Android path (see docs — being built by another agent).
   * The field is kept on the type so a native wrapper can populate it
   * without changing this contract.
   */
  mockLocationSuspected?: boolean;
}

/** A GPS fix this imprecise isn't useful for a geofence check. */
const LOW_ACCURACY_THRESHOLD_METERS = 50;

/**
 * Wraps `navigator.geolocation.getCurrentPosition` in a Promise with clear,
 * distinct error messages so the UI can show something a student in a rush
 * can actually act on. This is purely a UX helper — the SERVER independently
 * re-derives and authoritatively decides the geofence check; nothing here is
 * a security decision.
 */
export function getCurrentPosition(timeoutMs = 10000): Promise<ObservedLocation> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("GPS disabled: this device or browser does not support location services."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (typeof accuracy === "number" && accuracy > LOW_ACCURACY_THRESHOLD_METERS) {
          reject(
            new Error(
              `Low GPS accuracy (~${Math.round(accuracy)}m). Move to an open area, away from buildings, and try again.`
            )
          );
          return;
        }

        resolve({
          latitude,
          longitude,
          accuracy,
          // See doc-comment above: never inferred on the web.
          mockLocationSuspected: undefined,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Permission denied: allow location access in your browser settings to mark attendance."));
            return;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("GPS disabled: unable to determine your location. Turn on GPS/Location Services and try again."));
            return;
          case error.TIMEOUT:
            reject(new Error("Location timeout: it took too long to get a GPS fix. Try again in an open area."));
            return;
          default:
            reject(new Error("Unable to get your location. Please try again."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Great-circle distance between two points in meters.
 *
 * NOT the authoritative check — this exists purely for optimistic client-side
 * UI feedback ("You appear to be ~40m from class"). The server independently
 * recomputes distance against the session's stored location/radius and makes
 * the real accept/reject decision; never gate submission solely on this.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}
