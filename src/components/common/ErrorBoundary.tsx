import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level safety net. Without this, ANY uncaught error thrown during
 * render anywhere in the tree unmounts the whole app with no visible
 * feedback — exactly the "blank white page" failure mode this app hit when
 * Firebase Auth threw synchronously with a missing API key. That specific
 * cause is now prevented upstream (see `isFirebaseConfigured` in
 * `src/firebase/config.ts`), but this boundary still catches whatever comes
 * next instead of going blank again.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
          <AlertOctagon className="h-14 w-14 text-destructive" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Try reloading the page. If this keeps happening, check the browser
            console for details and share them with your administrator.
          </p>
          <pre className="max-w-lg overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
