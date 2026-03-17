"use client";

import { ReactNode, useEffect, useCallback } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className="relative z-10 w-full max-w-md mx-4 bg-pixel-surface border-4 border-pixel-panel shadow-[4px_4px_0px_0px_rgba(15,52,96,0.6)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-pixel-panel">
          <h2 className="font-pixel text-[10px] text-pixel-text">{title}</h2>
          <button
            onClick={onClose}
            className="font-pixel text-[10px] text-pixel-muted hover:text-pixel-accent transition-colors"
            aria-label="Close modal"
          >
            [X]
          </button>
        </div>

        {/* Body */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
