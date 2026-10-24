import type { Metadata } from "next";
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
      <LoginForm />
    </AuthLayout>
  );
}
