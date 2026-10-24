import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  path: "/signup",
  title: "Sign Up",
  description: "Create your free Movbox account.",
  noindex: true,
});

export default function SignupPage() {
  return (
    <AuthLayout side="signup">
      <SignupForm />
    </AuthLayout>
  );
}
