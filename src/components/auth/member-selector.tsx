"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { usePlayerStore } from "@/stores/player-store";
import { Loading } from "@/components/ui/loading";

interface ApiMember {
  id: string;
  name: string;
  discord_id: string;
  character_sprite: string;
  is_active: boolean;
}

type Step = "select" | "confirm";

export function MemberSelector() {
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { setSelectedMember } = usePlayerStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      try {
        const data = await api.get<ApiMember[]>("/members");
        if (cancelled) return;
        setMembers((data ?? []).filter((m) => m.is_active));
      } catch {
        if (!cancelled) setError("Falha ao carregar membros");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback((member: ApiMember) => {
    setSelectedId(member.id);
    setSelectedName(member.name);
    setStep("confirm");
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedId && selectedName) {
      setSelectedMember(selectedId, selectedName);
    }
  }, [selectedId, selectedName, setSelectedMember]);

  const handleBack = useCallback(() => {
    setStep("select");
    setSelectedId(null);
    setSelectedName(null);
  }, []);

  return (
    <div
      className="h-screen w-screen bg-pixel-bg flex items-center justify-center p-4"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-full max-w-sm">
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
              {step === "select"
                ? "Selecione seu personagem"
                : "Confirme sua escolha"}
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="py-8 flex justify-center">
              <Loading text="Carregando membros..." />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 border-2 border-red-600/50 bg-red-900/20">
              <p className="font-pixel text-[7px] text-red-400 text-center">
                {error}
              </p>
            </div>
          )}

          {/* Step: Select */}
          {!loading && !error && step === "select" && (
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {members.length === 0 && (
                <p className="font-pixel text-[7px] text-pixel-muted text-center py-4">
                  Nenhum membro encontrado
                </p>
              )}
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelect(member)}
                  className="w-full px-4 py-3 text-left bg-pixel-bg border-2 border-pixel-panel hover:border-pixel-accent hover:bg-pixel-panel/30 transition-all group"
                >
                  <span className="font-pixel text-[8px] text-pixel-text group-hover:text-pixel-accent transition-colors">
                    {member.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step: Confirm */}
          {!loading && !error && step === "confirm" && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-4 bg-pixel-bg border-2 border-pixel-panel">
                <p className="font-pixel text-[8px] text-pixel-text mb-2">
                  {selectedName}
                </p>
                <p className="font-pixel text-[6px] text-pixel-muted">
                  Voce selecionou o correto?
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBack}
                  className="flex-1 px-4 py-2.5 font-pixel text-[8px] bg-pixel-bg text-pixel-muted border-2 border-pixel-panel hover:bg-pixel-panel/50 transition-all active:translate-y-[2px]"
                >
                  VOLTAR
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 font-pixel text-[8px] bg-pixel-accent text-white border-2 border-pixel-accent/60 hover:bg-pixel-accent/80 transition-all active:translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(233,69,96,0.4)]"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          )}

          <p className="font-pixel text-[5px] text-pixel-muted/50 text-center mt-4">
            Acesso restrito
          </p>
        </div>
      </div>
    </div>
  );
}
