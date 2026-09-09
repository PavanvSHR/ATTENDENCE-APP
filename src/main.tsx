import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { isFirebaseConfigured } from "@/firebase/config";
import { FirebaseSetupNoticePage } from "@/pages/FirebaseSetupNoticePage";
import { App } from "./App";
import "./index.css";

// Firebase must be configured (see .env.example) before the app touches
// Auth/Firestore at all — see the doc-comment on `isFirebaseConfigured` for
// why skipping this check means a silent blank page instead of useful UI.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {isFirebaseConfigured ? (
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        ) : (
          <FirebaseSetupNoticePage />
        )}
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
