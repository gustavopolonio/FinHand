"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setIsLoading(true);
    setError(null);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/dashboard`,
      errorCallbackURL: `${window.location.origin}/?authentication=failed`,
      additionalData: {
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
    });

    if (result.error) {
      setError("Google sign-in could not be started. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-10">
      <button
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-finhand-primary px-6 py-3 font-semibold text-white transition hover:bg-finhand-primary-strong disabled:cursor-wait disabled:opacity-60"
        disabled={isLoading}
        onClick={() => void signIn()}
        type="button"
      >
        {isLoading ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-finhand-expense" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
