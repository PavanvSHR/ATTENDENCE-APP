import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <Compass className="h-14 w-14 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
      <Button asChild>
        <Link to="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
