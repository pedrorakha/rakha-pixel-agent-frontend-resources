"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/lib/api";

interface PasswordGateProps {
  area: "office" | "dashboard";
  children: ReactNode;
}

const STORAGE_KEY_PREFIX = "rakha-access-";

/**
 * PasswordGate — blocks all content until the correct password is verified.
 *
 * Flow:
 * 1. Check localStorage for a stored token
 * 2. If token exists, validate it with the backend (POST /auth/validate-token)
 * 3. If valid → show children
 * 4. If invalid or no token → show password input
 * 5. On password submit → POST /auth/verify-access
 * 6. If correct → store token in localStorage, show children
 * 7. If wrong → show error, stay blocked
 *
 * Security:
 * - Password is NEVER stored in frontend code
 * - Token is an HMAC signed by the backend — can't be forged
 * - Token is re-validated with backend on every page load
 * - Even if someone inspects localStorage, the token is useless without the server secret
 */
export function PasswordGate({ area, children }: PasswordGateProps) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${area}`;

  // On mount: check if we have a valid stored token
  useEffect(() => {
    let cancelled = false;

    async function checkToken() {
      const token = localStorage.getItem(storageKey);
      if (!token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        await api.post<{ valid: boolean }>("/auth/validate-token", { token, area });
        if (!cancelled) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch {
        // Token invalid — remove it
        localStorage.removeItem(storageKey);
        if (!cancelled) setChecking(false);
      }
    }

    checkToken();
    return () => { cancelled = true; };
  }, [storageKey, area]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.post<{ valid: boolean; token: string }>("/auth/verify-access", {
        password: password.trim(),
        area,
      });

      localStorage.setItem(storageKey, result.token);
      setAuthorized(true);
    } catch {
      setError("Senha incorreta");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }, [password, area, storageKey, submitting]);

  // Still checking stored token
  if (checking) {
    return (
      <div className="h-screen w-screen bg-pixel-bg flex items-center justify-center">
        <div className="font-pixel text-[8px] text-pixel-muted animate-pulse">
          Verificando acesso...
        </div>
      </div>
    );
  }

  // Not authorized — show password gate
  if (!authorized) {
    return (
      <div
        className="h-screen w-screen bg-pixel-bg flex items-center justify-center p-4"
        // Block right-click
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="w-full max-w-xs">
          <div className="bg-pixel-surface border-4 border-pixel-panel p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center gap-1 mb-3">
                <span className="w-3 h-3 bg-pixel-accent" />
                <span className="w-3 h-3 bg-pixel-accent" />
                <span className="w-3 h-3 bg-pixel-accent" />
              </div>
              <h1 className="font-pixel text-[10px] text-pixel-accent mb-1">
                RAKHA AGENT
              </h1>
              <p className="font-pixel text-[6px] text-pixel-muted">
                {area === "office" ? "Acesso ao escritorio virtual" : "Acesso ao painel admin"}
              </p>
            </div>

            {/* Password form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="font-pixel text-[7px] text-pixel-muted uppercase block mb-2">
                  Senha de acesso
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoFocus
                  autoComplete="off"
                  className="w-full px-3 py-2 font-pixel text-[10px] bg-pixel-bg text-pixel-text border-2 border-pixel-panel focus:border-pixel-accent focus:outline-none placeholder:text-pixel-muted/30"
                />
              </div>

              {error && (
                <div className="mb-4 px-3 py-2 border-2 border-red-600/50 bg-red-900/20">
                  <p className="font-pixel text-[7px] text-red-400 text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !password.trim()}
                className="w-full px-4 py-2.5 font-pixel text-[8px] bg-pixel-accent text-white border-2 border-pixel-accent/60 hover:bg-pixel-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(233,69,96,0.4)]"
              >
                {submitting ? "VERIFICANDO..." : "ENTRAR"}
              </button>
            </form>

            <p className="font-pixel text-[5px] text-pixel-muted/50 text-center mt-4">
              Acesso restrito
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authorized — render children
  return <>{children}</>;
}
