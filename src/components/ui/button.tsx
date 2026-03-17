"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-pixel-accent text-white hover:bg-pixel-accent/80 border-2 border-pixel-accent/60 shadow-[2px_2px_0px_0px_rgba(233,69,96,0.4)]",
  secondary:
    "bg-pixel-panel text-pixel-text hover:bg-pixel-panel/80 border-2 border-pixel-panel/60 shadow-[2px_2px_0px_0px_rgba(15,52,96,0.4)]",
  ghost:
    "bg-transparent text-pixel-text hover:bg-pixel-surface border-2 border-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 border-2 border-red-500/60 shadow-[2px_2px_0px_0px_rgba(220,38,38,0.4)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-[8px]",
  md: "px-4 py-2 text-[10px]",
  lg: "px-6 py-3 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          font-pixel inline-flex items-center justify-center
          transition-all duration-100 active:translate-y-[2px] active:shadow-none
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="animate-pixel-blink">...</span>
            Loading
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
