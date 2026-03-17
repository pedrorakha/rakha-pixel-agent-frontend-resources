"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscordLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-pixel-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title area */}
        <div className="text-center mb-8">
          {/* Pixel art logo placeholder */}
          <div className="mx-auto mb-6 w-24 h-24 bg-pixel-surface border-4 border-pixel-panel flex items-center justify-center">
            <div className="grid grid-cols-3 gap-0.5">
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-transparent" />
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-transparent" />
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-pixel-accent" />
              <span className="w-3 h-3 bg-pixel-accent" />
            </div>
          </div>

          <h1 className="font-pixel text-lg text-pixel-accent mb-2">
            RAKHA AGENT
          </h1>
          <p className="font-pixel text-[8px] text-pixel-muted leading-relaxed">
            Virtual pixel art office
            <br />
            powered by Discord presence
          </p>
        </div>

        {/* Login card */}
        <div className="bg-pixel-surface border-4 border-pixel-panel shadow-[4px_4px_0px_0px_rgba(15,52,96,0.6)] p-6">
          <h2 className="font-pixel text-[10px] text-pixel-text text-center mb-6">
            SIGN IN
          </h2>

          {isLoading ? (
            <div className="py-8">
              <Loading text="Connecting..." />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                onClick={handleDiscordLogin}
                variant="primary"
                size="lg"
                className="w-full"
              >
                <span className="flex items-center gap-2">
                  <DiscordIcon />
                  LOGIN WITH DISCORD
                </span>
              </Button>

              {error && (
                <div className="bg-red-500/10 border-2 border-red-500/30 p-3">
                  <p className="font-pixel text-[7px] text-red-400 text-center">
                    {error}
                  </p>
                </div>
              )}

              <p className="font-pixel text-[6px] text-pixel-muted text-center leading-relaxed">
                We use Discord OAuth to identify you
                <br />
                and sync your presence status.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="font-pixel text-[6px] text-pixel-muted/50 text-center mt-6">
          RAKHA AGENT v0.1.0
        </p>
      </div>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13.54 0.96C12.5 0.48 11.39 0.13 10.23 0C10.09 0.25 9.93 0.59 9.82 0.85C8.59 0.74 7.37 0.74 6.17 0.85C6.06 0.59 5.9 0.25 5.76 0C4.6 0.13 3.49 0.48 2.45 0.97C0.35 4.14 -0.22 7.23 0.07 10.28C1.45 11.29 2.78 11.91 4.1 12.32C4.42 11.89 4.71 11.43 4.95 10.94C4.49 10.77 4.05 10.56 3.64 10.31C3.75 10.23 3.86 10.14 3.96 10.05C6.57 11.26 9.44 11.26 12.02 10.05C12.13 10.14 12.23 10.23 12.34 10.31C11.93 10.56 11.49 10.77 11.03 10.94C11.28 11.43 11.56 11.89 11.88 12.32C13.2 11.91 14.54 11.29 15.92 10.28C16.26 6.75 15.36 3.69 13.54 0.96ZM5.34 8.42C4.55 8.42 3.9 7.69 3.9 6.81C3.9 5.93 4.53 5.2 5.34 5.2C6.15 5.2 6.8 5.93 6.78 6.81C6.78 7.69 6.15 8.42 5.34 8.42ZM10.65 8.42C9.86 8.42 9.21 7.69 9.21 6.81C9.21 5.93 9.84 5.2 10.65 5.2C11.46 5.2 12.11 5.93 12.09 6.81C12.09 7.69 11.46 8.42 10.65 8.42Z" />
    </svg>
  );
}
