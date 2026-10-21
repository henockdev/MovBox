import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up — Movbox",
  description: "Create your free Movbox account.",
};

export default function SignupPage() {
  return (
    <AuthLayout side="signup">
      <SignupForm />
    </AuthLayout>
  );
}
