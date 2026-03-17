"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = "", id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="font-pixel text-[8px] text-pixel-muted uppercase"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 font-pixel text-[10px]
            bg-pixel-bg text-pixel-text
            border-2 border-pixel-panel
            focus:border-pixel-accent focus:outline-none
            placeholder:text-pixel-muted/50
            transition-colors
            ${error ? "border-red-500" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <span className="font-pixel text-[7px] text-red-400">{error}</span>
        )}
      </div>
    );
  }
);
