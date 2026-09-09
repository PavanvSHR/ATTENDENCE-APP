/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEFAULT_COLLEGE_LAT: string;
  readonly VITE_DEFAULT_COLLEGE_LNG: string;
  readonly VITE_DEFAULT_GEOFENCE_RADIUS_M: string;
  readonly VITE_ENABLE_FACE_RECOGNITION: string;
  readonly VITE_ENABLE_BIOMETRIC: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
