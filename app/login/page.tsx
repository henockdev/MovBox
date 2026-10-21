import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In — Movbox",
  description: "Sign in to your Movbox account.",
};

export default function LoginPage() {
  return (
    <AuthLayout side="login">
      <LoginForm />
    </AuthLayout>
  );
}
