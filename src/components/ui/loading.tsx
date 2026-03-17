"use client";

interface LoadingProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export function Loading({ text = "Loading", size = "md" }: LoadingProps) {
  const blockSize =
    size === "sm" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-4 h-4";
  const textSize =
    size === "sm" ? "text-[7px]" : size === "md" ? "text-[9px]" : "text-[11px]";
  const gap = size === "sm" ? "gap-0.5" : size === "md" ? "gap-1" : "gap-1.5";

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`flex items-center ${gap}`}>
        <span
          className={`${blockSize} bg-pixel-accent animate-pixel-bounce`}
          style={{ animationDelay: "0ms" }}
        />
        <span
          className={`${blockSize} bg-pixel-accent animate-pixel-bounce`}
          style={{ animationDelay: "100ms" }}
        />
        <span
          className={`${blockSize} bg-pixel-accent animate-pixel-bounce`}
          style={{ animationDelay: "200ms" }}
        />
        <span
          className={`${blockSize} bg-pixel-accent animate-pixel-bounce`}
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className={`font-pixel ${textSize} text-pixel-muted animate-pixel-blink`}>
        {text}
      </span>
    </div>
  );
}
