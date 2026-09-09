import { createContext, type ReactNode } from "react";
import type { UserRecord } from "@/types";

interface AuthContextValue {
  firebaseUser: null;
  profile: UserRecord;
  loading: false;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Sign-in has been removed: every visitor shares this one fixed admin
 * identity, with full access to every page. There is no Firebase Auth
 * session — `firebaseUser` stays null — so this only works because
 * firestore.rules/storage.rules and the server/ API no longer require
 * `request.auth`/a bearer token either (see those files' history).
 */
const SHARED_PROFILE: UserRecord = {
  userId: "shared-admin",
  name: "Admin",
  email: "admin@local",
  role: "admin",
  status: "active",
  createdAt: new Date(0).toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = { firebaseUser: null, profile: SHARED_PROFILE, loading: false };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
