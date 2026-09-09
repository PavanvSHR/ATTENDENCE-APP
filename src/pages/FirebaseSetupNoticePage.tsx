import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Shown instead of the app when required Firebase env vars are missing (see
 * `isFirebaseConfigured` in `src/firebase/config.ts`). Without this, a
 * missing `.env` means Firebase Auth throws synchronously during module
 * evaluation and the whole app is a permanently blank white page — this is
 * the deliberate, visible alternative to that.
 */
export function FirebaseSetupNoticePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-center text-xl">Firebase isn't configured yet</CardTitle>
          <CardDescription className="text-center">
            This app needs your Firebase project's web config before it can run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              Copy <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">.env.example</code> to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">.env</code> in the project root.
            </li>
            <li>
              In the{" "}
              <a
                className="text-primary underline"
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Firebase Console
              </a>
              , open <strong className="text-foreground">Project settings → General → Your apps → Web app</strong>{" "}
              and copy the config values into <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">.env</code>.
            </li>
            <li>
              Restart the dev server (<code className="rounded bg-muted px-1.5 py-0.5 text-foreground">npm run dev</code>)
              so Vite picks up the new environment variables.
            </li>
          </ol>
          <p className="rounded-md border border-border bg-muted/50 p-3 text-muted-foreground">
            See <strong className="text-foreground">README.md</strong> for the full setup guide, including creating
            the Firestore database, enabling Authentication providers, and creating your first admin account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
