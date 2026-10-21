"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-14 w-14 text-warning" />
      <h1 className="mt-6 font-display text-3xl font-bold text-cream">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary md:text-base">
        We hit an unexpected error rendering this page. You can try again, or
        head back home.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-text-muted">
          Error ID: <code className="text-text-secondary">{error.digest}</code>
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">
            <Home className="h-4 w-4" /> Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
