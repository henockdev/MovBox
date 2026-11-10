import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  path: "/login",
  title: "Sign In",
  description: "Sign in to your Movbox account.",
  noindex: true,
});

export default function LoginPage() {
  return (
    <AuthLayout side="login">
      {/* The form reads the "next" parameter with useSearchParams(), which
          Next.js only allows inside a Suspense boundary. The boundary used
          to be the app-wide loading.tsx; it is local now, so the whole app
          can answer a missing page with a real 404 instead of a flushed
          skeleton. */}
      <Suspense
        fallback={
          <div className="space-y-4" aria-hidden="true">
            <div className="skeleton h-10 w-full rounded-md" />
            <div className="skeleton h-10 w-full rounded-md" />
            <div className="skeleton h-10 w-full rounded-md" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
