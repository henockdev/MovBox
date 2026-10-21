"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistFormProps {
  /** Where the form was submitted from — saved alongside the email
   *  so you can segment later ("web only", "app landing", etc). */
  source?: string;
  className?: string;
}

/**
 * Progressive-enhancement email capture.
 *
 *  - Without JS: posts as a normal <form action="...">. The server
 *    returns 200 with no special handling, so the user lands on a
 *    blank JSON page (acceptable, but ugly).
 *  - With JS: fetches /api/waitlist and shows inline feedback
 *    ("Thanks!" or a validation error).
 *
 * Posts to /api/waitlist. That route writes to Supabase
 * `email_subscribers` (anon INSERT allowed by RLS).
 */
export function WaitlistForm({ source = "unknown", className }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
      };
      if (json.ok) {
        setState("ok");
        setMessage(
          json.already
            ? "You're already on the list — we'll be in touch."
            : "Thanks! We'll email you the moment Movbox goes live."
        );
        setEmail("");
      } else {
        setState("err");
        setMessage(json.error || "Something went wrong. Try again?");
      }
    } catch {
      setState("err");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row", className)}
      noValidate
    >
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={state === "loading" || state === "ok"}
        className="flex-1 rounded-lg border border-border bg-surface/60 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={state === "loading" || state === "ok"}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
          state === "ok"
            ? "bg-green-700/90 text-cream"
            : "bg-accent text-bg-deepest hover:bg-vanilla",
          "disabled:cursor-not-allowed disabled:opacity-70"
        )}
      >
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "ok" && <Check className="h-4 w-4" />}
        {state === "ok" ? "Subscribed" : state === "loading" ? "Sending…" : "Notify me"}
      </button>
      {(state === "ok" || state === "err") && message && (
        <p
          className={cn(
            "basis-full text-left text-xs sm:text-center",
            state === "ok" ? "text-green-400" : "text-amber-400"
          )}
        >
          {message}
        </p>
      )}
    </form>
  );
}
